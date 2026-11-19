import { normalizeUrl, onHost, siteOf } from './alternates';
import { readSources, writeSources } from './cache';
import {
  bareHost,
  bingSearch,
  gatedHosts,
  headline,
  keywords,
  languageOf,
  marketOf,
  msnHost,
  openHosts,
  similarity,
  slugTitle,
  tokens,
} from './syndication';
import type { Candidate } from './syndication';
import type { RelatedArticle, SourcesResult } from './types';

type SourcesRequest = {
  url: URL;
  title: string | null;
};

const articleLimit = 6;
const perSite = 2;
const minScore = 0.3;
const mirrorScore = 0.65;
const openBoost = 0.3;
const gatedPenalty = 0.5;
const minQueryWords = 2;
const writeReserve = 600;

const openOutlets = [
  ...openHosts,
  'theguardian.com',
  'euronews.com',
  'aljazeera.com',
  'arstechnica.com',
  'techcrunch.com',
];

function searchQuery(url: URL, title: string | null): string {
  return headline(title ?? '') || slugTitle(url) || '';
}

function outletBoost(host: string): number {
  if (onHost(host, openOutlets)) {
    return openBoost;
  }
  return onHost(host, gatedHosts) ? -gatedPenalty : 0;
}

function rankArticles(
  candidates: Candidate[],
  query: string,
  original: URL,
): RelatedArticle[] {
  const language = languageOf(null, query);
  const target = tokens(query, language);
  const originalSite = siteOf(original.hostname);

  const ranked = candidates
    .map((candidate) => {
      const host = bareHost(candidate.url) ?? '';
      const score = similarity(
        target,
        tokens(headline(candidate.title), language),
      );
      return { candidate, host, score, rank: score + outletBoost(host) };
    })
    .filter(({ host, score }) => {
      return (
        host !== '' &&
        score >= minScore &&
        siteOf(host) !== originalSite &&
        !onHost(host, [msnHost])
      );
    })
    .sort((a, b) => b.rank - a.rank);

  const seen = new Set<string>();
  const perHost = new Map<string, number>();
  const articles: RelatedArticle[] = [];
  for (const { candidate, host, score } of ranked) {
    const key = normalizeUrl(candidate.url);
    const site = siteOf(host);
    const count = perHost.get(site) ?? 0;
    if (seen.has(key) || count >= perSite) {
      continue;
    }
    seen.add(key);
    perHost.set(site, count + 1);

    articles.push({
      title: headline(candidate.title),
      url: candidate.url,
      source: candidate.source,
      matchKind: score >= mirrorScore ? 'syndication' : 'coverage',
    });
    if (articles.length === articleLimit) {
      break;
    }
  }
  return articles;
}

async function searchSources(
  request: SourcesRequest,
  timeout: number,
): Promise<SourcesResult> {
  const query = searchQuery(request.url, request.title);
  const language = languageOf(null, query);
  if (tokens(query, language).size < minQueryWords) {
    return { relatedArticles: [] };
  }

  const market = marketOf(request.url, null, language);
  const queries = [...new Set([query, keywords(query, language)])];
  const candidates = await bingSearch(queries, language, market, timeout);
  return { relatedArticles: rankArticles(candidates, query, request.url) };
}

async function lookupSources(
  request: SourcesRequest,
  budget: number,
): Promise<SourcesResult> {
  const started = Date.now();
  const variant = request.title ?? '';
  const cached = await readSources(request.url, variant);
  if (cached) {
    return cached;
  }

  const timeout = budget - (Date.now() - started) - writeReserve;
  const result = await searchSources(request, timeout);
  if (result.relatedArticles.length > 0) {
    await writeSources(request.url, variant, result);
  }
  return result;
}

export { lookupSources };
export type { SourcesRequest };
