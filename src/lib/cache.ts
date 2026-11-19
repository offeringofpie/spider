import { getStore } from '@netlify/blobs';
import { createHash } from 'node:crypto';
import { normalizeUrl } from './alternates';
import type { ParseAttempt, ParseResult, SourcesResult } from './types';

const version = 'v1';
const readTimeout = 400;
const writeTimeout = 600;
const digestLength = 22;
const parsedStore = 'spider-parsed';
const statsStore = 'spider-host-stats';
const sourcesStore = 'spider-sources';

const ttl = {
  confident: 24 * 60 * 60 * 1000,
  partial: 60 * 60 * 1000,
  failure: 5 * 60 * 1000,
  retained: 7 * 24 * 60 * 60 * 1000,
  sources: 6 * 60 * 60 * 1000,
} as const;

type CacheRecord = {
  readonly expires: number;
  readonly result: ParseResult;
};

type SourcesRecord = {
  expires: number;
  result: SourcesResult;
};

type AttemptLog = {
  readonly host: string;
  readonly url: string;
  readonly at: string;
  readonly ms: number;
  readonly outcome: 'success' | 'partial' | 'failure';
  readonly winner: string | null;
  readonly attempts: readonly ParseAttempt[];
};

type StepStats = {
  runs: number;
  wins: number;
  ms: number;
};

type HostStats = Record<string, StepStats>;

function store(name: string) {
  try {
    return getStore({ name, consistency: 'eventual' });
  } catch {
    return null;
  }
}

async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  try {
    return await Promise.race([work, limit]);
  } finally {
    clearTimeout(timer);
  }
}

async function readJson<T>(name: string, key: string): Promise<T | null> {
  const blobs = store(name);
  if (!blobs) {
    return null;
  }

  return (await withTimeout(
    blobs.get(key, { type: 'json' }).catch(() => null),
    readTimeout,
  )) as T | null;
}

async function writeJson(
  name: string,
  key: string,
  value: unknown,
): Promise<void> {
  const blobs = store(name);
  if (!blobs) {
    return;
  }

  await withTimeout(blobs.setJSON(key, value).catch(() => null), writeTimeout);
}

function resultKey(url: URL, variant = ''): string {
  const digest = createHash('sha256')
    .update(normalizeUrl(url.href) + variant)
    .digest('base64url')
    .slice(0, digestLength);
  return `${version}/${url.hostname}/${digest}`;
}

function lifetime(result: ParseResult): number {
  if (result.kind === 'failure') {
    return ttl.failure;
  }
  return result.confident ? ttl.confident : ttl.partial;
}

function fullText(result: ParseResult): boolean {
  return (
    result.kind === 'article' && result.confident && !result.meta.paywalled
  );
}

async function readResult(url: URL): Promise<ParseResult | null> {
  const record = await readJson<CacheRecord>(parsedStore, resultKey(url));
  if (!record || record.expires < Date.now()) {
    return null;
  }
  if (record.result.kind !== 'article') {
    return record.result;
  }
  return {
    ...record.result,
    meta: { ...record.result.meta, source: 'cache' },
  };
}

async function writeResult(url: URL, result: ParseResult): Promise<void> {
  const key = resultKey(url);
  const existing = fullText(result)
    ? null
    : await readJson<CacheRecord>(parsedStore, key);

  const record: CacheRecord =
    existing && fullText(existing.result)
      ? { expires: Date.now() + ttl.retained, result: existing.result }
      : { expires: Date.now() + lifetime(result), result };
  await writeJson(parsedStore, key, record);
}

async function readSources(
  url: URL,
  variant: string,
): Promise<SourcesResult | null> {
  const key = resultKey(url, variant);
  const record = await readJson<SourcesRecord>(sourcesStore, key);
  if (!record || record.expires < Date.now()) {
    return null;
  }
  return record.result;
}

async function writeSources(
  url: URL,
  variant: string,
  result: SourcesResult,
): Promise<void> {
  const record: SourcesRecord = { expires: Date.now() + ttl.sources, result };
  await writeJson(sourcesStore, resultKey(url, variant), record);
}

async function readHostStats(host: string): Promise<HostStats | null> {
  return readJson<HostStats>(statsStore, `${version}/${host}`);
}

async function writeHostStats(
  host: string,
  previous: HostStats | null,
  result: ParseResult,
): Promise<void> {
  const stats: HostStats = { ...previous };
  for (const attempt of result.attempts) {
    if (attempt.status === 'skipped') {
      continue;
    }
    const step = stats[attempt.step] ?? { runs: 0, wins: 0, ms: 0 };
    const runs = step.runs + 1;
    stats[attempt.step] = {
      runs,
      wins: attempt.status === 'success' ? step.wins + 1 : step.wins,
      ms: Math.round(step.ms + (attempt.ms - step.ms) / runs),
    };
  }
  await writeJson(statsStore, `${version}/${host}`, stats);
}

async function writeLog(url: URL, log: AttemptLog): Promise<void> {
  const blobs = store('spider-attempts');
  if (!blobs) {
    return;
  }

  const day = new Date().toISOString().slice(0, 10);
  const suffix = Math.random().toString(36).slice(2, 8);
  const key = `${version}/${url.hostname}/${day}/${Date.now()}-${suffix}`;
  await withTimeout(blobs.setJSON(key, log).catch(() => null), writeTimeout);
}

export {
  readResult,
  writeResult,
  writeLog,
  readHostStats,
  writeHostStats,
  readSources,
  writeSources,
};
export type { AttemptLog, HostStats };
