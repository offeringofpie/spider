import { marked } from 'marked';

export function isMarkdown(url: URL, contentType: string): boolean {
  return (
    contentType.includes('text/markdown') ||
    url.pathname.endsWith('.md') ||
    url.searchParams.get('format') === 'md'
  );
}

export function extractDataRaw(html: string): string | null {
  const match = html.match(/data-raw="([^"]*)"/);
  if (!match) return null;
  const decoded = match[1]
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
  return decoded.length >= 200 ? decoded : null;
}

export function titleFromHtml(html: string): string | null {
  const match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return match ? match[1].replace(/<[^>]+>/g, '').trim() || null : null;
}

export function parseMarkdown(text: string, sourceUrl: string) {
  const titleMatch = text.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : null;

  const content = String(marked.parse(text));

  const wordCount = text.split(/\s+/).filter(Boolean).length;

  const excerptMatch = content.match(/<p>([\s\S]*?)<\/p>/);
  const excerpt = excerptMatch
    ? excerptMatch[1]
        .replace(/<[^>]+>/g, '')
        .trim()
        .slice(0, 300)
    : null;

  return {
    title,
    content,
    url: sourceUrl,
    word_count: wordCount,
    date_published: null,
    lead_image_url: null,
    dek: null,
    excerpt,
  };
}

export function botChallenge(html: string, title: string | null): boolean {
  if (
    /cf-browser-verification|cf-challenge-running|id="challenge-form"/i.test(
      html,
    )
  )
    return true;
  if (
    title &&
    /^(just a moment\.?|security verification|attention required|ddos protection)$/i.test(
      title.trim(),
    )
  )
    return true;
  return false;
}

export function paywall(
  html: string,
  parsed: { word_count?: number | null; content?: string | null },
): boolean {
  const wordCount = parsed.word_count ?? 0;
  const contentWordCount = parsed.content
    ? parsed.content
        .replace(/<[^>]+>/g, '')
        .split(/\s+/)
        .filter(Boolean).length
    : 0;
  const effectiveCount = Math.max(wordCount, contentWordCount);
  const paywallTerms = /paywall|subscribe|premium|subscriber|sign in/i;
  return (
    effectiveCount < 150 && html.length > 20_000 && paywallTerms.test(html)
  );
}

export function stripAtLinks(html: string): string {
  return html
    .replace(/href=["']at:\/\/[^"']*["']/gi, 'href="#"')
    .replace(/src=["']at:\/\/[^"']*["']/gi, '');
}

export function stripHeadingAttrs(html: string): string {
  return html.replace(/<h([1-6])\b([^>]*)>/gi, (_match, level, attrs) => {
    const cleaned = attrs
      .replace(/\s+class=["'][^"']*["']/gi, '')
      .replace(/\s+id=["'][^"']*["']/gi, '');
    return `<h${level}${cleaned}>`;
  });
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
