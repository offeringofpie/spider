import { decodeEntities } from './extract';

const feedPaths = [
  '/rss.xml',
  '/feed.xml',
  '/index.xml',
  '/atom.xml',
  '/feed',
  '/rss',
];
const fullText = 400;
const teaserText = 80;
const llmsPaths = ['/llms-full.txt', '/llms.txt'];
const wordpressFields = 'title,content,date,link,yoast_head_json';
const substackPath = /^\/p\/([^/]+)\/?$/;
const paidAudiences = new Set(['only_paid', 'founding']);

export function markdownUrls(url: URL): string[] {
  const path = url.pathname.replace(/\/+$/, '');
  if (!path || path.endsWith('.md')) return [];
  return [`${url.origin}${path}.md`, `${url.origin}${path}/index.md`];
}

export function feedUrls(url: URL): string[] {
  return feedPaths.map((path) => `${url.origin}${path}`);
}

export function llmsUrls(url: URL): string[] {
  return llmsPaths.map((path) => `${url.origin}${path}`);
}

export function wordpressUrls(url: URL, discovered: string[]): string[] {
  const slug = url.pathname.split('/').filter(Boolean).pop();
  const urls = discovered.filter((href) => href.includes('/wp/v2/'));
  if (!slug) {
    return urls;
  }

  const roots = [
    `${url.origin}/wp-json/`,
    ...discovered.filter((href) => href.endsWith('/wp-json/')),
  ];
  for (const root of roots) {
    urls.push(`${root}wp/v2/posts?slug=${slug}&_fields=${wordpressFields}`);
  }
  return [...new Set(urls)];
}

export function substackUrls(url: URL): string[] {
  const slug = url.pathname.match(substackPath)?.[1];
  return slug ? [`${url.origin}/api/v1/posts/${slug}`] : [];
}

export function absolutize(html: string, base: string): string {
  return html.replace(
    /\b(src|href)=["']([^"']+)["']/gi,
    (match, attr: string, value: string) => {
      if (/^(https?:|data:|mailto:|#)/i.test(value)) return match;
      try {
        return `${attr}="${new URL(value, base).href}"`;
      } catch {
        return match;
      }
    },
  );
}

export function leadImage(html: string): string | null {
  const src = html.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1];
  return src?.startsWith('http') ? src : null;
}

function componentToImage(tag: string): string {
  const src = tag.match(/\bsrc=["']([^"']+)["']/)?.[1];
  if (!src) return '';
  const alt = tag.match(/\balt=["']([^"']*)["']/)?.[1] ?? '';
  return `<img src="${src}" alt="${alt}">`;
}

export function cleanMarkdownSource(text: string): string {
  return text
    .replace(/^\s*(import|export)\s.+$/gm, '')
    .replace(/^\s*-\s+(URL|Date|Tags|Description|Source):.*$/gim, '')
    .replace(/<[A-Z][A-Za-z0-9]*\b[^>]*?\/>/g, componentToImage)
    .replace(/^\s*---\s*$\n+/m, '');
}

const trackingParams = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'ref',
  'fbclid',
  'gclid',
]);

export function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    for (const param of [...url.searchParams.keys()]) {
      if (trackingParams.has(param.toLowerCase())) {
        url.searchParams.delete(param);
      }
    }
    url.hash = '';
    return `${url.host}${url.pathname}${url.search}`
      .replace(/\/+$/, '')
      .toLowerCase();
  } catch {
    return trimmed
      .replace(/^https?:\/\//i, '')
      .replace(/\/+$/, '')
      .toLowerCase();
  }
}

const countryCode = /^[a-z]{2}$/;

const secondLevels = new Set([
  'ac',
  'co',
  'com',
  'edu',
  'gob',
  'gouv',
  'gov',
  'govt',
  'ne',
  'net',
  'or',
  'org',
]);

export function onHost(host: string, hosts: string[]): boolean {
  return hosts.some((known) => host === known || host.endsWith(`.${known}`));
}

export function siteOf(host: string): string {
  const labels = host.replace(/^www\./, '').split('.');
  const [second, top] = labels.slice(-2);
  const nested = countryCode.test(top) && secondLevels.has(second);
  return labels.slice(nested ? -3 : -2).join('.');
}

function tagContent(xml: string, tag: string): string | null {
  const match = xml.match(
    new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i'),
  );
  if (!match) return null;
  const raw = match[1].trim();
  const cdata = raw.match(/^<!\[CDATA\[([\s\S]*)\]\]>$/);
  return cdata ? cdata[1] : decodeEntities(raw);
}

function itemLink(item: string): string | null {
  const rss = item.match(/<link\b[^>]*>([^<]+)<\/link>/i)?.[1];
  if (rss?.trim()) return rss.trim();
  return item.match(/<link\b[^>]*href=["']([^"']+)["']/i)?.[1] ?? null;
}

function textLength(html: string): number {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().length;
}

type ArticleDetails = {
  title: string | null;
  datePublished: string | null;
  author: string | null;
  image: string | null;
};

type AlternateArticle = ArticleDetails & {
  kind: 'full' | 'teaser';
  content: string;
};

function alternateArticle(
  content: string,
  details: ArticleDetails,
): AlternateArticle | null {
  const length = textLength(content);
  if (length < teaserText) {
    return null;
  }

  return {
    ...details,
    kind: length >= fullText ? 'full' : 'teaser',
    content: /<[a-z]/i.test(content) ? content : `<p>${content}</p>`,
  };
}

export function articleFromFeed(
  xml: string,
  target: string,
): AlternateArticle | null {
  for (const match of xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)) {
    const item = match[0];
    const link = itemLink(item);
    if (!link || normalizeUrl(link) !== normalizeUrl(target)) continue;

    const content =
      tagContent(item, 'content:encoded') ??
      tagContent(item, 'description') ??
      tagContent(item, 'summary');
    if (!content) {
      continue;
    }

    const article = alternateArticle(content, {
      title: tagContent(item, 'title'),
      datePublished:
        tagContent(item, 'pubDate') ??
        tagContent(item, 'published') ??
        tagContent(item, 'updated'),
      author: null,
      image: null,
    });
    if (article) {
      return article;
    }
  }
  return null;
}

type WordpressPost = {
  link?: string;
  date?: string;
  title?: { rendered?: string };
  content?: { rendered?: string };
  yoast_head_json?: { author?: string; og_image?: { url?: string }[] };
};

type SubstackPost = {
  slug?: string;
  title?: string;
  post_date?: string;
  body_html?: string | null;
  audience?: string;
  cover_image?: string | null;
  publishedBylines?: { name?: string }[];
};

function wordpressArticle(
  data: unknown,
  target: string,
): AlternateArticle | null {
  const posts = (Array.isArray(data) ? data : [data]) as WordpressPost[];
  const post = posts.find(
    (candidate) =>
      typeof candidate?.link === 'string' &&
      normalizeUrl(candidate.link) === normalizeUrl(target),
  );
  const content = post?.content?.rendered;
  if (!post || typeof content !== 'string') {
    return null;
  }

  const title = post.title?.rendered;
  return alternateArticle(content, {
    title: title ? decodeEntities(title) : null,
    datePublished: post.date ?? null,
    author: post.yoast_head_json?.author ?? null,
    image: post.yoast_head_json?.og_image?.[0]?.url ?? null,
  });
}

function substackArticle(
  data: unknown,
  target: string,
): AlternateArticle | null {
  const post = data as SubstackPost | null;
  const slug = new URL(target).pathname.match(substackPath)?.[1];
  if (!post || !slug || post.slug !== slug) {
    return null;
  }
  if (typeof post.body_html !== 'string') {
    return null;
  }

  const authors = (post.publishedBylines ?? [])
    .map((byline) => byline.name)
    .filter(Boolean);
  const article = alternateArticle(post.body_html, {
    title: post.title ?? null,
    datePublished: post.post_date ?? null,
    author: authors.length > 0 ? authors.join(', ') : null,
    image: post.cover_image ?? null,
  });
  if (article && paidAudiences.has(post.audience ?? '')) {
    return { ...article, kind: 'teaser' };
  }
  return article;
}

export function articleFromCms(
  text: string,
  target: string,
): AlternateArticle | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  return wordpressArticle(data, target) ?? substackArticle(data, target);
}

interface LlmsArticle {
  title: string;
  body: string;
}

function findUrl(text: string, target: string): number {
  const withSlash = target.endsWith('/') ? target : `${target}/`;
  const at = text.indexOf(withSlash);
  return at >= 0 ? at : text.indexOf(withSlash.slice(0, -1));
}

export function articleFromLlms(
  text: string,
  target: string,
): LlmsArticle | null {
  const at = findUrl(text, target);
  if (at < 0) return null;

  const headings = [...text.slice(0, at).matchAll(/^(#{1,6})\s+(.+)$/gm)];
  const heading = headings.pop();
  if (!heading) return null;

  const level = heading[1].length;
  const title = heading[2].trim();
  const bodyStart = heading.index + heading[0].length;
  const rest = text.slice(bodyStart);

  const nextHeading = rest.search(new RegExp(`^#{${level}}\\s+`, 'm'));
  const bodyEnd = nextHeading === -1 ? rest.length : nextHeading;

  const body = rest
    .slice(0, bodyEnd)
    .replace(/^\s*-\s+(URL|Date|Tags|Description|Source):.*$/gim, '')
    .replace(/^\s*---\s*$/gm, '')
    .trim();

  if (body.length < 400) return null;
  return { title, body };
}
