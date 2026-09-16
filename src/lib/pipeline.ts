import {
  browserHeaders,
  defaultTimeout,
  fallback,
  fetchDocument,
  fetchGroup,
  fetchWithRetry,
  strategies,
} from './fetcher';
import type { Strategy } from './fetcher';
import { extractArticle, parseWithMercury } from './extractors';
import type { FetchAmp, ParsedArticle } from './extractors';
import { countWords } from './extract';
import { articleResult, parseMarkdown } from './markdown';
import {
  absolutize,
  articleFromFeed,
  articleFromLlms,
  cleanMarkdownSource,
  feedUrls,
  leadImage,
  llmsUrls,
  markdownUrls,
} from './alternates';
import type {
  ParseAttempt,
  ParseEvent,
  ParseMeta,
  ParsedPost,
} from './types';

const archivePending = 'Archive requested, snapshot not ready yet';

type StrategySuccess = {
  kind: 'success';
  parsed: ParsedArticle;
  fetchedUrl: string;
  strategyName: string;
  contentLength: number;
  paywalled: boolean;
  confident: boolean;
};

type StrategyPartial = {
  kind: 'partial';
  parsed: ParsedArticle;
  fetchedUrl: string;
  strategyName: string;
  contentLength: number;
};

type StrategyFailure = {
  kind: 'failure';
  strategyName: string;
  error: string;
};

type StrategyAttempt = StrategySuccess | StrategyPartial | StrategyFailure;

type ParseOptions = {
  readonly strategy: string;
  readonly budget: number;
};

type ParseResult =
  | {
      readonly kind: 'article';
      readonly post: ParsedPost;
      readonly meta: ParseMeta;
      readonly attempts: readonly ParseAttempt[];
      readonly confident: boolean;
    }
  | {
      readonly kind: 'failure';
      readonly error: string;
      readonly suggestion: string;
      readonly url: string;
      readonly attempts: readonly ParseAttempt[];
    };

function ampFetcher(strategy: Strategy, remaining: () => number): FetchAmp {
  return async (href) => {
    const budgetLeft = remaining() - 500;
    if (budgetLeft < 1000) {
      return null;
    }
    const timeout = Math.min(strategy.timeout ?? defaultTimeout, budgetLeft);
    const response = await fetchWithRetry(
      href,
      {
        headers: strategy.headers,
        signal: AbortSignal.timeout(timeout),
        redirect: 'follow',
      },
      remaining,
    );
    if (!response.ok) {
      return null;
    }
    return response.text();
  };
}

async function* tryStrategy(
  url: URL,
  strategy: Strategy,
  remaining: () => number,
): AsyncGenerator<ParseEvent, StrategyAttempt> {
  const fetched = await fetchDocument(url, strategy, remaining);
  if (fetched.kind === 'failed') {
    return {
      kind: 'failure',
      strategyName: strategy.name,
      error: fetched.error,
    };
  }

  try {
    const outcome = yield* extractArticle(
      {
        html: fetched.html,
        url,
        fetchedUrl: fetched.url,
        contentType: fetched.contentType,
      },
      ampFetcher(strategy, remaining),
    );
    if (outcome.kind === 'failure') {
      return {
        kind: 'failure',
        strategyName: strategy.name,
        error: outcome.error,
      };
    }
    if (outcome.kind === 'partial') {
      return {
        kind: 'partial',
        parsed: outcome.parsed,
        fetchedUrl: outcome.fetchedUrl,
        strategyName: strategy.name,
        contentLength: outcome.contentLength,
      };
    }
    return {
      kind: 'success',
      parsed: outcome.parsed,
      fetchedUrl: outcome.fetchedUrl,
      strategyName: strategy.name,
      contentLength: outcome.contentLength,
      paywalled: false,
      confident: outcome.confident,
    };
  } catch (error) {
    return {
      kind: 'failure',
      strategyName: strategy.name,
      error: (error as Error).message,
    };
  }
}

function alternateTimeout(remaining: number): number {
  return Math.min(Math.max(remaining - 500, 0), 2500);
}

function alternateSuccess(
  parsed: ParsedArticle,
  fetchedUrl: string,
  contentLength: number,
): StrategySuccess {
  return {
    kind: 'success',
    parsed,
    fetchedUrl,
    strategyName: 'alternates',
    contentLength,
    paywalled: false,
    confident: true,
  };
}

function parseAlternate(text: string, sourceUrl: string) {
  const parsed = parseMarkdown(cleanMarkdownSource(text), sourceUrl);
  if (parsed.content) {
    parsed.content = absolutize(parsed.content, sourceUrl);
    parsed.lead_image_url = leadImage(parsed.content);
  }
  return parsed;
}

async function tryMarkdownAlternate(url: URL, timeout: number) {
  const headers = { ...browserHeaders, Accept: 'text/markdown, text/plain' };
  const candidates = [url.href, ...markdownUrls(url)];
  const results = await fetchGroup(candidates, headers, timeout);

  for (const fetched of results) {
    const looksMarkdown =
      fetched.contentType.includes('text/markdown') ||
      fetched.url.endsWith('.md');
    if (!looksMarkdown || fetched.text.trimStart().startsWith('<')) {
      continue;
    }
    const parsed = parseAlternate(fetched.text, url.href);
    if (!parsed.content?.trim()) {
      continue;
    }
    return alternateSuccess(parsed, fetched.url, fetched.text.length);
  }
  return null;
}

async function tryFeedAlternate(url: URL, timeout: number) {
  const results = await fetchGroup(feedUrls(url), browserHeaders, timeout);

  for (const fetched of results) {
    const article = articleFromFeed(fetched.text, url.href);
    if (!article) {
      continue;
    }
    const content = absolutize(article.content, url.href);
    const parsed = articleResult(content, url.href, {
      title: article.title,
      datePublished: article.datePublished,
      leadImageUrl: leadImage(content),
    });
    return alternateSuccess(parsed, fetched.url, fetched.text.length);
  }
  return null;
}

async function tryLlmsAlternate(url: URL, timeout: number) {
  const results = await fetchGroup(llmsUrls(url), browserHeaders, timeout);

  for (const fetched of results) {
    const article = articleFromLlms(fetched.text, url.href);
    if (!article) {
      continue;
    }
    const parsed = parseAlternate(article.body, url.href);
    if (!parsed.content?.trim()) {
      continue;
    }
    parsed.title = article.title;
    return alternateSuccess(parsed, fetched.url, fetched.text.length);
  }
  return null;
}

async function tryAlternates(
  url: URL,
  remaining: () => number,
): Promise<StrategyAttempt> {
  const timeout = alternateTimeout(remaining());
  if (timeout >= 800) {
    const [markdown, feed, llms] = await Promise.all([
      tryMarkdownAlternate(url, timeout),
      tryFeedAlternate(url, timeout),
      tryLlmsAlternate(url, timeout),
    ]);
    const found = markdown ?? feed ?? llms;
    if (found) {
      return found;
    }
  }

  return {
    kind: 'failure',
    strategyName: 'alternates',
    error: 'No alternate representation found',
  };
}

async function trySavePage(
  url: URL,
  remaining: () => number,
): Promise<StrategyAttempt> {
  const timeout = Math.min(remaining() - 500, 8000);
  if (timeout < 1000) {
    return {
      kind: 'failure',
      strategyName: 'savepage',
      error: 'No time left to request an archive',
    };
  }

  try {
    const response = await fetch(`https://web.archive.org/save/${url.href}`, {
      headers: { 'User-Agent': browserHeaders['User-Agent'] },
      signal: AbortSignal.timeout(timeout),
      redirect: 'follow',
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const text = await response.text();
    const parsed = await parseWithMercury(url.href, text);
    if (!parsed.content?.trim()) {
      throw new Error(archivePending);
    }
    return {
      kind: 'success',
      parsed,
      fetchedUrl: response.url,
      strategyName: 'savepage',
      contentLength: text.length,
      paywalled: false,
      confident: true,
    };
  } catch (error) {
    const { name, message } = error as Error;
    const pending = name === 'TimeoutError' || message === archivePending;
    return {
      kind: 'failure',
      strategyName: 'savepage',
      error: pending ? archivePending : `Archive request failed: ${message}`,
    };
  }
}

async function* runStep(
  name: string,
  url: URL,
  remaining: () => number,
): AsyncGenerator<ParseEvent, StrategyAttempt> {
  if (name === 'alternates') {
    return await tryAlternates(url, remaining);
  }
  if (name === 'savepage') {
    return await trySavePage(url, remaining);
  }
  const strategy = strategies.find((s) => s.name === name) ?? fallback;
  return yield* tryStrategy(url, strategy, remaining);
}

function* record(
  attempts: ParseAttempt[],
  attempt: ParseAttempt,
): Generator<ParseEvent> {
  attempts.push(attempt);
  yield { type: 'attempt', attempt };
}

function* skipFrom(
  attempts: ParseAttempt[],
  steps: readonly string[],
  from: number,
  reason: string,
): Generator<ParseEvent> {
  for (const step of steps.slice(from)) {
    yield* record(attempts, { step, status: 'skipped', reason });
  }
}

function plan(url: URL, strategy: string) {
  if (strategy !== 'auto') {
    return { steps: [strategy], directSteps: new Set<string>() };
  }
  const direct = strategies.filter((s) => s.name !== 'wayback');
  const primary = direct.find((s) => s.matches(url)) ?? fallback;
  const ordered = [primary, ...direct.filter((s) => s !== primary)];
  return {
    steps: [...ordered.map((s) => s.name), 'alternates', 'wayback'],
    directSteps: new Set(ordered.map((s) => s.name)),
  };
}

async function* runParse(
  url: URL,
  options: ParseOptions,
): AsyncGenerator<ParseEvent, ParseResult> {
  const started = Date.now();
  const remaining = () => options.budget - (Date.now() - started);
  const { steps, directSteps } = plan(url, options.strategy);

  let bestPartial: StrategyPartial | null = null;
  let firstFailure: StrategyFailure | null = null;
  let botChallengeDetected = false;
  let archiveRequested = false;
  let notFound = false;

  const attempts: ParseAttempt[] = [];

  for (const [position, step] of steps.entries()) {
    if (step === 'savepage' && notFound) {
      yield* skipFrom(attempts, steps, position, 'Source returned 404 or 410');
      break;
    }
    if (remaining() < 500) {
      yield* skipFrom(attempts, steps, position, 'Ran out of time');
      break;
    }
    if (bestPartial && directSteps.has(step)) {
      yield* record(attempts, {
        step,
        status: 'skipped',
        reason: 'A paywalled copy was already recovered',
      });
      continue;
    }

    yield { type: 'step', step, at: Date.now() - started };
    const stepStarted = Date.now();
    const result = yield* runStep(step, url, remaining);
    const ms = Date.now() - stepStarted;

    if (result.kind === 'success') {
      yield* record(attempts, {
        step,
        status: 'success',
        ms,
        words: result.parsed.word_count ?? countWords(result.parsed.content),
      });
      return {
        kind: 'article',
        post: result.parsed,
        meta: {
          originalUrl: url.href,
          fetchedUrl: result.fetchedUrl,
          strategy: result.strategyName,
          contentLength: result.contentLength,
          paywalled: result.paywalled,
          source: 'live',
        },
        attempts,
        confident: result.confident,
      };
    }

    if (result.kind === 'partial') {
      yield* record(attempts, { step, status: 'partial', ms });
      if (!bestPartial) {
        bestPartial = result;
      }
      continue;
    }

    yield* record(attempts, { step, status: 'failure', error: result.error, ms });
    if (result.error === 'Bot challenge detected') {
      botChallengeDetected = true;
    }
    if (result.error === archivePending) {
      archiveRequested = true;
    }
    if (/^HTTP (404|410)$/.test(result.error)) {
      notFound = true;
    }
    console.warn(`Strategy '${result.strategyName}' failed:`, result.error);
    if (!firstFailure) {
      firstFailure = result;
    }
  }

  if (bestPartial) {
    return {
      kind: 'article',
      post: bestPartial.parsed,
      meta: {
        originalUrl: url.href,
        fetchedUrl: bestPartial.fetchedUrl,
        strategy: bestPartial.strategyName,
        contentLength: bestPartial.contentLength,
        paywalled: true,
        source: 'live',
      },
      attempts,
      confident: false,
    };
  }

  let suggestion =
    'Try accessing the article via one of the archive links below.';
  if (archiveRequested) {
    suggestion =
      'An archive of this page has been requested. Try again in a minute.';
  } else if (botChallengeDetected) {
    suggestion =
      'This page blocked automated access. Try an archived version below.';
  }

  return {
    kind: 'failure',
    error: firstFailure?.error ?? 'All strategies failed.',
    suggestion,
    url: url.href,
    attempts,
  };
}

async function drain<T>(generator: AsyncGenerator<unknown, T>): Promise<T> {
  let next = await generator.next();
  while (!next.done) {
    next = await generator.next();
  }
  return next.value;
}

export { runParse, drain };
export type { ParseOptions, ParseResult };
