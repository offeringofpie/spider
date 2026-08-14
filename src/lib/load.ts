import { defaultStore } from '../store/store';

type HistoryMode = 'push' | 'replace' | 'none';

interface LoadOptions {
  forceRefresh?: boolean;
  history?: HistoryMode;
}

const isUrl = (value: string) => {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

const currentQuery = () => {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('q');
};

const urlFromShare = (params: URLSearchParams) => {
  const q = params.get('q');
  if (q && isUrl(q)) return q;

  const text = params.get('text');
  const match = text?.match(/https?:\/\/\S+/);
  return match ? match[0] : null;
};

async function loadArticle(url: string, options: LoadOptions = {}) {
  const { forceRefresh = false, history: mode = 'push' } = options;
  if (!isUrl(url)) return;

  const target = `?q=${encodeURIComponent(url)}`;
  if (mode === 'push') history.pushState({ q: url }, '', target);
  if (mode === 'replace') history.replaceState({ q: url }, '', target);

  defaultStore.setState({ document: { kind: 'loading' } });
  window.scrollTo({ top: 0 });

  const apiUrl = forceRefresh
    ? `/api/parse?q=${encodeURIComponent(url)}&_t=${Date.now()}`
    : `/api/parse?q=${encodeURIComponent(url)}`;

  try {
    const res = await fetch(apiUrl, { headers: { accept: 'application/json' } });
    const data = await res.json();

    if (res.ok && data.content) {
      defaultStore.setState({
        document: {
          kind: 'loaded',
          post: data,
          leadImageUrl: data.lead_image_url ?? null,
          paywalled: data.meta?.paywalled ?? false,
        },
      });
    } else {
      defaultStore.setState({
        document: {
          kind: 'error',
          message: data.error ?? 'The source site returned an error.',
          url,
        },
      });
    }
  } catch {
    defaultStore.setState({
      document: { kind: 'error', message: 'Failed to reach parser.', url },
    });
  }
}

export { loadArticle, isUrl, currentQuery, urlFromShare };
