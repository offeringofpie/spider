import { defaultStore } from '../store/store';
import type { ParsedPost } from '../store/store';
import type { ParseAttempt } from './types';

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
    readonly attempts?: readonly ParseAttempt[];
  };
};

const asBody = (value: unknown): ParseBody => {
  return typeof value === 'object' && value !== null
    ? (value as ParseBody)
    : {};
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
    params.set('_t', String(Date.now()));
  }

  try {
    const res = await fetch(`/api/parse?${params}`, {
      headers: { accept: 'application/json' },
    });
    const body = asBody(await res.json());

    if (res.ok && body.content) {
      defaultStore.setState({
        document: {
          kind: 'loaded',
          post: body as ParsedPost,
          leadImageUrl: body.lead_image_url ?? null,
          paywalled: body.meta?.paywalled ?? false,
          attempts: body.meta?.attempts ?? [],
        },
      });
    } else {
      defaultStore.setState({
        document: {
          kind: 'error',
          message: body.error ?? 'The source site returned an error.',
          url,
          attempts: body.attempts ?? [],
        },
      });
    }
  } catch {
    defaultStore.setState({
      document: {
        kind: 'error',
        message: 'Failed to reach parser.',
        url,
        attempts: [],
      },
    });
  }
}

export { loadArticle, isUrl, currentQuery, urlFromShare };
