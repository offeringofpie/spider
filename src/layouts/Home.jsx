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

  useEffect(() => {
    if (state.posts) {
      setPost(JSON.parse(state.posts));
    }
  }, [state.posts]);

  const isLoaded = state.loaded && post;

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
              <p>{readTime(post.word_count)} read time</p>
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
