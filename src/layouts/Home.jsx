import React from 'react';
import { defaultStore, useStore } from '../store/store';
import TOC from '../components/TOC';

export default function Home() {
  const [state] = useStore(defaultStore);
  const doc = state.document;

  switch (doc.kind) {
    case 'idle':
      return null;

    case 'loading':
      return (
        <div className="w-full mx-auto max-w-4xl text-slate-100">
          <article className="text-left">
            <div className="mt-4 flex w-full max-w-2xl flex-col gap-4 mx-auto py-6">
              <div className="skeleton bg-neutral-content h-32 w-full"></div>
              <div className="skeleton bg-neutral-content h-4 w-28"></div>
              <div className="skeleton bg-neutral-content h-4 w-full"></div>
              <div className="skeleton bg-neutral-content h-4 w-full"></div>
            </div>
          </article>
        </div>
      );

    case 'error':
      return (
        <div className="w-full mx-auto max-w-4xl px-4 text-slate-100">
          <article className="text-left">
            <h1 className="font-semibold tracking-tight text-2xl text-error mb-4">
              Could not render this article
            </h1>
            <p className="mb-4 text-sm text-slate-300">{doc.message}</p>
            {doc.archiveLinks.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-slate-300">
                  You can try opening from these archives:
                </p>
                <ul className="list-disc list-inside space-y-1">
                  {doc.archiveLinks.map((l) => (
                    <li key={l.url}>
                      <a
                        href={l.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-info underline underline-offset-2"
                      >
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </article>
        </div>
      );

    case 'loaded':
      return (
        <div className="w-full mx-auto max-w-4xl text-slate-100">
          <article className="text-left">
            <TOC htmlContent={doc.post.content} />
            <div
              id="article-content"
              aria-live={state.isSpeaking ? 'polite' : 'off'}
              className={`prose prose-invert max-w-none ${state.textSize} ${state.lineHeight}
                prose-headings:font-semibold
                prose-headings:tracking-tight
                prose-headings:block
                prose-p:my-4
                prose-a:text-info prose-a:underline prose-a:underline-offset-2`}
              dangerouslySetInnerHTML={{ __html: doc.post.content }}
            />
          </article>
        </div>
      );

    default: {
      const _exhaustive = doc;
      throw new Error(`Unhandled document state: ${JSON.stringify(_exhaustive)}`);
    }
  }
}
