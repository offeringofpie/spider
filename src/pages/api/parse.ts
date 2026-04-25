import Parser from '@jocmp/mercury-parser';

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
  'Netlify-Vary': 'query',
};

const strategies: Record<string, string[]> = {
  'medium.com': ['googlebot', 'curl', 'wayback'],
  'newscientist.com': ['wayback', 'archive', 'googlebot', 'facebook'],
  'wired.com': ['googlebot', 'wayback'],
  'ft.com': ['wayback', 'googlebot'],
  'nytimes.com': ['googlebot', 'wayback'],
  'technologyreview.com': ['googlebot', 'wayback'],
  'theatlantic.com': ['googlebot', 'wayback'],
  'washingtonpost.com': ['googlebot', 'wayback'],
};

const bots = {
  googlebot: {
    'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    From: 'googlebot(at)googlebot.com',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  },
  browser: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    Referer: 'https://www.google.com/',
    'Accept-Language': 'en-US,en;q=0.9',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  },
  twitter: {
    'User-Agent': 'Twitterbot/1.0',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  curl: {
    'User-Agent': 'curl/8.4.0',
    Accept: '*/*',
  },
  facebook: {
    'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
};

const attempts = [
  {
    name: 'wayback',
    matches: (url: URL) =>
      ['tijd.be', 'standaard.be', 'ft.com'].some((d) => url.hostname.includes(d)),
    fetchUrl: (url: URL) => `https://web.archive.org/web/2if_/${url.href}`,
    headers: bots.googlebot,
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
      [
        'medium.com',
        'newscientist.com',
        'wired.com',
        'technologyreview.com',
        'theatlantic.com',
        'washingtonpost.com',
      ].some((d) => url.hostname.includes(d)) ||
      ['.be', '.nl', '.fr', '.de'].some((tld) => url.hostname.endsWith(tld)),
    fetchUrl: (url: URL) => url.href,
    headers: bots.googlebot,
  },
  {
    name: 'twitterbot',
    matches: () => false,
    fetchUrl: (url: URL) => url.href,
    headers: bots.twitter,
  },
  {
    name: 'curl',
    matches: () => false,
    fetchUrl: (url: URL) => url.href,
    headers: bots.curl,
  },
  {
    name: 'facebook',
    matches: () => false,
    fetchUrl: (url: URL) => url.href,
    headers: bots.facebook,
  },
  {
    name: 'regular',
    matches: () => true,
    fetchUrl: (url: URL) => url.href,
    headers: bots.browser,
  },
] as const;

const MIN_LEN = 800;
const TIMEOUT_MS = 4500;

type ParseResult = {
  title: string | null;
  content: string;
  author: string | null;
  date_published: string | null;
  lead_image_url: string | null;
  url: string;
  meta: {
    strategy: string;
    originalUrl: string;
    fetchedUrl: string;
    contentLength: number;
  };
};

type MediumBlock = {
  type?: string;
  text?: string;
  metadata?: {
    id?: string;
    alt?: string;
  };
  iframe?: {
    mediaResource?: {
      href?: string;
    };
  };
};

type MediumPost = {
  title?: string;
  createdAt?: number;
  creator?: {
    name?: string;
  };
  virtuals?: {
    previewImage?: {
      imageId?: string;
    };
  };
  content?: {
    bodyModel?: {
      paragraphs?: MediumBlock[];
    };
  };
};

type MediumPayload = {
  payload?: {
    value?: MediumPost;
  };
};

type Attempt = (typeof attempts)[number];
type JsonExtractor = (url: URL, data: unknown, fetchedUrl: string) => ParseResult;

function stripWww(hostname: string) {
  return hostname.replace(/^www\./, '');
}

function textToJson(text: string) {
  return JSON.parse(text.replace(/^[^\{]+/, ''));
}

function htmlEscape(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asMediumPayload(data: unknown): MediumPayload {
  if (!isObject(data)) return {};
  return data as MediumPayload;
}

function renderMediumHtml(post: MediumPost) {
  const blocks = post.content?.bodyModel?.paragraphs ?? [];
  const chunks: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let listItems: string[] = [];

  function flushList() {
    if (!listType || listItems.length === 0) return;
    const tag = listType;
    chunks.push(`<${tag}>\n${listItems.join('\n')}\n</${tag}>`);
    listType = null;
    listItems = [];
  }

  for (const block of blocks) {
    const text = htmlEscape(block.text);

    if (block.type === 'ULI') {
      if (listType && listType !== 'ul') flushList();
      listType = 'ul';
      listItems.push(`<li>${text}</li>`);
      continue;
    }

    if (block.type === 'OLI') {
      if (listType && listType !== 'ol') flushList();
      listType = 'ol';
      listItems.push(`<li>${text}</li>`);
      continue;
    }

    flushList();

    switch (block.type) {
      case 'H2':
        chunks.push(`<h2>${text}</h2>`);
        break;
      case 'H3':
        chunks.push(`<h3>${text}</h3>`);
        break;
      case 'H4':
        chunks.push(`<h4>${text}</h4>`);
        break;
      case 'IMG': {
        const id = block.metadata?.id;
        if (!id) break;
        const alt = htmlEscape(block.metadata?.alt);
        chunks.push(`<img src="https://miro.medium.com/v2/resize:fit:1400/${id}" alt="${alt}" />`);
        break;
      }
      case 'PRE':
        chunks.push(`<pre><code>${text}</code></pre>`);
        break;
      case 'BQ':
        chunks.push(`<blockquote>${text}</blockquote>`);
        break;
      case 'PQ':
        chunks.push(`<blockquote class="pullquote">${text}</blockquote>`);
        break;
      case 'IFRAME':
        chunks.push(`<!-- embedded iframe: ${htmlEscape(block.iframe?.mediaResource?.href)} -->`);
        break;
      default:
        if (text) chunks.push(`<p>${text}</p>`);
    }
  }

  flushList();
  return chunks.join('\n');
}

function normalizeMedium(url: URL, post: MediumPost, fetchedUrl: string): ParseResult {
  const content = renderMediumHtml(post);

  if (!content || content.trim().length < 200) {
    throw new Error('Parsed JSON content was too short');
  }

  return {
    title: post.title ?? null,
    content,
    author: post.creator?.name ?? null,
    date_published: post.createdAt ? new Date(post.createdAt).toISOString() : null,
    lead_image_url: post.virtuals?.previewImage?.imageId
      ? `https://miro.medium.com/v2/resize:fit:1400/${post.virtuals.previewImage.imageId}`
      : null,
    url: url.href,
    meta: {
      strategy: 'json',
      originalUrl: url.href,
      fetchedUrl,
      contentLength: content.length,
    },
  };
}

const jsonExtractors: Record<string, JsonExtractor> = {
  'medium.com': (url, data, fetchedUrl) => {
    const payload = asMediumPayload(data);
    const post = payload.payload?.value;

    if (!post?.content?.bodyModel?.paragraphs?.length) {
      throw new Error('No structured article payload found');
    }

    return normalizeMedium(url, post, fetchedUrl);
  },
};

async function fetchJsonArticle(url: URL) {
  const host = stripWww(url.hostname);
  const extract = jsonExtractors[host];
  if (!extract) throw new Error('No JSON extractor for this host');

  const jsonUrl = `${url.origin}${url.pathname}?format=json`;
  const res = await fetch(jsonUrl, {
    headers: {
      ...bots.googlebot,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const type = res.headers.get('content-type') ?? '';
  if (!type.includes('application/json')) {
    throw new Error(`Expected JSON, got ${type}`);
  }

  return extract(url, textToJson(await res.text()), jsonUrl);
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  tries = 2,
  wait = 500
): Promise<Response> {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url, options);
    if (res.status !== 429) return res;

    const retryAfter = res.headers.get('Retry-After');
    const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : wait;
    console.warn(`429 from ${url}, retrying in ${delay}ms`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  throw new Error('HTTP 429: Too Many Requests');
}

function byName(name: string): Attempt | undefined {
  return attempts.find((item) => item.name === name);
}

function chooseAttempts(url: URL, force: string): Attempt[] {
  const host = stripWww(url.hostname);

  if (force !== 'auto') {
    const chosen = byName(force) ?? byName('regular');
    return chosen ? [chosen] : [];
  }

  const hinted = Object.entries(strategies).find(([site]) =>
    host.includes(site)
  )?.[1];

  if (hinted) {
    const picked = hinted
      .map((name) => byName(name))
      .filter((item): item is Attempt => Boolean(item));

    const fallback = byName('regular');
    return fallback ? [...picked, fallback] : picked;
  }

  const first = attempts.find((item) => item.pick(url)) ?? byName('regular');

  const fallbackOrder = [
    'googlebot',
    'twitterbot',
    'wayback',
    'curl',
    'facebook',
    'archive',
    'regular',
  ];

  const rest = fallbackOrder
    .filter((name) => name !== first?.name)
    .map((name) => byName(name))
    .filter((item): item is Attempt => Boolean(item));

  return first ? [first, ...rest] : rest;
}

function respond(body: object, status: number) {
  const headers = status === 200 ? cacheHeaders : corsHeaders;
  return new Response(JSON.stringify(body), { status, headers });
}

export async function GET({ request }: { request: Request }) {
  const reqUrl = new URL(request.url);
  const raw = reqUrl.searchParams.get('q');
  const force = reqUrl.searchParams.get('strategy') ?? 'auto';

  if (!raw) {
    return respond(
      { error: 'Invalid/No URL provided', usage: 'Add ?q=URL_TO_PARSE' },
      400
    );
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return respond({ error: 'Invalid URL format', provided: raw }, 400);
  }

  try {
    const jsonResult = await fetchJsonArticle(url);
    return respond(jsonResult, 200);
  } catch (err) {
    console.warn(`JSON fast-path skipped for ${url.hostname}: ${getMessage(err)}`);
  }

  const queue = chooseAttempts(url, force);
  const archives = [
    { label: 'Wayback Machine snapshots', url: `https://web.archive.org/web/*/${url.href}` },
    { label: 'archive.ph (newest)', url: `https://archive.ph/newest/${url.href}` },
  ];

  let lastErr: string | null = null;

  for (const step of queue) {
    try {
      const target = step.url(url);
      const res = await fetchWithRetry(target, {
        headers: step.headers,
        signal: AbortSignal.timeout(TIMEOUT_MS),
        redirect: 'follow',
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const html = await res.text();
      const parsed = await Parser.parse(url.href, { html, contentType: 'html' });
      const size = parsed.content?.trim().length ?? 0;

      if (size < MIN_LEN) {
        throw new Error(`Content too short (${size} chars) — likely a paywall stub`);
      }

      return respond(
        {
          ...parsed,
          meta: {
            originalUrl: url.href,
            fetchedUrl: target,
            strategy: step.name,
            contentLength: html.length,
          },
        },
        200
      );
    } catch (err) {
      const message = getMessage(err);
      console.warn(`${step.name} failed: ${message}`);
      lastErr = message;
    }
  }

  return respond(
    {
      error: lastErr ?? 'All strategies failed to fetch content.',
      url: url.href,
      suggestion: 'Tried requested strategy and fallbacks, all failed.',
      archive_links: archives,
    },
    500
  );
}

export async function OPTIONS() {
  return new Response('OK', { status: 200, headers: corsHeaders });
}