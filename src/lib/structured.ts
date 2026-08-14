import { countWords, decodeEntities } from './extract';
import { absolutize, leadImage } from './alternates';
import { articleResult } from './markdown';

const articleTypes = new Set([
  'Article',
  'NewsArticle',
  'BlogPosting',
  'Report',
  'ReportageNewsArticle',
  'TechArticle',
  'ScholarlyArticle',
  'LiveBlogPosting',
  'OpinionNewsArticle',
]);

const contentKeys = new Set([
  'articlebody',
  'body',
  'bodyhtml',
  'bodytext',
  'content',
  'contenthtml',
  'rendered',
  'renderedbody',
  'richtext',
  'html',
  'text',
]);

interface JsonLdArticle {
  articleBody: string;
  headline: string | null;
  author: string | null;
  datePublished: string | null;
  image: string | null;
}

type JsonNode = Record<string, unknown>;

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function matchesType(type: unknown): boolean {
  if (typeof type === 'string') return articleTypes.has(type);
  if (Array.isArray(type)) {
    return type.some((t) => typeof t === 'string' && articleTypes.has(t));
  }
  return false;
}

function collectNodes(data: unknown): JsonNode[] {
  const out: JsonNode[] = [];
  const visit = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (node && typeof node === 'object') {
      out.push(node as JsonNode);
      visit((node as JsonNode)['@graph']);
    }
  };
  visit(data);
  return out;
}

function authorName(author: unknown): string | null {
  if (typeof author === 'string') return str(author);
  if (Array.isArray(author)) {
    const names = author.map(authorName).filter(Boolean);
    return names.length ? names.join(', ') : null;
  }
  if (author && typeof author === 'object') return str((author as JsonNode).name);
  return null;
}

function imageUrl(image: unknown): string | null {
  if (typeof image === 'string') return image;
  if (Array.isArray(image)) return imageUrl(image[0]);
  if (image && typeof image === 'object') return str((image as JsonNode).url);
  return null;
}

export function jsonLdArticle(html: string): JsonLdArticle | null {
  const scripts = html.matchAll(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  let best: JsonLdArticle | null = null;
  for (const script of scripts) {
    let data: unknown;
    try {
      data = JSON.parse(script[1].trim());
    } catch {
      continue;
    }
    for (const node of collectNodes(data)) {
      if (!matchesType(node['@type'])) continue;
      const body = str(node.articleBody);
      if (!body || body.length < 200) continue;
      if (!best || body.length > best.articleBody.length) {
        best = {
          articleBody: body,
          headline: str(node.headline) ?? str(node.name),
          author: authorName(node.author),
          datePublished: str(node.datePublished) ?? str(node.dateCreated),
          image: imageUrl(node.image),
        };
      }
    }
  }
  return best;
}

function jsonBlobs(html: string): string[] {
  const blobs: string[] = [];
  const scripts = html.matchAll(
    /<script\b[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const script of scripts) blobs.push(script[1].trim());
  const apollo = html.match(
    /window\.__APOLLO_STATE__\s*=\s*(\{[\s\S]*?\})\s*;?\s*<\/script>/i,
  );
  if (apollo) blobs.push(apollo[1]);
  return blobs;
}

function looksLikeProse(text: string): boolean {
  if (/<(?:p|br|div|h[1-6]|ul|ol|blockquote|figure)\b/i.test(text)) return true;
  return /[.!?]["')\]]?\s/.test(text) && /\s/.test(text);
}

function deepFindBody(root: unknown): string | null {
  let best: string | null = null;
  let budget = 40000;
  const stack: Array<{ node: unknown; key: string }> = [
    { node: root, key: '' },
  ];
  while (stack.length && budget-- > 0) {
    const { node, key } = stack.pop()!;
    if (typeof node === 'string') {
      if (
        contentKeys.has(key.toLowerCase()) &&
        node.length > 500 &&
        looksLikeProse(node) &&
        (!best || node.length > best.length)
      ) {
        best = node;
      }
      continue;
    }
    if (Array.isArray(node)) {
      for (const item of node) stack.push({ node: item, key });
    } else if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node as JsonNode)) {
        stack.push({ node: v, key: k });
      }
    }
  }
  return best;
}

export function hydrationArticle(html: string): string | null {
  let best: string | null = null;
  for (const blob of jsonBlobs(html)) {
    let data: unknown;
    try {
      data = JSON.parse(blob);
    } catch {
      continue;
    }
    const body = deepFindBody(data);
    if (body && (!best || body.length > best.length)) best = body;
  }
  return best;
}

function bodyToHtml(text: string): string {
  if (/<(?:p|br|div|h[1-6]|ul|ol|blockquote|figure)\b/i.test(text)) return text;
  const decoded = decodeEntities(text);
  const parts = decoded.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks =
    parts.length > 1
      ? parts
      : decoded.split(/\n/).map((p) => p.trim()).filter(Boolean);
  return chunks.map((p) => `<p>${p}</p>`).join('');
}

export function structuredArticle(html: string, sourceUrl: string) {
  const jsonLd = jsonLdArticle(html);
  const hydration = hydrationArticle(html);

  const candidates: Array<{
    content: string;
    title: string | null;
    date: string | null;
    image: string | null;
    author: string | null;
  }> = [];

  if (jsonLd) {
    candidates.push({
      content: bodyToHtml(jsonLd.articleBody),
      title: jsonLd.headline,
      date: jsonLd.datePublished,
      image: jsonLd.image,
      author: jsonLd.author,
    });
  }
  if (hydration) {
    candidates.push({
      content: bodyToHtml(hydration),
      title: null,
      date: null,
      image: null,
      author: null,
    });
  }
  if (!candidates.length) return null;

  const best = candidates.sort(
    (a, b) => countWords(b.content) - countWords(a.content),
  )[0];
  const content = absolutize(best.content, sourceUrl);

  return articleResult(content, sourceUrl, {
    title: best.title,
    author: best.author,
    datePublished: best.date,
    leadImageUrl: best.image ?? leadImage(content),
  });
}
