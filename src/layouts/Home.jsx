import React, { useState, useEffect } from 'react';
import { defaultStore, useStore } from '../store/store';
import TOC from '../components/TOC';

export default function Home() {
  const [state] = useStore(defaultStore);
  const [post, setPost] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (state.posts) {
      try {
        setPost(JSON.parse(state.posts));
        setError(null);
      } catch {
        setPost(null);
      }
    } else {
      setPost(null);
    }

    if (state.error) {
      try {
        setError(JSON.parse(state.error));
      } catch {
        setError({ error: 'Unknown error format' });
      }
    } else if (!state.posts) {
      setError(null);
    }
  }, [state.posts, state.error]);

  const isLoaded = state.loaded && post;

  if (error && !isLoaded && !state.loading) {
    const links = error.archive_links || [];

    return (
      <div className="w-full mx-auto max-w-4xl px-4 text-slate-100">
        <article className="text-left">
          <h1 className="font-semibold tracking-tight text-2xl text-error mb-4">
            Could not render this article
          </h1>
          <p className="mb-4 text-sm text-slate-300">
            {error.error ||
              'The source site or archive blocked our reader for this URL.'}
          </p>

          {links.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-slate-300">
                You can try opening from these archives:
              </p>
              <ul className="list-disc list-inside space-y-1">
                {links.map((l) => (
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
  }

  return (
    <div className="w-full mx-auto max-w-4xl text-slate-100">
      <article className="text-left">
        {isLoaded && (
          <>
            <TOC htmlContent={post.content} />
            <div
              id="article-content"
              aria-live={state.isSpeaking ? 'polite' : 'off'}
              className={`prose prose-invert max-w-none ${state.textSize} ${state.lineHeight}
                prose-headings:font-semibold
                prose-headings:tracking-tight
                prose-headings:block
                prose-p:my-4
                prose-a:text-info prose-a:underline prose-a:underline-offset-2`}
              dangerouslySetInnerHTML={{ __html: post.content }}
            />
          </>
        )}

        {state.loading && (
          <div className="mt-4 flex w-full max-w-2xl flex-col gap-4 mx-auto py-6">
            <div className="skeleton bg-neutral-content h-32 w-full"></div>
            <div className="skeleton bg-neutral-content h-4 w-28"></div>
            <div className="skeleton bg-neutral-content h-4 w-full"></div>
            <div className="skeleton bg-neutral-content h-4 w-full"></div>
          </div>
        )}
      </article>
    </div>
  );
}
