const Parser = require('@jocmp/mercury-parser');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
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
    matches: () => false, // manual only via &strategy=archive
    fetchUrl: (url) => `https://archive.ph/newest/${url.href}`,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Cache-Control': 'no-cache',
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
      'Cache-Control': 'no-cache',
    },
  },
  {
    name: 'facebook',
    matches: () => false, // manual only via &strategy=facebook
    fetchUrl: (url) => url.href,
    headers: {
      'User-Agent':
        'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Cache-Control': 'no-cache',
    },
  },
  {
    name: 'regular',
    matches: () => true, // catch-all fallback
    fetchUrl: (url) => url.href,
    headers: {
      'Cache-Control': 'no-cache,no-store,max-age=1,must-revalidate',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      Referer: 'https://www.google.com/',
    },
  },
];

const parsers = [];

async function fetchWithRetry(fetchUrl, options, retries = 3, backoff = 1000) {
  for (let i = 0; i < retries; i++) {
    const response = await fetch(fetchUrl, options);
    if (response.status !== 429) return response;
    const retryAfter = response.headers.get('Retry-After');
    const delay = retryAfter ? parseInt(retryAfter) * 1000 : backoff * 2 ** i;
    console.warn(
      `429 received, retrying in ${delay}ms (attempt ${i + 1}/${retries})...`,
    );
    await new Promise((res) => setTimeout(res, delay));
  }
  throw new Error('HTTP 429: Too Many Requests (retries exhausted)');
}

export const handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Preflight successful' }),
    };
  }

  if (!event.queryStringParameters || !event.queryStringParameters.q) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Invalid/No URL provided',
        usage: 'Add ?q=URL_TO_PARSE to your request',
      }),
    };
  }

  const {
    q: urlString,
    strategy = 'auto',
    ...parameters
  } = event.queryStringParameters;

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

  let selected =
    strategy === 'auto'
      ? (strategies.find((s) => s.matches(url)) ?? strategies.at(-1))
      : (strategies.find((s) => s.name === strategy) ?? strategies.at(-1));

  // Add custom parsers if domain matches
  parsers.forEach((parser) => {
    if (url.hostname.includes(parser.domain)) {
      try {
        Parser.addExtractor(parser);
      } catch (error) {
        console.warn(
          `Failed to add parser for ${parser.domain}:`,
          error.message,
        );
      }
    }
  });

  const fallbackChain = ['wayback', 'archive', 'googlebot', 'regular'];

  try {
    let fetchUrl = selected.fetchUrl(url);
    let strategyName = selected.name;
    let response;

    try {
      response = await fetchWithRetry(fetchUrl, {
        headers: selected.headers,
        signal: AbortSignal.timeout(15000),
        redirect: 'follow',
      });
    } catch (err) {
      if (err.message.includes('429')) {
        console.warn(
          `Strategy "${strategyName}" exhausted, trying fallback cascade...`,
        );
        for (const name of fallbackChain) {
          if (name === strategyName) continue;
          const fallback = strategies.find((s) => s.name === name);
          if (!fallback) continue;
          try {
            const fbFetchUrl = fallback.fetchUrl(url);
            response = await fetchWithRetry(fbFetchUrl, {
              headers: fallback.headers,
              signal: AbortSignal.timeout(15000),
              redirect: 'follow',
            });
            if (response.ok) {
              fetchUrl = fbFetchUrl;
              strategyName = `${strategyName}→${name}`;
              break;
            }
          } catch (fbErr) {
            console.warn(`Fallback "${name}" also failed:`, fbErr.message);
          }
        }
      } else {
        throw err;
      }
    }

    if (!response || !response.ok) {
      throw new Error(
        `HTTP ${response?.status ?? 'unknown'}: ${response?.statusText ?? 'No response'}`,
      );
    }

    const html = await response.text();
    const parsed = await Parser.parse(url.href, {
      html: html,
      contentType: 'html',
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        ...parsed,
        meta: {
          originalUrl: url.href,
          fetchedUrl: fetchUrl,
          strategy: strategyName,
          contentLength: html.length,
          timestamp: new Date().toISOString(),
        },
      }),
    };
  } catch (error) {
    console.error('Parsing failed:', error);

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: error.message || 'Unknown error occurred',
        url: url.href,
        strategy: selected.name,
        timestamp: new Date().toISOString(),
        suggestion:
          strategy === 'auto'
            ? 'Try adding &strategy=archive'
            : 'Try a different strategy parameter',
      }),
    };
  }
};
