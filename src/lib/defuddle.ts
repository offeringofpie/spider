import { parseHTML } from 'linkedom';
import { Defuddle } from 'defuddle/node';
import { countWords } from './extract';
import { articleResult } from './markdown';

interface DefuddleResult {
  title?: string | null;
  content?: string | null;
  author?: string | null;
  published?: string | null;
  image?: string | null;
  description?: string | null;
  wordCount?: number | null;
}

function isoDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function parseWithDefuddle(html: string, sourceUrl: string) {
  try {
    const { document } = parseHTML(html);
    const result = (await Defuddle(document, sourceUrl, {
      markdown: false,
      useAsync: false,
    })) as unknown as DefuddleResult;

    const content = result.content?.trim();
    if (!content) return null;

    const parsed = articleResult(content, sourceUrl, {
      title: result.title ?? null,
      author: result.author ?? null,
      datePublished: isoDate(result.published),
      leadImageUrl: result.image ?? null,
      wordCount:
        typeof result.wordCount === 'number'
          ? result.wordCount
          : countWords(content),
    });
    if (result.description) parsed.dek = result.description;
    return parsed;
  } catch {
    return null;
  }
}
