import React, { useState, useEffect } from 'react';
import { defaultStore, useStore } from '../store/store';
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

      const urlParams = new URLSearchParams(window.location.search);
      const q = urlParams.get('q');
      if (q) {
        setValue(q);
        fetchData(q);
      }
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
        setState({ loading: true, loaded: false });

        const res = await fetch(
          `/api/parse?q=${encodeURIComponent(url)}`,
          { headers: { accept: 'application/json' } },
        );
        const data = await res.json();

        if (res.ok && data.content) {
          setState({
            posts: JSON.stringify(data),
            error: null,
            loading: false,
            loaded: true,
          });
        } else {
          setState({
            posts: null,
            error: JSON.stringify(data),
            loading: false,
            loaded: false,
          });
        }

        history.pushState({}, 'New Page', `?q=${encodeURIComponent(url)}`);
      } catch (err) {
        setState({
          posts: null,
          error: JSON.stringify({
            error: 'Failed to reach parser function',
          }),
          loading: false,
          loaded: false,
        });
      }
    }
    useEffect(() => {
      const handleKeyDown = (e) => {
        const activeTag = document.activeElement?.tagName;
        if (
          activeTag === 'INPUT' ||
          activeTag === 'TEXTAREA' ||
          activeTag === 'SELECT'
        ) {
          return;
        }

        if (e.key === '/') {
          e.preventDefault();
          window.scrollTo({ top: 0, behavior: 'smooth' });
          document.getElementById('url')?.focus();
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);
  }
  return isEmbedded ? (
    <header>Hello world</header>
  ) : (
    <header className="navbar bg-base-100 flex content-center justify-center w-full max-w-4xl mx-auto">
      <div className="flex w-full max-w-6xl p-2">
        <form onSubmit={fetchData} name="submit" className="flex-1 flex">
          <div className="relative flex w-full">
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
              className="block bg-base-300 border-2 border-l-0 rounded-tr-xl border-primary top-0 right-0 text-primary-focus cursor-pointer hover:text-primary h-full px-2"
              aria-label="Submit"
              title="Submit"
            >
              <svg
                aria-hidden="true"
                className="w-6 h-6 text-primary-focus"
                viewBox="0 0 512 512"
              >
                <use href="#eye" />
              </svg>
            </button>
          </div>
        </form>
      </div>
      <SettingsButton />
    </header>
  );
}
