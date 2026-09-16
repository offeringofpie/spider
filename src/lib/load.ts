import { defaultStore } from '../store/store';
import type { ParseAttempt, ParsedPost } from './types';

type HistoryMode = 'push' | 'replace' | 'none';

type LoadOptions = {
  readonly forceRefresh?: boolean;
  readonly history?: HistoryMode;
  readonly strategy?: string;
};

type ParseBody = Partial<ParsedPost> & {
  readonly error?: string;
  readonly attempts?: readonly ParseAttempt[];
  readonly meta?: {
    readonly paywalled?: boolean;
  };
};

const asBody = (value: unknown): ParseBody => {
  return typeof value === 'object' && value !== null
    ? (value as ParseBody)
    : {};
};

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

async function loadArticle(
  url: string,
  options: LoadOptions = {},
): Promise<void> {
  const { forceRefresh = false, history: mode = 'push', strategy } = options;
  if (!isUrl(url)) {
    return;
  }

  const target = `?q=${encodeURIComponent(url)}`;
  if (mode === 'push') {
    history.pushState({ q: url }, '', target);
  }
  if (mode === 'replace') {
    history.replaceState({ q: url }, '', target);
  }

  defaultStore.setState({ document: { kind: 'loading' } });
  window.scrollTo({ top: 0 });

  const params = new URLSearchParams({ q: url });
  if (strategy) {
    params.set('strategy', strategy);
  }
  if (forceRefresh || strategy) {
    params.set('fresh', '1');
    params.set('_t', String(Date.now()));
  }

  try {
    const res = await fetch(`/api/parse?${params}`, {
      headers: { accept: 'application/json' },
    });
    const body = asBody(await res.json());
    logAttempts(url, body.attempts ?? []);

    if (res.ok && body.content) {
      defaultStore.setState({
        document: {
          kind: 'loaded',
          post: body as ParsedPost,
          leadImageUrl: body.lead_image_url ?? null,
          paywalled: body.meta?.paywalled ?? false,
        },
      });
    } else {
      defaultStore.setState({
        document: {
          kind: 'error',
          message: body.error ?? 'The source site returned an error.',
          url,
        },
      });
    }
  } catch {
    defaultStore.setState({
      document: {
        kind: 'error',
        message: 'Failed to reach parser.',
        url,
      },
    });
  }
}

export { loadArticle, isUrl, currentQuery, urlFromShare };
