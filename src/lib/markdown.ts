import { marked } from 'marked';
import { lazyLoadImages, sanitize } from './clean';

export function isMarkdown(url: URL, contentType: string): boolean {
  return (
    contentType.includes('text/markdown') ||
    url.pathname.endsWith('.md') ||
    url.searchParams.get('format') === 'md'
  );
}

interface ArticleExtras {
  title?: string | null;
  author?: string | null;
  datePublished?: string | null;
  leadImageUrl?: string | null;
  wordCount?: number;
  lang?: string | null;
}

export function articleResult(
  rawContent: string,
  sourceUrl: string,
  extras: ArticleExtras = {},
) {
  const content = sanitize(lazyLoadImages(rawContent));

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
    author: extras.author ?? null,
    word_count: extras.wordCount ?? words.length,
    date_published: extras.datePublished ?? null,
    lead_image_url: extras.leadImageUrl ?? null,
    dek: null as string | null,
    excerpt,
    lang: extras.lang ?? null,
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
