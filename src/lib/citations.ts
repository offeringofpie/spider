import { normalizeUrl, onHost, siteOf } from './alternates';
import { stripNoise } from './clean';
import { decodeEntities } from './extract';
import type { CitedCategory, CitedSource } from './types';

type Scored = CitedSource & { score: number };

type Declared = {
  url: string;
  name: string | null;
};

const sourceLimit = 6;
const descriptiveLength = 12;
const contextWords = 12;
const titleLength = 120;
const descriptiveBonus = 1;
const declaredBonus = 2;

const categoryScores: Record<CitedCategory, number> = {
  study: 5,
  official: 4,
  'code-data': 3,
  document: 3,
  reporting: 2,
};

const studyHosts = [
  'doi.org',
  'arxiv.org',
  'biorxiv.org',
  'medrxiv.org',
  'ncbi.nlm.nih.gov',
  'ssrn.com',
  'nature.com',
  'science.org',
  'thelancet.com',
  'nejm.org',
  'cell.com',
  'plos.org',
  'pnas.org',
  'bmj.com',
  'jamanetwork.com',
  'sciencedirect.com',
  'springer.com',
  'wiley.com',
  'academic.oup.com',
];

const officialHosts = [
  'europa.eu',
  'parliament.uk',
  'un.org',
  'oecd.org',
  'imf.org',
  'worldbank.org',
  'courtlistener.com',
];

const codeHosts = [
  'github.com',
  'gitlab.com',
  'huggingface.co',
  'zenodo.org',
  'figshare.com',
];

const wireHosts = ['prnewswire.com', 'businesswire.com', 'globenewswire.com'];

const noiseHosts = [
  'twitter.com',
  'x.com',
  't.co',
  'facebook.com',
  'instagram.com',
  'linkedin.com',
  'pinterest.com',
  'tiktok.com',
  'threads.net',
  'bsky.app',
  'reddit.com',
  'youtube.com',
  'youtu.be',
  'whatsapp.com',
  'wa.me',
  't.me',
  'spotify.com',
  'wikipedia.org',
  'wikimedia.org',
  'google.com',
  'apps.apple.com',
  'amazon.com',
  'amazon.co.uk',
  'amzn.to',
  'ebay.com',
  'bit.ly',
  'doubleclick.net',
  'googlesyndication.com',
  'taboola.com',
  'outbrain.com',
  'redirectingat.com',
  'skimresources.com',
];

const declaredKeys = new Set(['citation', 'isBasedOn', 'sameAs', 'mentions']);

const universityHost = /\.(?:edu|ac\.[a-z]{2}|edu\.[a-z]{2})$/;
const officialHost = /\.(?:gov|mil|int)$|\.(?:gov|gouv|gob|govt)\.[a-z]{2}$/;
const newsroomHost = /^(?:newsroom|press|investors?|ir|blog)\./;
const newsroomPath = /\/(?:newsroom|press-releases?|news-releases?)\//i;
const documentPath = /\.pdf$/i;
const datasetPath = /\.(?:csv|xlsx?|json|zip)$/i;
const noisePath =
  /\/(?:share|sharer|intent|login|log-in|signin|sign-in|signup|sign-up|subscribe|subscription|register|account|newsletters?)\b/i;
const archivedLink = /\/web\/\d+[a-z_]*\/(https?:\/\/.+)$/i;
const genericAnchor =
  /^(?:here|this|that|link|source|read more|more|click here|via)$/i;
const rawUrl = /^(?:https?:\/\/|www\.)\S+$|^[\w-]+(?:\.[\w-]+)+\/\S*$/i;
const chromeBlocks = /<(nav|header|footer|aside|form)\b[^>]*>[\s\S]*?<\/\1>/gi;
const contentStart =
  /<(?:article|main)\b|role=["']main["']|class=["'][^"']*\bentry-content\b/i;
const textBlocks = /<(p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;
const anchors = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
const ldScripts =
  /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

function plainText(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function clip(text: string): string {
  if (text.length <= titleLength) {
    return text;
  }
  return `${text.slice(0, titleLength - 1).trimEnd()}…`;
}

function hostOf(url: URL): string {
  return url.hostname.replace(/^www\./, '');
}

function resolve(href: string, base: URL): URL | null {
  try {
    const url = new URL(decodeEntities(href), base);
    const archived = url.href.match(archivedLink)?.[1];
    const target = archived ? new URL(archived) : url;
    return target.protocol === 'http:' || target.protocol === 'https:'
      ? target
      : null;
  } catch {
    return null;
  }
}

function excluded(url: URL, site: string): boolean {
  const host = hostOf(url);
  if (onHost(host, noiseHosts) || noisePath.test(url.pathname)) {
    return true;
  }
  const file =
    documentPath.test(url.pathname) || datasetPath.test(url.pathname);
  return siteOf(host) === site && !file;
}

function categoryOf(url: URL): CitedCategory | null {
  const host = hostOf(url);
  if (universityHost.test(host) || onHost(host, studyHosts)) {
    return 'study';
  }
  if (officialHost.test(host) || onHost(host, officialHosts)) {
    return 'official';
  }
  if (onHost(host, codeHosts) || datasetPath.test(url.pathname)) {
    return 'code-data';
  }
  if (
    documentPath.test(url.pathname) ||
    onHost(host, wireHosts) ||
    newsroomHost.test(host) ||
    newsroomPath.test(url.pathname)
  ) {
    return 'document';
  }
  return null;
}

function descriptive(anchor: string): boolean {
  return (
    anchor.length >= descriptiveLength &&
    !rawUrl.test(anchor) &&
    !genericAnchor.test(anchor)
  );
}

function labelOf(anchor: string, before: string, url: URL): string {
  if (anchor && !rawUrl.test(anchor) && !genericAnchor.test(anchor)) {
    return clip(anchor);
  }
  const context = before.split(' ').slice(-contextWords).join(' ');
  return clip(context || `${hostOf(url)}${url.pathname}`);
}

function contentBlocks(html: string): string[] {
  const body = stripNoise(html).replace(chromeBlocks, '');
  const start = body.search(contentStart);
  const region = start === -1 ? body : body.slice(start);
  return [...region.matchAll(textBlocks)].map((match) => match[2]);
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function urlsIn(value: unknown, name: string | null, found: Declared[]): void {
  if (typeof value === 'string') {
    if (/^https?:\/\//i.test(value)) {
      found.push({ url: value, name });
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      urlsIn(item, name, found);
    }
    return;
  }
  if (!isRecord(value)) {
    return;
  }

  const own = text(value.name) ?? text(value.headline) ?? name;
  for (const key of ['url', '@id', 'sameAs']) {
    urlsIn(value[key], own, found);
  }
}

function declaredIn(value: unknown, found: Declared[]): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      declaredIn(item, found);
    }
    return;
  }
  if (!isRecord(value)) {
    return;
  }

  for (const [key, item] of Object.entries(value)) {
    if (declaredKeys.has(key)) {
      urlsIn(item, null, found);
      continue;
    }
    declaredIn(item, found);
  }
}

function declaredLinks(html: string): Declared[] {
  const found: Declared[] = [];
  for (const [, json] of html.matchAll(ldScripts)) {
    try {
      declaredIn(JSON.parse(json.trim()), found);
    } catch {
      continue;
    }
  }
  return found;
}

function inlineLinks(html: string, base: URL, site: string): Scored[] {
  const links: Scored[] = [];
  for (const block of contentBlocks(html)) {
    for (const anchor of block.matchAll(anchors)) {
      const href = anchor[1].match(/\bhref=["']([^"']+)["']/i)?.[1];
      const url = href ? resolve(href, base) : null;
      if (!url || excluded(url, site)) {
        continue;
      }

      const label = plainText(anchor[2]);
      const named = descriptive(label);
      const category = categoryOf(url) ?? (named ? 'reporting' : null);
      if (!category) {
        continue;
      }

      const before = plainText(block.slice(0, anchor.index));
      links.push({
        url: url.href,
        title: labelOf(label, before, url),
        host: hostOf(url),
        category,
        score: categoryScores[category] + (named ? descriptiveBonus : 0),
      });
    }
  }
  return links;
}

function jsonLdLinks(html: string, base: URL, site: string): Scored[] {
  const links: Scored[] = [];
  for (const declared of declaredLinks(html)) {
    const url = resolve(declared.url, base);
    const category = url && !excluded(url, site) ? categoryOf(url) : null;
    if (!url || !category) {
      continue;
    }
    links.push({
      url: url.href,
      title: declared.name ? clip(declared.name) : labelOf('', '', url),
      host: hostOf(url),
      category,
      score: categoryScores[category] + declaredBonus,
    });
  }
  return links;
}

function harvestCitations(html: string, url: URL): CitedSource[] {
  const site = siteOf(url.hostname);
  const found = new Map<string, Scored>();
  const links = [
    ...inlineLinks(html, url, site),
    ...jsonLdLinks(html, url, site),
  ];
  for (const link of links) {
    const key = normalizeUrl(link.url);
    const existing = found.get(key);
    if (!existing || link.score > existing.score) {
      found.set(key, link);
    }
  }

  return [...found.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, sourceLimit)
    .map(({ url, title, host, category }) => ({ url, title, host, category }));
}

export { harvestCitations };
