import React, { useState, useEffect } from 'react';
import { defaultStore, useStore } from '../store/store';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import Progress from '../components/Progress';
import Sprite from '../components/Sprite';

const isUrl = (string) => {
  try {
    return Boolean(new URL(string));
  } catch (e) {
    return false;
  }
};

export default function Home() {
  const [posts, setPosts] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [state, setState] = useStore(defaultStore);

  function speak() {
    if (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      loaded
    ) {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      } else {
        const msg = new SpeechSynthesisUtterance();
        if (localStorage.getItem('voice')) {
          let selectedVoice = window.speechSynthesis
            .getVoices()
            .filter((voice) => {
              return voice.name == localStorage.getItem('voice');
            });
          msg.voice = selectedVoice[0];
        }
        if (localStorage.getItem('rate')) {
          msg.rate = localStorage.getItem('rate');
        }
        if (localStorage.getItem('pitch')) {
          msg.pitch = localStorage.getItem('pitch');
        }

        msg.text =
          posts.title + '\n' + posts.content.replace(/(<([^>]+)>)/gi, '');
        window.speechSynthesis.speak(msg);
      }
    }
  }

  async function fetchData(e) {
    let url = typeof e == 'string' ? e : e.target.querySelector('#url').value;
    if (typeof e !== 'string') {
      e.preventDefault();
    }

    if (isUrl(url)) {
      try {
        setLoading(true);
        const res = await fetch(`http://localhost:9999/.netlify/functions/node-fetch?q=${url}`, {
          headers: { accept: 'Accept: application/json' },
        })
          .then((x) => x.json())
          .then((msg) => {
            setPosts(msg);
            setLoading(false);
            setLoaded(true);
            history.pushState({}, "New Page", `/?q=${url}`);
          });
      } catch (err) {
        console.log(err);
      }
    }
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('q')) {
        fetchData(urlParams.get('q'));
      }
    }
  }, []);

  return (
    <div className="drawer drawer-end">
      <input id="drawer" type="checkbox" className="drawer-toggle" />
      <div className="drawer-content">
        <div
          className={`w-full px-6 mx-auto text-xl max-w-6xl leading-normal text-center`}
        >
          <div className="prose mx-auto lg:prose-xl flex items-stretch pt-16 pb-6 text-xl leading-normal text-center print:hidden">
            <Header onClick={fetchData} onSpeak={speak} loaded={loaded} />
          </div>
          <article className="prose mx-auto lg:prose-xl prose-zinc text-left">
            <h1 className="font-bold break-normal pt-6 pb-2 text-3xl md:text-4xl">
              {posts.title}
            </h1>
            {posts.lead_image_url &&
            !(
              posts.content.substring(0, 500).includes('<img') ||
              posts.content.substring(0, 500).includes('<figure')
            ) ? (
              <img src={posts.lead_image_url} />
            ) : (
              ''
            )}
            <div
              className="description"
              dangerouslySetInnerHTML={{ __html: posts.content }}
            ></div>
            {loading ? (
              <svg
                aria-hidden="true"
                className="absolute left-1/2 top-1/2 animate-spin -ml-1 mr-3 h-10 w-10 text-primary"
                viewBox="0 0 24 24"
              >
                <use href="#loading" />
              </svg>
            ) : (
              ''
            )}
          </article>
          <label
            htmlFor="drawer"
            className="drawer-button absolute right-2 top-2 text-primary-focus hover:text-primary cursor-pointer ease-linear duration-75 text-xxl"
          >
            <svg aria-hidden="true" className="w-10 h-10" viewBox="0 0 24 24">
              <use href="#spiderweb" />
            </svg>
            <span className="sr-only animate-spin">Open Menu</span>
          </label>
        </div>
      </div>
      <Sidebar post={posts} />
    </div>
  );
}
