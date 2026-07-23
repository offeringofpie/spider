import { marked } from 'marked';

export function isMarkdown(url: URL, contentType: string): boolean {
  return (
    contentType.includes('text/markdown') ||
    url.pathname.endsWith('.md') ||
    url.searchParams.get('format') === 'md'
  );
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
