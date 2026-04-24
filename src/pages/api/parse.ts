import { Parser } from '@jocmp/mercury-parser';

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

const strategies = [
  {
    name: 'wayback',
    matches: (url: URL) =>
      ['tijd.be', 'standaard.be', 'ft.com'].some((d) => url.hostname.includes(d)),
    fetchUrl: (url: URL) => `https://web.archive.org/web/2/${url.href}`,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  },
  {
    name: 'archive',
    matches: () => false,
    fetchUrl: (url: URL) => `https://archive.ph/newest/${url.href}`,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  },
  {
    name: 'googlebot',
    matches: (url: URL) =>
      ['.be', '.nl', '.fr', '.de'].some((tld) => url.hostname.endsWith(tld)),
    fetchUrl: (url: URL) => url.href,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
  },
  {
    name: 'facebook',
    matches: () => false,
    fetchUrl: (url: URL) => url.href,
    headers: {
      'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  },
  {
    name: 'regular',
    matches: () => true,
    fetchUrl: (url: URL) => url.href,
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

export async function GET({ request }: { request: Request }) {
  const { searchParams } = new URL(request.url);
  const urlString = searchParams.get('q');
  const strategy = searchParams.get('strategy') ?? 'auto';

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

  let strategiesToTry;
  if (strategy === 'auto') {
    const primary =
      strategies.find((s) => s.matches(url)) ??
      strategies.find((s) => s.name === 'regular')!;
    const fallbackNames = ['googlebot', 'wayback', 'archive', 'regular'];
    strategiesToTry = [
      primary,
      ...fallbackNames
        .filter((name) => name !== primary.name)
        .map((name) => strategies.find((s) => s.name === name)!),
    ];
  } else {
    strategiesToTry = [
      strategies.find((s) => s.name === strategy) ??
        strategies.find((s) => s.name === 'regular')!,
    ];
  }

  let lastError: string | null = null;
  const archiveCandidates = [
    { label: 'Wayback Machine snapshots', url: `https://web.archive.org/web/*/${url.href}` },
    { label: 'archive.ph (newest)', url: `https://archive.ph/newest/${url.href}` },
  ];

  for (const currentStrategy of strategiesToTry) {
    try {
      const fetchUrl = currentStrategy.fetchUrl(url);
      const response = await fetchWithRetry(fetchUrl, {
        headers: currentStrategy.headers,
        signal: AbortSignal.timeout(4500),
        redirect: 'follow',
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const html = await response.text();
      const parsed = await Parser.parse(url.href, { html, contentType: 'html' });

      if (!parsed.content || parsed.content.trim() === '') {
        throw new Error('Parsed successfully, but content was empty.');
      }

      return new Response(
        JSON.stringify({
          ...parsed,
          meta: {
            originalUrl: url.href,
            fetchedUrl: fetchUrl,
            strategy: currentStrategy.name,
            contentLength: html.length,
          },
        }),
        { status: 200, headers: cacheHeaders }
      );
    } catch (error: any) {
      console.warn(`Strategy '${currentStrategy.name}' failed:`, error.message);
      lastError = error.message;
    }
  }

  return new Response(
    JSON.stringify({
      error: lastError ?? 'All strategies failed to fetch content.',
      url: url.href,
      suggestion: 'Tried requested strategy and fallbacks, all failed.',
      archive_links: archiveCandidates,
    }),
    { status: 500, headers: corsHeaders }
  );
}

export async function OPTIONS() {
  return new Response('OK', { status: 200, headers: corsHeaders });
}