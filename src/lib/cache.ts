import { getStore } from '@netlify/blobs';
import { createHash } from 'node:crypto';
import { normalizeUrl } from './alternates';
import type { ParseAttempt, ParseResult } from './types';

const version = 'v1';
const readTimeout = 400;
const writeTimeout = 600;
const digestLength = 22;

const ttl = {
  confident: 24 * 60 * 60 * 1000,
  partial: 60 * 60 * 1000,
  failure: 5 * 60 * 1000,
} as const;

type CacheRecord = {
  readonly expires: number;
  readonly result: ParseResult;
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

function resultKey(url: URL): string {
  const digest = createHash('sha256')
    .update(normalizeUrl(url.href))
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

async function readResult(url: URL): Promise<ParseResult | null> {
  const blobs = store('spider-parsed');
  if (!blobs) {
    return null;
  }

  const record = (await withTimeout(
    blobs.get(resultKey(url), { type: 'json' }).catch(() => null),
    readTimeout,
  )) as CacheRecord | null;

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
  const blobs = store('spider-parsed');
  if (!blobs) {
    return;
  }

  const record: CacheRecord = {
    expires: Date.now() + lifetime(result),
    result,
  };
  await withTimeout(
    blobs.setJSON(resultKey(url), record).catch(() => null),
    writeTimeout,
  );
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

export { readResult, writeResult, writeLog };
export type { AttemptLog };
