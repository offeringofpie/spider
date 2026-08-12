import Parser from '@jocmp/mercury-parser';
import { preserveMediaEmbeds, restoreMediaEmbeds } from '../../lib/embed';
import {
  lazyLoadImages,
  normalizeImages,
  stripAtLinks,
  stripHeadingAttrs,
  stripNoise,
} from '../../lib/clean';
import {
  ampUrl,
  countWords,
  extractDataRaw,
  htmlLang,
  metaDescription,
  paywallTeaser,
  titleFromHtml,
} from '../../lib/extract';
import { botChallenge, paywall } from '../../lib/detect';
import { structuredArticle } from '../../lib/structured';
import { parseWithDefuddle } from '../../lib/defuddle';
import { articleResult, isMarkdown, parseMarkdown } from '../../lib/markdown';
import {
  absolutize,
  articleFromFeed,
  articleFromLlms,
  cleanMarkdownSource,
  feedUrls,
  leadImage,
  llmsUrls,
  markdownUrls,
} from '../../lib/alternates';

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
  'Netlify-CDN-Cache-Control':
    'public, durable, s-maxage=86400, stale-while-revalidate=604800',
};

const partialCacheHeaders = {
  ...corsHeaders,
  'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
  'Netlify-CDN-Cache-Control':
    'public, durable, s-maxage=3600, stale-while-revalidate=86400',
};

const budget = 9000;
const defaultTimeout = 3500;
const confidentWords = 200;
const recoverWords = 150;
const truncationRatio = 1.5;
const archivePending = 'Archive requested, snapshot not ready yet';

const browserHeaders = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-GB,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Sec-Ch-Ua':
    '"Chromium";v="139", "Not:A-Brand";v="24", "Google Chrome";v="139"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'cross-site',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
  Referer: 'https://www.google.com/',
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
  confident: boolean;
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
      return ['.be', '.nl', '.fr', '.de', '.pt'].some((tld) =>
        url.hostname.endsWith(tld),
      );
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
    headers: browserHeaders,
  },
  {
    name: 'bingbot',
    matches: () => false,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
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
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  },
];

const fallback = strategies.find((s) => s.name === 'regular')!;

async function fetchWithRetry(
  fetchUrl: string,
  options: RequestInit,
  remaining?: () => number,
  retries = 2,
  backoff = 500,
): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const response = await fetch(fetchUrl, options);
    if (response.status !== 429) return response;
    if (i === retries - 1) break;
    const retryAfter = Number(response.headers.get('Retry-After'));
    const wanted =
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoff;
    const budgetLeft = remaining ? remaining() - 500 : wanted;
    const delay = Math.min(wanted, Math.max(budgetLeft, 0), 3000);
    if (delay <= 0) break;
    console.warn(`429 received, retrying in ${delay}ms...`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  throw new Error('HTTP 429: Too Many Requests');
}

async function parse(sourceUrl: string, html: string) {
  const parsed = await Parser.parse(sourceUrl, {
    html: stripHeadingAttrs(
      stripAtLinks(preserveMediaEmbeds(normalizeImages(stripNoise(html)))),
    ),
    contentType: 'html',
    fetchAllPages: false,
  });
  if (parsed.content)
    parsed.content = lazyLoadImages(restoreMediaEmbeds(parsed.content));
  return parsed;
}

function withLang<T>(parsed: T, lang: string | null): T {
  if (parsed && lang) (parsed as { lang?: string | null }).lang ??= lang;
  return parsed;
}

function success(
  parsed: StrategySuccess['parsed'],
  fetchedUrl: string,
  strategyName: string,
  contentLength: number,
  confident: boolean,
): StrategySuccess {
  return {
    kind: 'success',
    parsed,
    fetchedUrl,
    strategyName,
    contentLength,
    paywalled: false,
    confident,
  };
}

async function tryAmp(
  url: URL,
  html: string,
  strategy: Strategy,
  remaining: () => number,
) {
  const ampHref = ampUrl(html, url);
  if (!ampHref) return null;
  const budgetLeft = remaining() - 500;
  if (budgetLeft < 1000) return null;
  const timeout = Math.min(strategy.timeout ?? defaultTimeout, budgetLeft);
  const response = await fetchWithRetry(
    ampHref,
    {
      headers: strategy.headers,
      signal: AbortSignal.timeout(timeout),
      redirect: 'follow',
    },
    remaining,
  );
  if (!response.ok) return null;
  const ampText = await response.text();
  const ampParsed = await parse(ampHref, ampText);
  if (!ampParsed.content?.trim()) return null;
  if (paywall(ampText, countWords(ampParsed.content))) return null;
  return { parsed: ampParsed, fetchedUrl: ampHref, contentLength: ampText.length };
}

async function tryStrategy(
  url: URL,
  strategy: Strategy,
  remaining: () => number,
): Promise<StrategyAttempt> {
  try {
    const budgetLeft = remaining() - 500;
    if (budgetLeft < 1000) throw new Error('No time left for this strategy');
    const fetchUrl = (await strategy.rewrite?.(url)) ?? url.href;
    const timeout = Math.min(strategy.timeout ?? defaultTimeout, budgetLeft);
    const response = await fetchWithRetry(
      fetchUrl,
      {
        headers: strategy.headers,
        signal: AbortSignal.timeout(timeout),
        redirect: 'follow',
      },
      remaining,
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    const contentType = response.headers.get('content-type') ?? '';

    if (isMarkdown(url, contentType)) {
      const parsed = parseMarkdown(text, url.href);
      if (!parsed.content?.trim())
        throw new Error('Empty content after parsing');
      return success(parsed, fetchUrl, strategy.name, text.length, true);
    }

    const lang = htmlLang(text);
    const parsed = withLang(await parse(url.href, text), lang);

    if (botChallenge(text, parsed.title ?? null)) {
      throw new Error('Bot challenge detected');
    }

    const mercuryContent = parsed.content?.trim();
    const mercuryWords = countWords(parsed.content);
    const paywallDetected = paywall(text, mercuryWords);

    const structured = withLang(structuredArticle(text, url.href), lang);
    const structuredWords = countWords(structured?.content);
    if (
      structured &&
      structuredWords >= recoverWords &&
      structuredWords >= mercuryWords * truncationRatio &&
      (structuredWords >= confidentWords || !paywallDetected)
    ) {
      if (!structured.title) structured.title = parsed.title ?? titleFromHtml(text);
      if (!structured.dek) structured.dek = metaDescription(text);
      return success(structured, fetchUrl, strategy.name, text.length, true);
    }

    if (mercuryContent && !paywallDetected) {
      const confident = mercuryWords >= confidentWords;
      return success(parsed, fetchUrl, strategy.name, text.length, confident);
    }

    if (paywallDetected) {
      const amp = await tryAmp(url, text, strategy, remaining);
      if (amp)
        return success(
          amp.parsed,
          amp.fetchedUrl,
          strategy.name,
          amp.contentLength,
          true,
        );
    }

    if (!mercuryContent || mercuryWords < confidentWords) {
      const defuddled = withLang(await parseWithDefuddle(text, url.href), lang);
      const defuddleWords = countWords(defuddled?.content);
      if (
        defuddled &&
        defuddleWords >= recoverWords &&
        defuddleWords > mercuryWords &&
        (defuddleWords >= confidentWords || !paywallDetected)
      ) {
        return success(defuddled, fetchUrl, strategy.name, text.length, true);
      }
    }

    const rawMd = extractDataRaw(text);
    if (rawMd) {
      const mdParsed = withLang(parseMarkdown(rawMd, url.href), lang);
      if (mdParsed.content?.trim()) {
        if (!mdParsed.title) mdParsed.title = titleFromHtml(text);
        return success(mdParsed, fetchUrl, strategy.name, text.length, true);
      }
    }

    if (paywallDetected) {
      if (structured && structuredWords > mercuryWords) {
        if (!structured.title) structured.title = parsed.title ?? titleFromHtml(text);
        if (!structured.dek) structured.dek = metaDescription(text);
        return {
          kind: 'partial',
          parsed: structured,
          fetchedUrl: fetchUrl,
          strategyName: strategy.name,
          contentLength: text.length,
        };
      }
      if (mercuryContent) {
        if (!parsed.dek) parsed.dek = metaDescription(text);
        const teaser = paywallTeaser(text);
        if (teaser) parsed.content = teaser;
        return {
          kind: 'partial',
          parsed,
          fetchedUrl: fetchUrl,
          strategyName: strategy.name,
          contentLength: text.length,
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

interface Fetched {
  url: string;
  text: string;
  contentType: string;
}

async function fetchGroup(
  urls: string[],
  headers: Record<string, string>,
  timeout: number,
): Promise<Fetched[]> {
  const results = await Promise.all(
    urls.map(async (fetchUrl) => {
      try {
        const response = await fetch(fetchUrl, {
          headers,
          signal: AbortSignal.timeout(timeout),
          redirect: 'follow',
        });
        if (!response.ok) return null;
        return {
          url: fetchUrl,
          text: await response.text(),
          contentType: response.headers.get('content-type') ?? '',
        };
      } catch {
        return null;
      }
    }),
  );
  return results.filter((result) => result !== null);
}

function alternateTimeout(remaining: number): number {
  return Math.min(Math.max(remaining - 500, 0), 2500);
}

function alternateSuccess(
  parsed: StrategySuccess['parsed'],
  fetchedUrl: string,
  contentLength: number,
): StrategySuccess {
  return {
    kind: 'success',
    parsed,
    fetchedUrl,
    strategyName: 'alternates',
    contentLength,
    paywalled: false,
    confident: true,
  };
}

function parseAlternate(text: string, sourceUrl: string) {
  const parsed = parseMarkdown(cleanMarkdownSource(text), sourceUrl);
  if (parsed.content) {
    parsed.content = absolutize(parsed.content, sourceUrl);
    parsed.lead_image_url = leadImage(parsed.content);
  }
  return parsed;
}

async function tryMarkdownAlternate(url: URL, timeout: number) {
  const headers = { ...browserHeaders, Accept: 'text/markdown, text/plain' };
  const candidates = [url.href, ...markdownUrls(url)];
  const results = await fetchGroup(candidates, headers, timeout);

  for (const fetched of results) {
    const looksMarkdown =
      fetched.contentType.includes('text/markdown') ||
      fetched.url.endsWith('.md');
    if (!looksMarkdown || fetched.text.trimStart().startsWith('<')) continue;
    const parsed = parseAlternate(fetched.text, url.href);
    if (!parsed.content?.trim()) continue;
    return alternateSuccess(parsed, fetched.url, fetched.text.length);
  }
  return null;
}

async function tryFeedAlternate(url: URL, timeout: number) {
  const results = await fetchGroup(feedUrls(url), browserHeaders, timeout);

  for (const fetched of results) {
    const article = articleFromFeed(fetched.text, url.href);
    if (!article) continue;
    const content = absolutize(article.content, url.href);
    const parsed = articleResult(content, url.href, {
      title: article.title,
      datePublished: article.datePublished,
      leadImageUrl: leadImage(content),
    });
    return alternateSuccess(parsed, fetched.url, fetched.text.length);
  }
  return null;
}

async function tryLlmsAlternate(url: URL, timeout: number) {
  const results = await fetchGroup(llmsUrls(url), browserHeaders, timeout);

  for (const fetched of results) {
    const article = articleFromLlms(fetched.text, url.href);
    if (!article) continue;
    const parsed = parseAlternate(article.body, url.href);
    if (!parsed.content?.trim()) continue;
    parsed.title = article.title;
    return alternateSuccess(parsed, fetched.url, fetched.text.length);
  }
  return null;
}

async function tryAlternates(
  url: URL,
  remaining: () => number,
): Promise<StrategyAttempt> {
  const timeout = alternateTimeout(remaining());
  if (timeout >= 800) {
    const [markdown, feed, llms] = await Promise.all([
      tryMarkdownAlternate(url, timeout),
      tryFeedAlternate(url, timeout),
      tryLlmsAlternate(url, timeout),
    ]);
    const found = markdown ?? feed ?? llms;
    if (found) return found;
  }

  return {
    kind: 'failure',
    strategyName: 'alternates',
    error: 'No alternate representation found',
  };
}

async function trySavePage(
  url: URL,
  remaining: () => number,
): Promise<StrategyAttempt> {
  const timeout = Math.min(remaining() - 500, 8000);
  if (timeout < 1000) {
    return {
      kind: 'failure',
      strategyName: 'savepage',
      error: 'No time left to request an archive',
    };
  }

  try {
    const response = await fetch(`https://web.archive.org/save/${url.href}`, {
      headers: { 'User-Agent': browserHeaders['User-Agent'] },
      signal: AbortSignal.timeout(timeout),
      redirect: 'follow',
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    const parsed = await parse(url.href, text);
    if (!parsed.content?.trim()) throw new Error(archivePending);
    return {
      kind: 'success',
      parsed,
      fetchedUrl: response.url,
      strategyName: 'savepage',
      contentLength: text.length,
      paywalled: false,
      confident: true,
    };
  } catch (error) {
    const { name, message } = error as Error;
    const pending = name === 'TimeoutError' || message === archivePending;
    return {
      kind: 'failure',
      strategyName: 'savepage',
      error: pending ? archivePending : `Archive request failed: ${message}`,
    };
  }
}

function runStep(
  name: string,
  url: URL,
  remaining: () => number,
): Promise<StrategyAttempt> {
  if (name === 'alternates') return tryAlternates(url, remaining);
  if (name === 'savepage') return trySavePage(url, remaining);
  const strategy = strategies.find((s) => s.name === name) ?? fallback;
  return tryStrategy(url, strategy, remaining);
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
      JSON.stringify({
        error: 'Only http and https URLs are supported',
        provided: urlString,
      }),
      { status: 400, headers: corsHeaders },
    );
  }

  const started = Date.now();
  const remaining = () => budget - (Date.now() - started);

  let steps: string[];
  const directSteps = new Set<string>();
  if (strategyParam === 'auto') {
    const direct = strategies.filter((s) => s.name !== 'wayback');
    const primary = direct.find((s) => s.matches(url)) ?? fallback;
    const ordered = [primary, ...direct.filter((s) => s !== primary)];
    for (const s of ordered) directSteps.add(s.name);
    steps = [...ordered.map((s) => s.name), 'alternates', 'wayback'];
  } else {
    steps = [strategyParam];
  }

  let bestPartial: StrategyPartial | null = null;
  let firstFailure: StrategyFailure | null = null;
  let botChallengeDetected = false;
  let archiveRequested = false;
  let notFound = false;

  for (const step of steps) {
    if (step === 'savepage' && notFound) break;
    if (remaining() < 500) break;
    if (bestPartial && directSteps.has(step)) continue;
    const result = await runStep(step, url, remaining);
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
        {
          status: 200,
          headers: result.confident ? cacheHeaders : partialCacheHeaders,
        },
      );
    }
    if (result.kind === 'partial') {
      if (!bestPartial) bestPartial = result;
    } else {
      if (result.error === 'Bot challenge detected')
        botChallengeDetected = true;
      if (result.error === archivePending) archiveRequested = true;
      if (/^HTTP (404|410)$/.test(result.error)) notFound = true;
      console.warn(`Strategy '${result.strategyName}' failed:`, result.error);
      if (!firstFailure) firstFailure = result;
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
      { status: 200, headers: partialCacheHeaders },
    );
  }

  let suggestion =
    'Try accessing the article via one of the archive links below.';
  if (archiveRequested) {
    suggestion =
      'An archive of this page has been requested. Try again in a minute.';
  } else if (botChallengeDetected) {
    suggestion =
      'This page blocked automated access. Try an archived version below.';
  }

  return new Response(
    JSON.stringify({
      error: firstFailure?.error ?? 'All strategies failed.',
      url: url.href,
      suggestion,
      archive_links: [
        {
          label: 'Wayback Machine snapshots',
          url: `https://web.archive.org/web/*/${url.href}`,
        },
        {
          label: 'Archive this page now',
          url: `https://web.archive.org/save/${url.href}`,
        },
      ],
    }),
    { status: 500, headers: corsHeaders },
  );
}

export async function OPTIONS() {
  return new Response('OK', { status: 200, headers: corsHeaders });
}
