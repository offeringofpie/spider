import React, { useState, useEffect } from 'react';
import { defaultStore, useStore } from '../store/store';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import Progress from '../components/Progress';
import Sprite from '../components/Sprite';

const readTime = (wordCount) => {
  const wordsPerMinute = 200; // Average reading speed
  const minutes = wordCount / wordsPerMinute;

  if (minutes < 1) {
    const seconds = Math.ceil(minutes * 60);
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  } else {
    const roundedMinutes = Math.ceil(minutes);
    return `${roundedMinutes} minute${roundedMinutes !== 1 ? 's' : ''}`;
  }
}

const formatDate = (dateString) => {
  const date = new Date(dateString);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

export default function Home() {
  const [state, setState] = useStore(defaultStore);
  const [post, setPost] = useState(false);

  useEffect(() => {
    if (state.posts) {
      setPost(JSON.parse(state.posts));
    }
  }, [state.posts]);

  return (
    <div
      className={`w-full p-6 mx-auto text-xl max-w-6xl leading-normal text-center`}
    >
      <article className="mx-auto prose-xl text-left">
        {state.loaded ? (
          <>
            <h1 className="font-bold break-normal text-3xl md:text-4xl text-info">
              {post.title}
            </h1>

            <div className='flex w-full justify-between'>
              <div><strong className='text-info'>Read time:</strong> {readTime(post.word_count)}</div>
              <div>{formatDate(post.date_published)}</div>
            </div>

            {post.lead_image_url &&
              !(
                post.content.substring(0, 500).includes('<img') ||
                post.content.substring(0, 500).includes('<figure')
              ) && <img src={post.lead_image_url} alt={post.title} />}
            <div
              className="description"
              dangerouslySetInnerHTML={{ __html: post.content }}
            ></div>
          </>
        ) : (
          ''
        )}

        {state.loading ? (
          <div class="flex w-full max-w-2xl flex-col gap-4 mx-auto py-6">
            <div class="skeleton bg-info h-6 w-full"></div>
            <div class="skeleton bg-info h-5 w-full"></div>
            <div class="skeleton bg-info h-32 w-full"></div>
            <div class="skeleton bg-info h-4 w-28"></div>
            <div class="skeleton bg-info h-4 w-62"></div>
            <div class="skeleton bg-info h-4 w-full"></div>
            <div class="skeleton bg-info h-4 w-28"></div>
            <div class="skeleton bg-info h-4 w-50"></div>
            <div class="skeleton bg-info h-4 w-80"></div>
            <div class="skeleton bg-info h-4 w-full"></div>
          </div>
        ) : (
          ''
        )}
      </article>
    </div>
  );
}
