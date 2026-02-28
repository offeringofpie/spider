import React, { useState, useEffect } from 'react';
import { defaultStore, useStore } from '../store/store';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import Progress from '../components/Progress';
import Sprite from '../components/Sprite';

const readTime = (wordCount) => {
  const wordsPerMinute = 200;
  const minutes = wordCount / wordsPerMinute;

  if (minutes < 1) {
    const seconds = Math.ceil(minutes * 60);
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  } else {
    const roundedMinutes = Math.ceil(minutes);
    return `${roundedMinutes} minute${roundedMinutes !== 1 ? 's' : ''}`;
  }
};

const formatDate = (dateString) => {
  const date = new Date(dateString);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
};

export default function Home() {
  const [state] = useStore(defaultStore);
  const [post, setPost] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // success case
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

    // error payload from store (stringified JSON)
    if (state.error) {
      try {
        setError(JSON.parse(state.error));
      } catch {
        setError({ error: 'Unknown error format' });
      }
    } else if (!state.posts) {
      // no posts and no explicit error
      setError(null);
    }
  }, [state.posts, state.error]);

  const isLoaded = state.loaded && post;

  // Error fallback with archive links
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
    <div className="w-full mx-auto max-w-4xl px-4 text-slate-100">
      <article className="text-left">
        {isLoaded && (
          <>
            {/* Title */}
            <h1 className="font-semibold tracking-tight text-3xl md:text-4xl text-info mb-5">
              {post.title}
            </h1>

            {/* Meta row – simple text, no bar */}
            <div className="mb-6 flex flex-wrap items-center justify-between text-sm text-slate-300">
              {post.word_count && <p>{readTime(post.word_count)} read time</p>}
              {post.date_published && (
                <time className="mt-2 md:mt-0" dateTime={post.date_published}>
                  {formatDate(post.date_published)}
                </time>
              )}
            </div>

            {/* Lead image if not already in content */}
            {post.lead_image_url &&
              !(
                post.content.substring(0, 500).includes('<img') ||
                post.content.substring(0, 500).includes('<figure')
              ) && (
                <img
                  src={post.lead_image_url}
                  alt={post.title}
                  className="mb-8 w-full rounded-xl border border-slate-700 shadow-md"
                />
              )}

            {/* Article body */}
            <div
              className="
                prose prose-invert max-w-none
                text-base md:text-lg leading-relaxed
                prose-headings:font-semibold
                prose-headings:tracking-tight
                prose-p:my-4
                prose-a:text-info prose-a:underline prose-a:underline-offset-2
              "
              dangerouslySetInnerHTML={{ __html: post.content }}
            />
          </>
        )}

        {/* Skeleton loading state */}
        {state.loading && (
          <div className="mt-4 flex w-full max-w-2xl flex-col gap-4 mx-auto py-6">
            <div className="skeleton bg-info h-6 w-full"></div>
            <div className="skeleton bg-info h-5 w-full"></div>
            <div className="skeleton bg-info h-32 w-full"></div>
            <div className="skeleton bg-info h-4 w-28"></div>
            <div className="skeleton bg-info h-4 w-62"></div>
            <div className="skeleton bg-info h-4 w-full"></div>
            <div className="skeleton bg-info h-4 w-28"></div>
            <div className="skeleton bg-info h-4 w-50"></div>
            <div className="skeleton bg-info h-4 w-80"></div>
            <div className="skeleton bg-info h-4 w-full"></div>
          </div>
        )}
      </article>
    </div>
  );
}
