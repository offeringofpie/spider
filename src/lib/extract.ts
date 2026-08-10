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

export function ampUrl(html: string, base: URL): string | null {
  const match =
    html.match(/<link[^>]+rel=["']amphtml["'][^>]+href=["']([^"']+)["']/i) ??
    html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']amphtml["']/i);
  if (!match) return null;
  try {
    return new URL(match[1], base).href;
  } catch {
    return null;
  }
}
