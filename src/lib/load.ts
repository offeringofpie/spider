import { defaultStore } from '../store/store';
import type { DocumentState, LoadedDoc } from '../store/store';
import { readEvents } from './stream';
import { eraParam, eraValue } from './era';
import type { ParseAttempt, ParseMeta, ParsedPost } from './types';

type HistoryMode = 'push' | 'replace' | 'none';
type LoadMode = 'interactive' | 'speculative';

type LoadOptions = {
  readonly forceRefresh?: boolean;
  readonly history?: HistoryMode;
  readonly strategy?: string;
  readonly mode?: LoadMode;
};

type Pending = {
  readonly url: string;
  readonly controller: AbortController;
  mode: LoadMode;
  last: DocumentState | null;
};

const warmLimit = 5;
const warm = new Map<string, LoadedDoc>();
let pending: Pending | null = null;

const logAttempts = (
  url: string,
  attempts: readonly ParseAttempt[],
): void => {
  if (attempts.length === 0) {
    return;
  }
  console.groupCollapsed(`Spider parsed ${url} in ${attempts.length} steps`);
  console.table(attempts);
  console.groupEnd();
};

const adoptPayload = (): boolean => {
  const node = document.getElementById('parse-payload');
  if (!node?.textContent) {
    return false;
  }
  node.remove();

  try {
    const { post, meta } = JSON.parse(node.textContent) as {
      post: ParsedPost;
      meta: ParseMeta;
    };
    defaultStore.setState({
      document: {
        kind: 'loaded',
        post,
        leadImageUrl: post.lead_image_url ?? null,
        paywalled: meta.paywalled,
        stage: 'final',
      },
    });
    return true;
  } catch {
    return false;
  }
};

const isUrl = (value: string): boolean => {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

const currentQuery = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  return new URLSearchParams(window.location.search).get('q');
};

const urlFromShare = (params: URLSearchParams): string | null => {
  const q = params.get('q');
  if (q && isUrl(q)) {
    return q;
  }

  const text = params.get('text');
  const match = text?.match(/https?:\/\/\S+/);
  return match ? match[0] : null;
};

const remember = (url: string, doc: LoadedDoc): void => {
  warm.delete(url);
  warm.set(url, doc);
  for (const oldest of warm.keys()) {
    if (warm.size <= warmLimit) {
      break;
    }
    warm.delete(oldest);
  }
};

const applyHistory = (url: string, mode: HistoryMode): void => {
  const current = new URLSearchParams(window.location.search);
  const era =
    current.get(eraParam) === eraValue ? `&${eraParam}=${eraValue}` : '';
  const target = `?q=${encodeURIComponent(url)}${era}`;
  if (mode === 'push') {
    history.pushState({ q: url }, '', target);
  }
  if (mode === 'replace') {
    history.replaceState({ q: url }, '', target);
  }
};

async function run(
  url: string,
  params: URLSearchParams,
  active: Pending,
): Promise<void> {
  const publish = (doc: DocumentState) => {
    active.last = doc;
    if (active.mode === 'interactive') {
      defaultStore.setState({ document: doc });
    }
  };

  try {
    const res = await fetch(`/api/parse?${params}`, {
      headers: { accept: 'application/x-ndjson' },
      signal: active.controller.signal,
    });

    let words = -1;
    for await (const event of readEvents(res)) {
      if (active.controller.signal.aborted) {
        return;
      }
      if (event.type === 'step') {
        publish({ kind: 'loading', url, step: event.step });
      }
      if (event.type === 'article') {
        const next = event.post.word_count ?? 0;
        if (event.stage === 'final' || next > words) {
          words = next;
          const doc: LoadedDoc = {
            kind: 'loaded',
            post: event.post,
            leadImageUrl: event.post.lead_image_url ?? null,
            paywalled: event.meta.paywalled,
            stage: event.stage,
          };
          publish(doc);
          if (event.stage === 'final' && active.mode === 'speculative') {
            remember(url, doc);
          }
        }
      }
      if (event.type === 'done') {
        logAttempts(url, event.attempts);
      }
      if (event.type === 'failed') {
        logAttempts(url, event.attempts);
        publish({ kind: 'error', message: event.error, url });
      }
    }
  } catch (error) {
    if (active.controller.signal.aborted) {
      return;
    }
    publish({ kind: 'error', message: 'Failed to reach parser.', url });
  } finally {
    if (pending === active) {
      pending = null;
    }
  }
}

async function loadArticle(
  url: string,
  options: LoadOptions = {},
): Promise<void> {
  const {
    forceRefresh = false,
    history: historyMode = 'push',
    strategy,
    mode = 'interactive',
  } = options;
  if (!isUrl(url)) {
    return;
  }

  if (mode === 'interactive') {
    applyHistory(url, historyMode);
  }

  const bypass = forceRefresh || Boolean(strategy);
  const ready = warm.get(url);
  if (mode === 'interactive' && ready && !bypass) {
    warm.delete(url);
    defaultStore.setState({ document: ready });
    window.scrollTo({ top: 0 });
    return;
  }

  if (pending) {
    if (pending.url === url && !bypass) {
      if (mode === 'interactive' && pending.mode === 'speculative') {
        pending.mode = 'interactive';
        window.scrollTo({ top: 0 });
        defaultStore.setState({
          document: pending.last ?? { kind: 'loading', url, step: null },
        });
      }
      return;
    }
    if (mode === 'speculative') {
      return;
    }
    pending.controller.abort();
    pending = null;
  }

  if (mode === 'interactive') {
    defaultStore.setState({ document: { kind: 'loading', url, step: null } });
    window.scrollTo({ top: 0 });
  }

  const params = new URLSearchParams({ q: url, stream: '1' });
  if (strategy) {
    params.set('strategy', strategy);
  }
  if (bypass) {
    params.set('fresh', '1');
    params.set('_t', String(Date.now()));
  }

  const active: Pending = {
    url,
    mode,
    controller: new AbortController(),
    last: null,
  };
  pending = active;
  await run(url, params, active);
}

export { loadArticle, adoptPayload, isUrl, currentQuery, urlFromShare };
