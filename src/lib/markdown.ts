import { marked } from 'marked';

export function isMarkdown(url: URL, contentType: string): boolean {
  return (
    contentType.includes('text/markdown') ||
    url.pathname.endsWith('.md') ||
    url.searchParams.get('format') === 'md'
  );
}

interface ArticleExtras {
  title?: string | null;
  datePublished?: string | null;
  leadImageUrl?: string | null;
  wordCount?: number;
}

export function articleResult(
  content: string,
  sourceUrl: string,
  extras: ArticleExtras = {},
) {
  const excerptMatch = content.match(/<p>([\s\S]*?)<\/p>/);
  const excerpt = excerptMatch
    ? excerptMatch[1]
        .replace(/<[^>]+>/g, '')
        .trim()
        .slice(0, 300)
    : null;

  const words = content
    .replace(/<[^>]+>/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  return {
    title: extras.title ?? null,
    content,
    url: sourceUrl,
    word_count: extras.wordCount ?? words.length,
    date_published: extras.datePublished ?? null,
    lead_image_url: extras.leadImageUrl ?? null,
    dek: null,
    excerpt,
  };
}

export function parseMarkdown(text: string, sourceUrl: string) {
  const titleMatch = text.match(/^#\s+(.+)$/m);
  const content = String(marked.parse(text));

  return articleResult(content, sourceUrl, {
    title: titleMatch ? titleMatch[1].trim() : null,
    wordCount: text.split(/\s+/).filter(Boolean).length,
  });
}
