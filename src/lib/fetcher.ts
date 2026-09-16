const defaultTimeout = 3500;

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

type Strategy = {
  readonly name: string;
  readonly matches: (url: URL) => boolean;
  readonly headers: Record<string, string>;
  readonly rewrite?: (url: URL) => Promise<string> | string;
  readonly timeout?: number;
};

type FetchOutcome =
  | {
      readonly kind: 'fetched';
      readonly url: string;
      readonly html: string;
      readonly contentType: string;
      readonly strategy: string;
      readonly ms: number;
    }
  | {
      readonly kind: 'failed';
      readonly strategy: string;
      readonly error: string;
      readonly ms: number;
    };

type Fetched = {
  readonly url: string;
  readonly text: string;
  readonly contentType: string;
};

const strategies: readonly Strategy[] = [
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
      if (!response.ok) {
        throw new Error(`Wayback check failed: HTTP ${response.status}`);
      }
      const data = (await response.json()) as {
        archived_snapshots?: {
          closest?: { available?: boolean; url?: string };
        };
      };
      const closest = data?.archived_snapshots?.closest;
      if (!closest?.available) {
        throw new Error('No Wayback snapshot available');
      }
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
    if (response.status !== 429) {
      return response;
    }
    if (i === retries - 1) {
      break;
    }
    const retryAfter = Number(response.headers.get('Retry-After'));
    const wanted =
      Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : backoff;
    const budgetLeft = remaining ? remaining() - 500 : wanted;
    const delay = Math.min(wanted, Math.max(budgetLeft, 0), 3000);
    if (delay <= 0) {
      break;
    }
    console.warn(`429 received, retrying in ${delay}ms...`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  throw new Error('HTTP 429: Too Many Requests');
}

async function fetchDocument(
  url: URL,
  strategy: Strategy,
  remaining: () => number,
): Promise<FetchOutcome> {
  const started = Date.now();
  try {
    const budgetLeft = remaining() - 500;
    if (budgetLeft < 1000) {
      throw new Error('No time left for this strategy');
    }
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
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return {
      kind: 'fetched',
      url: fetchUrl,
      html: await response.text(),
      contentType: response.headers.get('content-type') ?? '',
      strategy: strategy.name,
      ms: Date.now() - started,
    };
  } catch (error) {
    return {
      kind: 'failed',
      strategy: strategy.name,
      error: (error as Error).message,
      ms: Date.now() - started,
    };
  }
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
        if (!response.ok) {
          return null;
        }
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

export {
  browserHeaders,
  defaultTimeout,
  strategies,
  fallback,
  fetchWithRetry,
  fetchDocument,
  fetchGroup,
};
export type { Strategy, FetchOutcome, Fetched };
