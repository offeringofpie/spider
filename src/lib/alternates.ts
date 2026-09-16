import { decodeEntities } from './extract';

const feedPaths = ['/rss.xml', '/feed.xml', '/index.xml', '/atom.xml'];
const llmsPaths = ['/llms-full.txt', '/llms.txt'];

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

interface FeedArticle {
  title: string | null;
  content: string;
  datePublished: string | null;
}

export function articleFromFeed(
  xml: string,
  target: string,
): FeedArticle | null {
  for (const match of xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)) {
    const item = match[0];
    const link = itemLink(item);
    if (!link || normalizeUrl(link) !== normalizeUrl(target)) continue;

    const content =
      tagContent(item, 'content:encoded') ??
      tagContent(item, 'description') ??
      tagContent(item, 'summary');
    if (!content || textLength(content) < 400) continue;

    return {
      title: tagContent(item, 'title'),
      content,
      datePublished:
        tagContent(item, 'pubDate') ??
        tagContent(item, 'published') ??
        tagContent(item, 'updated'),
    };
  }
  return null;
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
