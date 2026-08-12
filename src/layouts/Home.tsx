import { useEffect } from 'react';
import { defaultStore, useStore } from '../store/store';
import TOC from '../components/TOC';
import ArchiveNotice from '../components/ArchiveNotice';

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
  if (!lang) return undefined;
  return rtlLanguages.has(lang.split('-')[0].toLowerCase()) ? 'rtl' : undefined;
};

const textSizeClasses: Record<string, string> = {
  'prose-base': 'prose-sm sm:prose-base',
  'prose-lg': 'prose-sm sm:prose-lg',
  'prose-xl': 'prose-base sm:prose-xl',
  'prose-2xl': 'prose-lg sm:prose-2xl',
};

export default function Home() {
  const [state] = useStore(defaultStore);
  const doc = state.document;

  useEffect(() => {
    if (doc.kind !== 'loaded') return;
    document.querySelectorAll('#article-content a').forEach((a) => {
      if (a.getAttribute('href')?.startsWith('#')) return;
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    });
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
          <span>Loading...</span>
        </div>
      );

    case 'error':
      return (
        <div className="w-full mx-auto max-w-4xl px-4 text-base-content">
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
        <div className="w-full px-3 text-base-content">
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
              className={`prose prose-invert mx-auto ${textSizeClasses[state.textSize] ?? state.textSize} ${state.lineHeight}
                prose-headings:font-semibold
                prose-headings:tracking-tight
                prose-headings:block
                prose-p:my-4
                prose-a:text-info prose-a:underline prose-a:underline-offset-2`}
              dangerouslySetInnerHTML={{ __html: doc.post.content }}
            />
            {doc.paywalled && (
              <ArchiveNotice
                message="This article is behind a paywall."
                url={doc.post.url}
              />
            )}
          </article>
        </div>
      );

    default: {
      const _exhaustive = doc;
      throw new Error(
        `Unhandled document state: ${JSON.stringify(_exhaustive)}`,
      );
    }
  }
}
