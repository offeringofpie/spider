import {
  browserHeaders,
  defaultTimeout,
  fallback,
  fetchDocument,
  fetchGroup,
} from './fetcher';
import { extractArticle } from './extractors';
import type { ParsedArticle } from './extractors';
import { countWords, decodeEntities } from './extract';
import { onHost } from './alternates';
import { articleResult } from './markdown';
import type { Alternative, ParseEvent } from './types';

type SyndicationMeta = {
  url: URL;
  title: string | null;
  author: string | null;
  datePublished: string | null;
  lang: string | null;
};

type Language = 'en' | 'nl' | 'fr' | 'pt';

type Candidate = Alternative & { published: number | null };

type Scored = Candidate & { score: number };

type Mirror = {
  parsed: ParsedArticle;
  fetchedUrl: string;
  contentLength: number;
};

type Syndication = {
  mirror: Mirror | null;
  alternatives: Alternative[];
};

type GdeltResponse = {
  articles?: {
    url?: string;
    title?: string;
    seendate?: string;
    domain?: string;
  }[];
};

type MsnDetail = {
  title?: string;
  body?: string;
  publishedDateTime?: string;
  authors?: { name?: string }[];
  imageResources?: { url?: string }[];
};

const searchCap = 1800;
const minSearch = 500;
const minHeadlineWords = 3;
const searchKeywords = 6;
const mirrorScore = 0.8;
const relatedScore = 0.4;
const alternativeLimit = 4;
const publicationWindow = 3 * 24 * 60 * 60 * 1000;
const fullWords = 200;
const msnHost = 'msn.com';
const msnArticlePath = /^\/([a-z]{2}-[a-z]{2})\/.*\/ar-([A-Za-z0-9]+)/;
const msnMedia =
  /<img\b[^>]*data-document-id="cms\/api\/amp\/(image|video)\/([A-Za-z0-9]+)"[^>]*>/gi;

const openHosts = [
  'yahoo.com',
  'msn.com',
  'apnews.com',
  'reuters.com',
  'bbc.com',
  'bbc.co.uk',
  'npr.org',
  'pbs.org',
  'cbc.ca',
  'abc.net.au',
  'sbs.com.au',
  'rnz.co.nz',
  'rte.ie',
  'dw.com',
  'france24.com',
  'swissinfo.ch',
  'nhk.or.jp',
  'rtp.pt',
  'sapo.pt',
  'noticiasaominuto.com',
  'vrt.be',
  'rtbf.be',
  'belganewsagency.eu',
];

const gatedHosts = [
  'nytimes.com',
  'wsj.com',
  'ft.com',
  'economist.com',
  'bloomberg.com',
  'washingtonpost.com',
  'barrons.com',
  'thetimes.com',
  'thetimes.co.uk',
  'telegraph.co.uk',
  'theathletic.com',
  'newyorker.com',
  'theatlantic.com',
  'businessinsider.com',
  'hbr.org',
  'foreignaffairs.com',
  'theinformation.com',
  'nikkei.com',
  'lemonde.fr',
  'spiegel.de',
  'faz.net',
  'nzz.ch',
  'haaretz.com',
  'latimes.com',
  'bostonglobe.com',
  'seekingalpha.com',
  'hln.be',
  'demorgen.be',
  'standaard.be',
  'nieuwsblad.be',
  'gva.be',
  'hbvl.be',
  'tijd.be',
  'lecho.be',
];

const languages: Language[] = ['en', 'nl', 'fr', 'pt'];

const stopwords: Record<Language, Set<string>> = {
  en: new Set(
    'the a an and or of to in on at by for with from as is are was were has have had its it that this into over after about will says said how why what who new not but amid'.split(
      ' ',
    ),
  ),
  nl: new Set(
    'de het een en of van voor op in met na bij is zijn om te aan als dat die niet nog ook over zo zou maar door naar uit wat wie waarom hoe er tot wil wordt worden'.split(
      ' ',
    ),
  ),
  fr: new Set(
    'le la les un une des du de et ou en au aux pour dans sur par avec que qui est sont ne pas plus se son sa ses ce cette il elle selon apres'.split(
      ' ',
    ),
  ),
  pt: new Set(
    'o a os as um uma de do da dos das em no na nos nas para por com que se ao aos e mais sobre apos diz pelo pela como sem'.split(
      ' ',
    ),
  ),
};

const markets = new Set([
  'en-GB',
  'en-US',
  'nl-BE',
  'nl-NL',
  'fr-BE',
  'fr-FR',
  'pt-PT',
  'pt-BR',
]);

const defaultMarkets: Record<Language, string> = {
  en: 'en-GB',
  nl: 'nl-NL',
  fr: 'fr-FR',
  pt: 'pt-PT',
};

function words(text: string): string[] {
  const found = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .match(/[\p{L}\p{N}]+/gu);
  return found ?? [];
}

function tokens(text: string, language: Language): Set<string> {
  return new Set(
    words(text).filter(
      (word) => word.length > 2 && !stopwords[language].has(word),
    ),
  );
}

function languageOf(lang: string | null, title: string): Language {
  const declared = languages.find((language) => {
    return lang?.toLowerCase().startsWith(language);
  });
  if (declared) {
    return declared;
  }

  const titleWords = words(title);
  let best: Language = 'en';
  let hits = 0;
  for (const language of languages) {
    const count = titleWords.filter((word) => {
      return stopwords[language].has(word);
    }).length;
    if (count > hits) {
      best = language;
      hits = count;
    }
  }
  return best;
}

function marketOf(url: URL, lang: string | null, language: Language): string {
  const region = lang?.split('-')[1] ?? url.hostname.split('.').pop() ?? '';
  const market = `${language}-${region.toUpperCase()}`;
  return markets.has(market) ? market : defaultMarkets[language];
}

function similarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) {
    return 0;
  }

  let shared = 0;
  for (const word of a) {
    if (b.has(word)) {
      shared++;
    }
  }
  return (2 * shared) / (a.size + b.size);
}

function headline(title: string): string {
  return title.replace(/\s+[|–—-]\s+[^|–—-]{1,40}$/, '').trim();
}

function slugTitle(url: URL): string | null {
  let words: string[] = [];
  for (const segment of url.pathname.split('/')) {
    const found = segment
      .replace(/\.[a-z]+$/i, '')
      .split(/[-_]+/)
      .filter((word) => word && !/\d/.test(word));
    if (found.length >= words.length) {
      words = found;
    }
  }
  return words.length > 0 ? words.join(' ') : null;
}

function bareHost(href: string): string | null {
  try {
    return new URL(href).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function timeOf(value: string | null | undefined): number | null {
  const time = Date.parse(value ?? '');
  return Number.isNaN(time) ? null : time;
}

function itemTag(item: string, tag: string): string | null {
  const text = item.match(new RegExp(`<${tag}\\b[^>]*>([^<]*)</${tag}>`))?.[1];
  return text ? decodeEntities(text).trim() : null;
}

function bingLink(link: string): string | null {
  try {
    const url = new URL(link);
    return url.hostname.endsWith('bing.com')
      ? url.searchParams.get('url')
      : url.href;
  } catch {
    return null;
  }
}

function bingCandidates(xml: string): Candidate[] {
  const candidates: Candidate[] = [];
  for (const [item] of xml.matchAll(/<item>[\s\S]*?<\/item>/g)) {
    const url = bingLink(itemTag(item, 'link') ?? '');
    const title = itemTag(item, 'title');
    if (!url || !title) {
      continue;
    }
    candidates.push({
      title,
      url,
      source: itemTag(item, 'News:Source') ?? bareHost(url) ?? url,
      published: timeOf(itemTag(item, 'pubDate')),
    });
  }
  return candidates;
}

function gdeltCandidates(text: string): Candidate[] {
  let data: GdeltResponse | null;
  try {
    data = JSON.parse(text) as GdeltResponse | null;
  } catch {
    return [];
  }

  const candidates: Candidate[] = [];
  for (const article of data?.articles ?? []) {
    if (typeof article.url !== 'string' || typeof article.title !== 'string') {
      continue;
    }
    const seen = article.seendate?.replace(
      /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/,
      '$1-$2-$3T$4:$5:$6Z',
    );
    candidates.push({
      title: article.title,
      url: article.url,
      source: article.domain ?? bareHost(article.url) ?? article.url,
      published: timeOf(seen),
    });
  }
  return candidates;
}

function keywords(title: string, language: Language): string {
  return [...tokens(title, language)].slice(0, searchKeywords).join(' ');
}

async function bingSearch(
  queries: string[],
  language: Language,
  market: string,
  timeout: number,
): Promise<Candidate[]> {
  const urls = queries.map((query) => {
    return `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=rss&mkt=${market}`;
  });
  const headers = {
    ...browserHeaders,
    'Accept-Language': `${market},${language};q=0.9`,
  };
  const results = await fetchGroup(urls, headers, timeout);
  return results.flatMap((fetched) => bingCandidates(fetched.text));
}

async function search(
  title: string,
  language: Language,
  market: string,
  timeout: number,
): Promise<Candidate[]> {
  const terms = keywords(title, language);
  const [bing, gdelt] = await Promise.all([
    bingSearch([title, terms], language, market, timeout),
    fetchGroup(
      [
        `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(terms)}&mode=ArtList&format=json&maxrecords=10`,
      ],
      browserHeaders,
      timeout,
    ),
  ]);
  return [
    ...bing,
    ...gdelt.flatMap((fetched) => gdeltCandidates(fetched.text)),
  ];
}

function related(scored: Scored[], mirror: Scored | undefined): Alternative[] {
  const hosts = new Set<string>();
  const alternatives: Alternative[] = [];
  for (const candidate of scored) {
    if (candidate === mirror || candidate.score < relatedScore) {
      continue;
    }
    const host = bareHost(candidate.url) ?? candidate.url;
    if (hosts.has(host) || onHost(host, [msnHost])) {
      continue;
    }
    hosts.add(host);
    alternatives.push({
      title: headline(candidate.title),
      url: candidate.url,
      source: candidate.source,
    });
    if (alternatives.length === alternativeLimit) {
      break;
    }
  }
  return alternatives;
}

function corroborated(
  meta: SyndicationMeta,
  candidate: Candidate,
  mirror: ParsedArticle,
  language: Language,
): boolean {
  const original = timeOf(meta.datePublished);
  const copied = candidate.published ?? timeOf(mirror.date_published);
  if (original !== null && copied !== null) {
    if (Math.abs(original - copied) <= publicationWindow) {
      return true;
    }
  }
  if (meta.author && mirror.author) {
    return (
      similarity(tokens(meta.author, language), tokens(mirror.author, language)) >
      0
    );
  }
  return original === null || copied === null;
}

async function msnMirror(
  url: URL,
  remaining: () => number,
): Promise<Mirror | null> {
  const [, locale, id] = url.pathname.match(msnArticlePath) ?? [];
  const timeout = Math.min(defaultTimeout, remaining() - 500);
  if (!locale || !id || timeout < 1000) {
    return null;
  }

  const [fetched] = await fetchGroup(
    [`https://assets.msn.com/content/view/v2/Detail/${locale}/${id}`],
    browserHeaders,
    timeout,
  );
  let detail: MsnDetail | null;
  try {
    detail = JSON.parse(fetched?.text ?? '') as MsnDetail | null;
  } catch {
    return null;
  }
  if (typeof detail?.body !== 'string' || countWords(detail.body) < fullWords) {
    return null;
  }

  const authors = (detail.authors ?? [])
    .map((author) => author.name)
    .filter(Boolean);
  const body = detail.body.replace(msnMedia, (_, kind: string, id: string) => {
    if (kind === 'video') {
      return '';
    }
    return `<img src="https://img-s-msn-com.akamaized.net/tenant/amp/entityid/${id}.img">`;
  });
  const parsed = articleResult(body, url.href, {
    title: detail.title ?? null,
    author: authors.length > 0 ? authors.join(', ') : null,
    datePublished: detail.publishedDateTime ?? null,
    leadImageUrl: detail.imageResources?.[0]?.url ?? null,
  });
  return { parsed, fetchedUrl: url.href, contentLength: fetched.text.length };
}

async function* fetchMirror(
  candidate: Candidate,
  remaining: () => number,
): AsyncGenerator<ParseEvent, Mirror | null> {
  const url = new URL(candidate.url);
  if (onHost(bareHost(url.href) ?? '', [msnHost])) {
    return await msnMirror(url, remaining);
  }

  const fetched = await fetchDocument(url, fallback, remaining);
  if (fetched.kind === 'failed') {
    return null;
  }

  try {
    const outcome = yield* extractArticle(
      {
        html: fetched.html,
        url,
        fetchedUrl: fetched.url,
        contentType: fetched.contentType,
      },
      async () => null,
    );
    if (outcome.kind !== 'success' || !outcome.confident) {
      return null;
    }
    return {
      parsed: outcome.parsed,
      fetchedUrl: outcome.fetchedUrl,
      contentLength: outcome.contentLength,
    };
  } catch {
    return null;
  }
}

async function* resolveSyndication(
  meta: SyndicationMeta,
  remaining: () => number,
): AsyncGenerator<ParseEvent, Syndication> {
  const title = headline(meta.title ?? slugTitle(meta.url) ?? '');
  const language = languageOf(meta.lang, title);
  const target = tokens(title, language);
  const timeout = Math.min(searchCap, remaining() - minSearch);
  if (target.size < minHeadlineWords || timeout < minSearch) {
    return { mirror: null, alternatives: [] };
  }

  const original = bareHost(meta.url.href);
  const market = marketOf(meta.url, meta.lang, language);
  const scored = (await search(title, language, market, timeout))
    .filter((candidate) => {
      const host = bareHost(candidate.url);
      return host !== null && host !== original && !onHost(host, gatedHosts);
    })
    .map((candidate) => {
      const candidateTitle = tokens(headline(candidate.title), language);
      const score = similarity(target, candidateTitle);
      return { ...candidate, score };
    })
    .sort((a, b) => b.score - a.score);

  const top = scored.find(
    (candidate) =>
      candidate.score >= mirrorScore &&
      onHost(bareHost(candidate.url) ?? '', openHosts),
  );
  const alternatives = related(scored, top);
  if (!top) {
    return { mirror: null, alternatives };
  }

  const mirror = yield* fetchMirror(top, remaining);
  if (!mirror || !corroborated(meta, top, mirror.parsed, language)) {
    return { mirror: null, alternatives };
  }
  const mirrorTitle = tokens(headline(mirror.parsed.title ?? title), language);
  if (similarity(target, mirrorTitle) < mirrorScore) {
    return { mirror: null, alternatives };
  }
  return { mirror, alternatives };
}

export {
  resolveSyndication,
  bingSearch,
  keywords,
  tokens,
  similarity,
  headline,
  slugTitle,
  bareHost,
  languageOf,
  marketOf,
  openHosts,
  gatedHosts,
  msnHost,
};
export type { Candidate };
