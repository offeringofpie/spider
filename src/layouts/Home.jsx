import React, { useState, useEffect } from 'react';
import { defaultStore, useStore } from '../store/store';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import Progress from '../components/Progress';
import Sprite from '../components/Sprite';

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
      className={`w-full px-6 mx-auto text-xl max-w-6xl leading-normal text-center`}
    >
      <div className="prose mx-auto lg:prose-xl flex items-stretch pt-16 pb-6 text-xl leading-normal text-center print:hidden"></div>
      <article className="prose mx-auto lg:prose-xl prose-zinc text-left">
        {state.loaded ? (
          <>
            <h1 className="font-bold break-normal pt-6 pb-2 text-3xl md:text-4xl">
              {post.title}
            </h1>

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
          <div class="flex w-2xl flex-col gap-4">
            <div class="skeleton bg-accent h-6 w-full"></div>
            <div class="skeleton bg-accent h-5 w-full"></div>
            <div class="skeleton bg-accent h-32 w-full"></div>
            <div class="skeleton bg-accent h-4 w-28"></div>
            <div class="skeleton bg-accent h-4 w-62"></div>
            <div class="skeleton bg-accent h-4 w-full"></div>
            <div class="skeleton bg-accent h-4 w-28"></div>
            <div class="skeleton bg-accent h-4 w-50"></div>
            <div class="skeleton bg-accent h-4 w-80"></div>
            <div class="skeleton bg-accent h-4 w-full"></div>
          </div>
        ) : (
          ''
        )}
      </article>
    </div>
  );
}
