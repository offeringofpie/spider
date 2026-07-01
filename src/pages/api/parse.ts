import Parser from '@jocmp/mercury-parser';
import { preserveMediaEmbeds, restoreMediaEmbeds } from '../../lib/embed';
import {
  ampUrl,
  botChallenge,
  extractDataRaw,
  isMarkdown,
  parseMarkdown,
  paywall,
  stripAtLinks,
  stripHeadingAttrs,
  titleFromHtml,
} from '../../lib/helpers';

export const prerender = false;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const cacheHeaders = {
  ...corsHeaders,
  'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
};

interface Strategy {
  name: string;
  matches: (url: URL) => boolean;
  headers: Record<string, string>;
  rewrite?: (url: URL) => Promise<string> | string;
  timeout?: number;
}

interface StrategySuccess {
  kind: 'success';
  parsed: Awaited<ReturnType<typeof Parser.parse>>;
  fetchedUrl: string;
  strategyName: string;
  contentLength: number;
  paywalled: boolean;
}

interface StrategyPartial {
  kind: 'partial';
  parsed: Awaited<ReturnType<typeof Parser.parse>>;
  fetchedUrl: string;
  strategyName: string;
  contentLength: number;
}

interface StrategyFailure {
  kind: 'failure';
  strategyName: string;
  error: string;
}

type StrategyAttempt = StrategySuccess | StrategyPartial | StrategyFailure;

const strategies: Strategy[] = [
  {
    name: 'googlebot',
    matches: (url) => {
      return ['.be', '.nl', '.fr', '.de', '.pt'].some((tld) => url.hostname.endsWith(tld));
    },
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
  },
  {
    name: 'regular',
    matches: () => true,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      Referer: 'https://www.google.com/',
    },
  },
  {
    name: 'wayback',
    matches: () => false,
    rewrite: async (url) => {
      const response = await fetch(
        `https://archive.org/wayback/available?url=${encodeURIComponent(url.href)}`,
        { signal: AbortSignal.timeout(2000) },
      );
      if (!response.ok)
        throw new Error(`Wayback check failed: HTTP ${response.status}`);
      const data = (await response.json()) as {
        archived_snapshots?: {
          closest?: { available?: boolean; url?: string };
        };
      };
      const closest = data?.archived_snapshots?.closest;
      if (!closest?.available) throw new Error('No Wayback snapshot available');
      return (closest.url as string).replace(/\/web\/(\d+)\//, '/web/$1if_/');
    },
    timeout: 6000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  },
];

async function fetchWithRetry(
  fetchUrl: string,
  options: RequestInit,
  retries = 2,
  backoff = 500,
): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const response = await fetch(fetchUrl, options);
    if (response.status !== 429) return response;
    const retryAfter = response.headers.get('Retry-After');
    const delay = retryAfter ? parseInt(retryAfter) * 1000 : backoff;
    console.warn(`429 received, retrying in ${delay}ms...`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  throw new Error('HTTP 429: Too Many Requests');
}

async function tryStrategy(
  url: URL,
  strategy: Strategy,
): Promise<StrategyAttempt> {
  try {
    const fetchUrl = (await strategy.rewrite?.(url)) ?? url.href;
    const timeout = strategy.timeout ?? 4500;
    const response = await fetchWithRetry(fetchUrl, {
      headers: strategy.headers,
      signal: AbortSignal.timeout(timeout),
      redirect: 'follow',
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    const contentType = response.headers.get('content-type') ?? '';

    if (isMarkdown(url, contentType)) {
      const parsed = parseMarkdown(text, url.href);
      if (!parsed.content?.trim())
        throw new Error('Empty content after parsing');
      return {
        kind: 'success',
        parsed,
        fetchedUrl: fetchUrl,
        strategyName: strategy.name,
        contentLength: text.length,
        paywalled: false,
      };
    }

    const parsed = await Parser.parse(url.href, {
      html: stripHeadingAttrs(stripAtLinks(preserveMediaEmbeds(text))),
      contentType: 'html',
    });
    if (parsed.content) parsed.content = restoreMediaEmbeds(parsed.content);
    const content = parsed.content?.trim();

    if (botChallenge(text, parsed.title ?? null)) {
      throw new Error('Bot challenge detected');
    }

    const paywallDetected = paywall(text, parsed);

    if (content && !paywallDetected) {
      return {
        kind: 'success',
        parsed,
        fetchedUrl: fetchUrl,
        strategyName: strategy.name,
        contentLength: text.length,
        paywalled: false,
      };
    }

    if (paywallDetected) {
      const ampHref = ampUrl(text, url);
      if (ampHref) {
        const ampResponse = await fetchWithRetry(ampHref, {
          headers: strategy.headers,
          signal: AbortSignal.timeout(timeout),
          redirect: 'follow',
        });
        if (ampResponse.ok) {
          const ampText = await ampResponse.text();
          const ampParsed = await Parser.parse(ampHref, {
            html: ampText,
            contentType: 'html',
          });
          if (ampParsed.content?.trim() && !paywall(ampText, ampParsed)) {
            return {
              kind: 'success',
              parsed: ampParsed,
              fetchedUrl: ampHref,
              strategyName: strategy.name,
              contentLength: ampText.length,
              paywalled: false,
            };
          }
        }
      }
      if (content) {
        return {
          kind: 'partial',
          parsed,
          fetchedUrl: fetchUrl,
          strategyName: strategy.name,
          contentLength: text.length,
        };
      }
    }

    const rawMd = extractDataRaw(text);
    if (rawMd) {
      const mdParsed = parseMarkdown(rawMd, url.href);
      if (mdParsed.content?.trim()) {
        if (!mdParsed.title) mdParsed.title = titleFromHtml(text);
        return {
          kind: 'success',
          parsed: mdParsed,
          fetchedUrl: fetchUrl,
          strategyName: strategy.name,
          contentLength: text.length,
          paywalled: false,
        };
      }
    }

    throw new Error(
      paywallDetected ? 'Paywall detected' : 'Empty content after parsing',
    );
  } catch (error) {
    return {
      kind: 'failure',
      strategyName: strategy.name,
      error: (error as Error).message,
    };
  }
}

export async function GET({ request }: { request: Request }) {
  const { searchParams } = new URL(request.url);
  const urlString = searchParams.get('q');
  const strategyParam = searchParams.get('strategy') ?? 'auto';

  if (!urlString) {
    return new Response(
      JSON.stringify({
        error: 'Invalid/No URL provided',
        usage: 'Add ?q=URL_TO_PARSE',
      }),
      { status: 400, headers: corsHeaders },
    );
  }

  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid URL format', provided: urlString }),
      { status: 400, headers: corsHeaders },
    );
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return new Response(
      JSON.stringify({ error: 'Only http and https URLs are supported', provided: urlString }),
      { status: 400, headers: corsHeaders },
    );
  }

  const fallback = strategies.find((s) => s.name === 'regular')!;
  let selected: Strategy[];
  if (strategyParam === 'auto') {
    const primary = strategies.find((s) => s.matches(url)) ?? fallback;
    selected = [primary, ...strategies.filter((s) => s !== primary)];
  } else {
    selected = [strategies.find((s) => s.name === strategyParam) ?? fallback];
  }

  let bestPartial: StrategyPartial | null = null;
  let lastFailure: StrategyFailure | null = null;
  let botChallengeDetected = false;
  for (const strategy of selected) {
    const result = await tryStrategy(url, strategy);
    if (result.kind === 'success') {
      return new Response(
        JSON.stringify({
          ...result.parsed,
          meta: {
            originalUrl: url.href,
            fetchedUrl: result.fetchedUrl,
            strategy: result.strategyName,
            contentLength: result.contentLength,
            paywalled: result.paywalled,
          },
        }),
        { status: 200, headers: cacheHeaders },
      );
    }
    if (result.kind === 'partial') {
      if (!bestPartial) bestPartial = result;
    } else {
      if (result.error === 'Bot challenge detected')
        botChallengeDetected = true;
      console.warn(`Strategy '${result.strategyName}' failed:`, result.error);
      lastFailure = result;
    }
  }

  if (bestPartial) {
    return new Response(
      JSON.stringify({
        ...bestPartial.parsed,
        meta: {
          originalUrl: url.href,
          fetchedUrl: bestPartial.fetchedUrl,
          strategy: bestPartial.strategyName,
          contentLength: bestPartial.contentLength,
          paywalled: true,
        },
      }),
      { status: 200, headers: cacheHeaders },
    );
  }

  return new Response(
    JSON.stringify({
      error: lastFailure?.error ?? 'All strategies failed.',
      url: url.href,
      suggestion: botChallengeDetected
        ? 'This page blocked automated access. Try an archived version below.'
        : 'Try accessing the article via one of the archive links below.',
      archive_links: [
        {
          label: 'Wayback Machine snapshots',
          url: `https://web.archive.org/web/*/${url.href}`,
        },
      ],
    }),
    { status: 500, headers: corsHeaders },
  );
}

export async function OPTIONS() {
  return new Response('OK', { status: 200, headers: corsHeaders });
}
