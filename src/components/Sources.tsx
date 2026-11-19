import { useEffect, useState } from 'react';
import type { MouseEvent, SyntheticEvent } from 'react';
import { fetchSources, loadArticle, sourcesQuery } from '../lib/load';
import type { SourcesRequest } from '../lib/load';
import type {
  Alternative,
  CitedCategory,
  CitedSource,
  RelatedArticle,
  SourcesResult,
} from '../lib/types';

type Props = {
  variant: 'notice' | 'footer';
  request: SourcesRequest;
  citedSources: CitedSource[];
  alternatives: Alternative[];
};

type SourcesState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; result: SourcesResult }
  | { kind: 'failed' };

const categoryLabels: Record<CitedCategory, string> = {
  study: 'Study',
  official: 'Official',
  'code-data': 'Code & data',
  document: 'Document',
  reporting: 'Reporting',
};

const linkClass = 'themed-link text-base-content underline';
const pdfLink = /\.pdf(?:[?#]|$)/i;

const readerHref = (url: string): string => {
  return `/?q=${encodeURIComponent(url)}`;
};

const openInReader = (event: MouseEvent, url: string): void => {
  if (event.metaKey || event.ctrlKey || event.shiftKey) {
    return;
  }
  event.preventDefault();
  loadArticle(url);
};

const opensExternally = (source: CitedSource): boolean => {
  return source.category === 'code-data' || pdfLink.test(source.url);
};

function useSources(request: SourcesRequest | null): SourcesState {
  const [state, setState] = useState<SourcesState>({ kind: 'idle' });
  const query = request ? sourcesQuery(request) : null;

  useEffect(() => {
    if (!query) {
      setState({ kind: 'idle' });
      return;
    }

    const controller = new AbortController();
    setState({ kind: 'loading' });
    fetchSources(query, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setState({ kind: 'loaded', result });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setState({ kind: 'failed' });
        }
      });
    return () => controller.abort();
  }, [query]);

  return state;
}

const relatedOf = (
  state: SourcesState,
  alternatives: Alternative[],
): RelatedArticle[] => {
  if (state.kind === 'loaded' && state.result.relatedArticles.length > 0) {
    return state.result.relatedArticles;
  }
  return alternatives.map((alternative): RelatedArticle => {
    return { ...alternative, matchKind: 'coverage' };
  });
};

const statusOf = (state: SourcesState, found: boolean): string | null => {
  switch (state.kind) {
    case 'idle':
      return null;
    case 'loading':
      return found ? null : 'Searching other outlets…';
    case 'loaded':
      return found ? null : 'No other coverage found.';
    case 'failed':
      return found ? null : 'Could not search other outlets right now.';
    default: {
      const _exhaustive: never = state;
      throw new Error(
        `Unhandled sources state: ${JSON.stringify(_exhaustive)}`,
      );
    }
  }
};

function ExternalLink({ url, label }: { url: string; label: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open ${label} in a new tab`}
      className="themed-link text-base-content/60"
    >
      <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24">
        <use href="#external" />
      </svg>
    </a>
  );
}

function ReaderLink({ url, title }: { url: string; title: string }) {
  return (
    <a
      href={readerHref(url)}
      onClick={(event) => openInReader(event, url)}
      className={linkClass}
    >
      {title}
    </a>
  );
}

function OutletList({ articles }: { articles: RelatedArticle[] }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-medium">Other outlets covering this story</h2>
      <ul className="flex flex-col gap-1">
        {articles.map((article) => {
          return (
            <li
              key={article.url}
              className="flex flex-wrap items-center gap-x-2"
            >
              <ReaderLink url={article.url} title={article.title} />
              <span className="text-base-content/60">{article.source}</span>
              {article.matchKind === 'syndication' && (
                <span className="badge badge-sm badge-primary badge-soft">
                  Same article
                </span>
              )}
              <ExternalLink url={article.url} label={article.source} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function CitedList({ sources }: { sources: CitedSource[] }) {
  return (
    <ul className="flex flex-col gap-1">
      {sources.map((source) => {
        const external = opensExternally(source);
        return (
          <li key={source.url} className="flex flex-wrap items-center gap-x-2">
            {external ? (
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                {source.title}
              </a>
            ) : (
              <ReaderLink url={source.url} title={source.title} />
            )}
            <span className="text-base-content/60">{source.host}</span>
            <span className="badge badge-sm badge-ghost">
              {categoryLabels[source.category]}
            </span>
            {!external && <ExternalLink url={source.url} label={source.host} />}
          </li>
        );
      })}
    </ul>
  );
}

function Coverage({
  state,
  alternatives,
}: {
  state: SourcesState;
  alternatives: Alternative[];
}) {
  const related = relatedOf(state, alternatives);
  const status = statusOf(state, related.length > 0);

  return (
    <>
      {related.length > 0 && <OutletList articles={related} />}
      {status && (
        <p role="status" className="text-base-content/60">
          {status}
        </p>
      )}
    </>
  );
}

export default function Sources({
  variant,
  request,
  citedSources,
  alternatives,
}: Props) {
  const [searched, setSearched] = useState(false);
  const wanted = variant === 'notice' || searched;
  const state = useSources(wanted ? request : null);
  const count = citedSources.length;
  const citedSummary = `${count} primary source${count === 1 ? '' : 's'} cited`;

  const handleToggle = (event: SyntheticEvent<HTMLDetailsElement>) => {
    if (event.currentTarget.open) {
      setSearched(true);
    }
  };

  if (variant === 'notice') {
    return (
      <>
        <Coverage state={state} alternatives={alternatives} />
        {count > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="font-medium">
              Primary sources cited in this article
            </h2>
            <CitedList sources={citedSources} />
          </section>
        )}
      </>
    );
  }

  return (
    <aside
      aria-label="Sources"
      className="sources mx-auto max-w-3xl mt-12 flex flex-col gap-3 border-t border-base-content/20 pt-4 text-sm text-base-content/80 print:hidden"
    >
      {count > 0 && (
        <details>
          <summary className="cursor-pointer font-medium">
            {citedSummary}
          </summary>
          <div className="mt-2">
            <CitedList sources={citedSources} />
          </div>
        </details>
      )}
      <details onToggle={handleToggle}>
        <summary className="cursor-pointer font-medium">
          Find other sources covering this story
        </summary>
        <div className="mt-2 flex flex-col gap-3">
          <Coverage state={state} alternatives={alternatives} />
        </div>
      </details>
    </aside>
  );
}
