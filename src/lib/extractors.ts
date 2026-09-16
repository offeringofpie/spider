import Parser from '@jocmp/mercury-parser';
import { preserveMediaEmbeds, restoreMediaEmbeds } from './embed';
import {
  lazyLoadImages,
  normalizeImages,
  sanitize,
  stripOddSchemes,
  stripHeadingAttrs,
  stripNoise,
} from './clean';
import {
  ampUrl,
  countWords,
  extractDataRaw,
  htmlLang,
  metaDescription,
  paywallTeaser,
  titleFromHtml,
} from './extract';
import { botChallenge, paywall } from './detect';
import { structuredArticle } from './structured';
import { parseWithDefuddle } from './defuddle';
import { isMarkdown, parseMarkdown } from './markdown';
import type { ParseEvent } from './types';

const confidentWords = 200;
const recoverWords = 150;
const minWords = 25;
const truncationRatio = 1.5;

type ParsedArticle = Awaited<ReturnType<typeof Parser.parse>>;

type FetchAmp = (href: string) => Promise<string | null>;

type ExtractInput = {
  readonly html: string;
  readonly url: URL;
  readonly fetchedUrl: string;
  readonly contentType: string;
};

type ExtractOutcome =
  | {
      readonly kind: 'success';
      readonly parsed: ParsedArticle;
      readonly fetchedUrl: string;
      readonly contentLength: number;
      readonly confident: boolean;
    }
  | {
      readonly kind: 'partial';
      readonly parsed: ParsedArticle;
      readonly fetchedUrl: string;
      readonly contentLength: number;
    }
  | { readonly kind: 'failure'; readonly error: string };

async function parseWithMercury(sourceUrl: string, html: string) {
  const parsed = await Parser.parse(sourceUrl, {
    html: stripHeadingAttrs(
      stripOddSchemes(preserveMediaEmbeds(normalizeImages(stripNoise(html)))),
    ),
    contentType: 'html',
    fetchAllPages: false,
  });
  if (parsed.content) {
    parsed.content = sanitize(
      lazyLoadImages(restoreMediaEmbeds(parsed.content)),
    );
  }
  return parsed;
}

function withLang<T>(parsed: T, lang: string | null): T {
  if (parsed && lang) {
    (parsed as { lang?: string | null }).lang ??= lang;
  }
  return parsed;
}

function found(
  parsed: ParsedArticle,
  fetchedUrl: string,
  contentLength: number,
  confident: boolean,
): ExtractOutcome {
  return { kind: 'success', parsed, fetchedUrl, contentLength, confident };
}

async function tryAmp(url: URL, html: string, fetchAmp: FetchAmp) {
  const ampHref = ampUrl(html, url);
  if (!ampHref) {
    return null;
  }
  const ampText = await fetchAmp(ampHref);
  if (!ampText) {
    return null;
  }
  const ampParsed = await parseWithMercury(ampHref, ampText);
  if (!ampParsed.content?.trim()) {
    return null;
  }
  if (paywall(ampText, countWords(ampParsed.content))) {
    return null;
  }
  return {
    parsed: ampParsed,
    fetchedUrl: ampHref,
    contentLength: ampText.length,
  };
}

async function* extractArticle(
  input: ExtractInput,
  fetchAmp: FetchAmp,
): AsyncGenerator<ParseEvent, ExtractOutcome> {
  const { html, url, fetchedUrl, contentType } = input;

  if (isMarkdown(url, contentType)) {
    const parsed = parseMarkdown(html, url.href);
    if (!parsed.content?.trim()) {
      return { kind: 'failure', error: 'Empty content after parsing' };
    }
    return found(parsed, fetchedUrl, html.length, true);
  }

  const lang = htmlLang(html);
  const parsed = withLang(await parseWithMercury(url.href, html), lang);

  if (botChallenge(html, parsed.title ?? null)) {
    return { kind: 'failure', error: 'Bot challenge detected' };
  }

  const mercuryContent = parsed.content?.trim();
  const mercuryWords = countWords(parsed.content);
  const paywallDetected = paywall(html, mercuryWords);

  const structured = withLang(structuredArticle(html, url.href), lang);
  const structuredWords = countWords(structured?.content);
  if (
    structured &&
    structuredWords >= recoverWords &&
    structuredWords >= mercuryWords * truncationRatio &&
    (structuredWords >= confidentWords || !paywallDetected)
  ) {
    if (!structured.title) {
      structured.title = parsed.title ?? titleFromHtml(html);
    }
    if (!structured.dek) {
      structured.dek = metaDescription(html);
    }
    return found(structured, fetchedUrl, html.length, true);
  }

  if (mercuryContent && mercuryWords >= minWords && !paywallDetected) {
    return found(
      parsed,
      fetchedUrl,
      html.length,
      mercuryWords >= confidentWords,
    );
  }

  if (paywallDetected) {
    const amp = await tryAmp(url, html, fetchAmp);
    if (amp) {
      return found(amp.parsed, amp.fetchedUrl, amp.contentLength, true);
    }
  }

  if (!mercuryContent || mercuryWords < confidentWords) {
    const defuddled = withLang(await parseWithDefuddle(html, url.href), lang);
    const defuddleWords = countWords(defuddled?.content);
    if (
      defuddled &&
      defuddleWords >= recoverWords &&
      defuddleWords > mercuryWords &&
      (defuddleWords >= confidentWords || !paywallDetected)
    ) {
      return found(defuddled, fetchedUrl, html.length, true);
    }
  }

  const rawMd = extractDataRaw(html);
  if (rawMd) {
    const mdParsed = withLang(parseMarkdown(rawMd, url.href), lang);
    if (mdParsed.content?.trim()) {
      if (!mdParsed.title) {
        mdParsed.title = titleFromHtml(html);
      }
      return found(mdParsed, fetchedUrl, html.length, true);
    }
  }

  if (paywallDetected) {
    if (structured && structuredWords > mercuryWords) {
      if (!structured.title) {
        structured.title = parsed.title ?? titleFromHtml(html);
      }
      if (!structured.dek) {
        structured.dek = metaDescription(html);
      }
      return {
        kind: 'partial',
        parsed: structured,
        fetchedUrl,
        contentLength: html.length,
      };
    }
    if (mercuryContent) {
      if (!parsed.dek) {
        parsed.dek = metaDescription(html);
      }
      const teaser = paywallTeaser(html);
      if (teaser) {
        parsed.content = teaser;
      }
      return {
        kind: 'partial',
        parsed,
        fetchedUrl,
        contentLength: html.length,
      };
    }
  }

  return {
    kind: 'failure',
    error: paywallDetected ? 'Paywall detected' : 'Empty content after parsing',
  };
}

export { extractArticle, parseWithMercury };
export type { ParsedArticle, ExtractInput, ExtractOutcome, FetchAmp };
