import React, { useState, useEffect } from 'react';
import { defaultStore, useStore } from '../store/store';
import ShareButton from '../components/shareButton';
import SettingsButton from './SettingsButton';

export default function Header(props) {
  const [value, setValue] = useState('');
  const [state, setState] = useStore(defaultStore);
  const [playing, setPlaying] = useState(false);
  const [isEmbedded, setIsEmbedded] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const embedded = document.documentElement.dataset.embedded === 'true';
      setIsEmbedded(embedded);

      // if (!embedded) {
      const urlParams = new URLSearchParams(window.location.search);
      const q = urlParams.get('q');
      if (q) {
        setValue(q);
        fetchData(q);
      }
      // }
    }
  }, []);

  if (isEmbedded) {
    return null;
  }

  const isUrl = (string) => {
    try {
      return Boolean(new URL(string));
    } catch (e) {
      return false;
    }
  };

  async function fetchData(e) {
    let url = typeof e === 'string' ? e : e.target.querySelector('#url').value;

    if (typeof e !== 'string') {
      e.preventDefault();
    }

    if (isUrl(url)) {
      try {
        setState({
          loading: true,
          loaded: false,
        });

        await fetch(`/.netlify/functions/node-fetch?q=${url}`, {
          headers: { accept: 'Accept: application/json' },
        })
          .then((x) => x.json())
          .then((msg) => {
            setState({
              posts: JSON.stringify(msg),
              loading: false,
              loaded: true,
            });
            history.pushState({}, 'New Page', `/?q=${url}`);
          });
      } catch (err) {
        console.log(err);
      }
    }
  }
  return isEmbedded ? (
    <header>Hello world</header>
  ) : (
    <header className="navbar bg-base-100 shadow-sm flex content-center justify-center w-full">
      <div className="flex w-full max-w-6xl p-2 flex-wrap">
        <form onSubmit={fetchData} name="submit" className="flex-1">
          <div className="relative">
            <div className="flex absolute -left-0.5 items-center pointer-events-none">
              <svg
                aria-hidden="true"
                className="w-10 h-10 text-primary z-10"
                viewBox="0 0 24 24"
              >
                <use href="#web" />
              </svg>
            </div>
            <input
              type="text"
              id="url"
              className="input input-accent bg-base-300 border-2 border-r-0 border-primary placeholder-primary-focus text-primary-focus text-sm rounded-none rounded-bl-lg block w-full pl-10 p-3 ease-linear h-full"
              placeholder="Insert URL"
              defaultValue={value}
              required
            />
            <button
              type="submit"
              className="absolute block top-0 right-0 text-primary-focus cursor-pointer hover:text-primary h-full pr-2"
              aria-role="button"
              aria-label="Submit"
              title="Submit"
            >
              <svg
                aria-hidden="true"
                className="w-10 h-10 text-primary-focus"
                viewBox="0 0 512 512"
              >
                <use href="#eye" />
              </svg>
            </button>
          </div>
        </form>
        <div className="flex-none bg-base-300 border-primary border-2 border-l-0 rounded-tr-xl">
          <ShareButton />
        </div>
      </div>
      <SettingsButton />
    </header>
  );
}
