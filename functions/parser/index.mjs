const Parser = require('@jocmp/mercury-parser');

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
    matches: (url) =>
      ['tijd.be', 'standaard.be', 'ft.com'].some((d) =>
        url.hostname.includes(d),
      ),
    fetchUrl: (url) => `https://web.archive.org/web/2/${url.href}`,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  },
  {
    name: 'archive',
    matches: () => false,
    fetchUrl: (url) => `https://archive.ph/newest/${url.href}`,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  },
  {
    name: 'googlebot',
    matches: (url) =>
      ['.be', '.nl', '.fr', '.de'].some((tld) => url.hostname.endsWith(tld)),
    fetchUrl: (url) => url.href,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
  },
  {
    name: 'facebook',
    matches: () => false,
    fetchUrl: (url) => url.href,
    headers: {
      'User-Agent':
        'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  },
  {
    name: 'regular',
    matches: () => true,
    fetchUrl: (url) => url.href,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      Referer: 'https://www.google.com/',
    },
  },
];

const parsers = [];

async function fetchWithRetry(fetchUrl, options, retries = 2, backoff = 500) {
  for (let i = 0; i < retries; i++) {
    const response = await fetch(fetchUrl, options);
    if (response.status !== 429) return response;
    const retryAfter = response.headers.get('Retry-After');
    const delay = retryAfter ? parseInt(retryAfter) * 1000 : backoff;
    console.warn(`429 received, retrying in ${delay}ms...`);
    await new Promise((res) => setTimeout(res, delay));
  }
  throw new Error('HTTP 429: Too Many Requests (retries exhausted)');
}

export const handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: 'OK' };
  }

  const { q: urlString, strategy = 'auto' } = event.queryStringParameters || {};

  if (!urlString) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Invalid/No URL provided',
        usage: 'Add ?q=URL_TO_PARSE',
      }),
    };
  }

  let url;
  try {
    url = new URL(urlString);
  } catch (error) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Invalid URL format',
        provided: urlString,
      }),
    };
  }

  let strategiesToTry = [];
  if (strategy === 'auto') {
    const primary =
      strategies.find((s) => s.matches(url)) ||
      strategies.find((s) => s.name === 'regular');
    const fallbackNames = ['googlebot', 'wayback', 'archive', 'regular'];
    strategiesToTry = [
      primary,
      ...fallbackNames
        .filter((name) => name !== primary.name)
        .map((name) => strategies.find((s) => s.name === name)),
    ];
  } else {
    strategiesToTry = [
      strategies.find((s) => s.name === strategy) ||
        strategies.find((s) => s.name === 'regular'),
    ];
  }

  parsers.forEach((parser) => {
    if (url.hostname.includes(parser.domain)) {
      try {
        Parser.addExtractor(parser);
      } catch (e) {
        /* ignore */
      }
    }
  });

  let lastError = null;
  let archiveCandidates = [
    {
      label: 'Wayback Machine snapshots',
      url: `https://web.archive.org/web/*/${url.href}`,
    },
    {
      label: 'archive.ph (newest)',
      url: `https://archive.ph/newest/${url.href}`,
    },
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
      const parsed = await Parser.parse(url.href, {
        html: html,
        contentType: 'html',
      });

      if (!parsed.content || parsed.content.trim() === '') {
        throw new Error('Parsed successfully, but content was empty.');
      }

      return {
        statusCode: 200,
        headers: cacheHeaders,
        body: JSON.stringify({
          ...parsed,
          meta: {
            originalUrl: url.href,
            fetchedUrl: fetchUrl,
            strategy: currentStrategy.name,
            contentLength: html.length,
          },
        }),
      };
    } catch (error) {
      console.warn(`Strategy '${currentStrategy.name}' failed:`, error.message);
      lastError = error.message;
    }
  }

  return {
    statusCode: 500,
    headers: corsHeaders,
    body: JSON.stringify({
      error: lastError || 'All strategies failed to fetch content.',
      url: url.href,
      suggestion: 'Tried requested strategy and fallbacks, all failed.',
      archive_links: archiveCandidates,
    }),
  };
};
