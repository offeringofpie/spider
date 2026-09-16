const namedEntities: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
};

export function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&(\w+);/g, (match, name) => namedEntities[name] ?? match);
}

export function countWords(html: string | null | undefined): number {
  if (!html) return 0;
  return html
    .replace(/<[^>]+>/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
}

export function metaDescription(html: string): string | null {
  const tag =
    html.match(/<meta[^>]+og:description[^>]*>/i) ??
    html.match(/<meta[^>]+name=["']description["'][^>]*>/i);
  const content = tag?.[0].match(/content=["']([^"']*)["']/i)?.[1];
  if (!content) return null;
  const text = decodeEntities(content).trim();
  return text.length >= 20 ? text : null;
}

export function titleFromHtml(html: string): string | null {
  const match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return match ? match[1].replace(/<[^>]+>/g, '').trim() || null : null;
}

export function htmlLang(html: string): string | null {
  const match = html.match(/<html[^>]*\slang=["']([^"']+)["']/i);
  if (!match) return null;
  const lang = match[1].trim();
  return /^[a-z]{2,3}(-[a-z0-9]+)*$/i.test(lang) ? lang : null;
}

export function extractDataRaw(html: string): string | null {
  const match = html.match(/data-raw="([^"]*)"/);
  if (!match) return null;
  const decoded = decodeEntities(match[1]);
  return decoded.length >= 200 ? decoded : null;
}

export function paywallTeaser(html: string): string | null {
  const blocks = html.matchAll(
    /<div[^>]*class=["'][^"']*\bentry-content\b[^"']*["'][^>]*>([\s\S]*?)(?:<div[^>]*class=["'][^"']*expand-paywall|<button[^>]*expand-paywall-button|<\/article)/gi,
  );
  let best = '';
  for (const block of blocks) {
    const paras = [...block[1].matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((p) =>
        decodeEntities(p[1].replace(/<[^>]+>/g, ''))
          .replace(/\s+/g, ' ')
          .trim(),
      )
      .filter((t) => t.length > 40);
    const joined = paras.map((t) => `<p>${t}</p>`).join('');
    if (joined.length > best.length) best = joined;
  }
  return best || null;
}

type LinkTag = {
  readonly rel: string;
  readonly type: string;
  readonly href: string;
};

function attr(tag: string, name: string): string {
  const match = tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, 'i'));
  return match ? match[1].trim().toLowerCase() : '';
}

export function linkTags(html: string, base: URL): readonly LinkTag[] {
  const head = html.slice(0, html.search(/<\/head>/i) + 1 || html.length);
  const tags: LinkTag[] = [];

  for (const match of head.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    const rel = attr(tag, 'rel');
    const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1];
    if (!rel || !href) {
      continue;
    }
    try {
      tags.push({ rel, type: attr(tag, 'type'), href: new URL(href, base).href });
    } catch {
      continue;
    }
  }
  return tags;
}

export function ampUrl(html: string, base: URL): string | null {
  const amp = linkTags(html, base).find((tag) => tag.rel === 'amphtml');
  return amp?.href ?? null;
}

export function feedLinks(tags: readonly LinkTag[]): string[] {
  return tags
    .filter((tag) => tag.rel === 'alternate' && /rss|atom|xml/.test(tag.type))
    .map((tag) => tag.href);
}

export function markdownLinks(tags: readonly LinkTag[]): string[] {
  return tags
    .filter((tag) => tag.rel === 'alternate' && tag.type.includes('markdown'))
    .map((tag) => tag.href);
}

export type { LinkTag };
