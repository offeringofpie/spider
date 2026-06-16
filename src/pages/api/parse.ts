import Parser from '@jocmp/mercury-parser';
import { marked } from 'marked';

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
}

interface StrategySuccess {
  kind: 'success';
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

type StrategyAttempt = StrategySuccess | StrategyFailure;

function isMarkdown(url: URL, contentType: string): boolean {
  return (
    contentType.includes('text/markdown') ||
    url.pathname.endsWith('.md') ||
    url.searchParams.get('format') === 'md'
  );
}

function extractDataRaw(html: string): string | null {
  const match = html.match(/data-raw="([^"]*)"/);
  if (!match) return null;
  const decoded = match[1]
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
  return decoded.length >= 200 ? decoded : null;
}

function titleFromHtml(html: string): string | null {
  const match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return match ? match[1].replace(/<[^>]+>/g, '').trim() || null : null;
}

function parseMarkdown(text: string, sourceUrl: string) {
  const titleMatch = text.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : null;

  const content = String(marked.parse(text));

  const word_count = text.split(/\s+/).filter(Boolean).length;

  const excerptMatch = content.match(/<p>([\s\S]*?)<\/p>/);
  const excerpt = excerptMatch
    ? excerptMatch[1].replace(/<[^>]+>/g, '').trim().slice(0, 300)
    : null;

  return { title, content, url: sourceUrl, word_count, date_published: null, lead_image_url: null, dek: null, excerpt };
}

const strategies: Strategy[] = [
  {
    name: 'googlebot',
    matches: (url) => ['.be', '.nl', '.fr', '.de'].some((tld) => url.hostname.endsWith(tld)),
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
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
];

async function fetchWithRetry(
  fetchUrl: string,
  options: RequestInit,
  retries = 2,
  backoff = 500
): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const response = await fetch(fetchUrl, options);
    if (response.status !== 429) return response;
    const retryAfter = response.headers.get('Retry-After');
    const delay = retryAfter ? parseInt(retryAfter) * 1000 : backoff;
    console.warn(`429 received, retrying in ${delay}ms...`);
    await new Promise((res) => setTimeout(res, delay));
  }
  throw new Error('HTTP 429: Too Many Requests');
}

async function tryStrategy(url: URL, strategy: Strategy): Promise<StrategyAttempt> {
  try {
    const response = await fetchWithRetry(url.href, {
      headers: strategy.headers,
      signal: AbortSignal.timeout(4500),
      redirect: 'follow',
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    const contentType = response.headers.get('content-type') ?? '';

    if (isMarkdown(url, contentType)) {
      const parsed = parseMarkdown(text, url.href);
      if (!parsed.content?.trim()) throw new Error('Empty content after parsing');
      return { kind: 'success', parsed, fetchedUrl: url.href, strategyName: strategy.name, contentLength: text.length };
    }

    const parsed = await Parser.parse(url.href, { html: text, contentType: 'html' });
    if (!parsed.content?.trim()) {
      const rawMd = extractDataRaw(text);
      if (!rawMd) throw new Error('Empty content after parsing');
      const mdParsed = parseMarkdown(rawMd, url.href);
      if (!mdParsed.content?.trim()) throw new Error('Empty content after parsing');
      if (!mdParsed.title) mdParsed.title = titleFromHtml(text);
      return { kind: 'success', parsed: mdParsed, fetchedUrl: url.href, strategyName: strategy.name, contentLength: text.length };
    }
    return { kind: 'success', parsed, fetchedUrl: url.href, strategyName: strategy.name, contentLength: text.length };
  } catch (error: any) {
    return { kind: 'failure', strategyName: strategy.name, error: error.message };
  }
}

export async function GET({ request }: { request: Request }) {
  const { searchParams } = new URL(request.url);
  const urlString = searchParams.get('q');
  const strategyParam = searchParams.get('strategy') ?? 'auto';

  if (!urlString) {
    return new Response(
      JSON.stringify({ error: 'Invalid/No URL provided', usage: 'Add ?q=URL_TO_PARSE' }),
      { status: 400, headers: corsHeaders }
    );
  }

  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid URL format', provided: urlString }),
      { status: 400, headers: corsHeaders }
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

  let lastFailure: StrategyFailure | null = null;
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
          },
        }),
        { status: 200, headers: cacheHeaders }
      );
    }
    console.warn(`Strategy '${result.strategyName}' failed:`, result.error);
    lastFailure = result;
  }

  return new Response(
    JSON.stringify({
      error: lastFailure?.error ?? 'All strategies failed.',
      url: url.href,
      suggestion: 'Try accessing the article via one of the archive links below.',
      archive_links: [
        { label: 'Wayback Machine snapshots', url: `https://web.archive.org/web/*/${url.href}` },
        { label: 'archive.ph (newest)', url: `https://archive.ph/newest/${url.href}` },
      ],
    }),
    { status: 500, headers: corsHeaders }
  );
}

export async function OPTIONS() {
  return new Response('OK', { status: 200, headers: corsHeaders });
}
