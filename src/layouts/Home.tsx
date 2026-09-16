import { useEffect, useLayoutEffect } from 'react';
import { defaultStore, useStore } from '../store/store';
import { isLight } from '../lib/themes';
import { loadArticle, isUrl } from '../lib/load';
import TOC from '../components/TOC';
import ArchiveNotice from '../components/ArchiveNotice';

const stepLabels = {
  regular: 'Fetching the article',
  googlebot: 'Trying as Googlebot',
  bingbot: 'Trying as Bingbot',
  'regular+referrer': 'Retrying with a social referrer',
  alternates: 'Looking for feeds and Markdown',
  wayback: 'Checking the Wayback Machine',
  savepage: 'Requesting an archive',
} as const;

const stepLabel = (step: string | null): string => {
  if (!step) {
    return 'Loading...';
  }
  return stepLabels[step as keyof typeof stepLabels] ?? 'Loading...';
};

const rtlLanguages = new Set([
  'ar',
  'ckb',
  'dv',
  'fa',
  'he',
  'ps',
  'sd',
  'ur',
  'yi',
]);

const direction = (lang: string | null) => {
  if (!lang) {
    return undefined;
  }
  return rtlLanguages.has(lang.split('-')[0].toLowerCase()) ? 'rtl' : undefined;
};

const textSizeClasses: Record<string, string> = {
  'prose-base': 'prose-sm sm:prose-base',
  'prose-lg': 'prose-sm sm:prose-lg',
  'prose-xl': 'prose-sm sm:prose-xl',
  'prose-2xl': 'prose-base sm:prose-2xl',
};

export default function Home(): React.ReactElement | null {
  const [state] = useStore(defaultStore);
  const doc = state.document;

  useLayoutEffect(() => {
    if (doc.kind === 'loaded') {
      document.getElementById('ssr-article')?.remove();
    }
  }, [doc.kind]);

  useEffect(() => {
    if (doc.kind !== 'loaded') {
      return;
    }

    const content = document.getElementById('article-content');
    if (!content) {
      return;
    }

    document.querySelectorAll('#article-content a').forEach((a) => {
      if (a.getAttribute('href')?.startsWith('#')) {
        return;
      }
      a.setAttribute('rel', 'noopener noreferrer');
    });

    const handleClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }

      const link = (e.target as Element | null)?.closest?.('a');
      const href = link?.getAttribute('href');
      if (!href || href.startsWith('#')) {
        return;
      }
      if (!isUrl(link!.href)) {
        return;
      }

      e.preventDefault();
      loadArticle(link!.href);
    };

    content.addEventListener('click', handleClick);
    return () => content.removeEventListener('click', handleClick);
  }, [doc]);

  switch (doc.kind) {
    case 'idle':
      return null;

    case 'loading':
      return (
        <div
          role="status"
          aria-label="Loading article..."
          className="w-full mx-auto max-w-4xl flex flex-col justify-center items-center gap-6 py-24 text-base-content"
        >
          <span className="loading loading-spinner loading-xl text-primary"></span>
          <span>{stepLabel(doc.step)}</span>
        </div>
      );

    case 'error':
      return (
        <div className="w-full mx-auto max-w-4xl text-base-content">
          <article className="text-left">
            <h1 className="font-semibold tracking-tight text-2xl text-error mb-4">
              Could not render this article
            </h1>
            <ArchiveNotice message={doc.message} url={doc.url} />
          </article>
        </div>
      );

    case 'loaded':
      return (
        <div className="w-full text-base-content">
          <article className="text-left">
            <span role="status" className="sr-only">
              {state.ttsState === 'speaking'
                ? 'Reading article'
                : state.ttsState === 'paused'
                  ? 'Paused'
                  : ''}
            </span>
            <TOC htmlContent={doc.post.content} />
            <div
              id="article-content"
              lang={doc.post.lang ?? undefined}
              dir={direction(doc.post.lang)}
              className={`prose ${isLight(state.theme) ? '' : 'prose-invert'} mx-auto ${textSizeClasses[state.textSize] ?? state.textSize} ${state.lineHeight}
                prose-headings:font-semibold
                prose-headings:tracking-tight
                prose-headings:block
                prose-p:my-4
                prose-a:underline prose-a:underline-offset-2`}
              dangerouslySetInnerHTML={{ __html: doc.post.content }}
            />
            {doc.paywalled && doc.stage === 'final' && (
              <ArchiveNotice
                message="This article is behind a paywall."
                url={doc.post.url}
              />
            )}
          </article>
        </div>
      );

    default: {
      const _exhaustive: never = doc;
      throw new Error(
        `Unhandled document state: ${JSON.stringify(_exhaustive)}`,
      );
    }
  }
}
