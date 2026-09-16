import { useState, useEffect, useRef } from 'react';
import { defaultStore, useStore } from '../store/store';
import {
  loadArticle,
  adoptPayload,
  currentQuery,
  isUrl,
  urlFromShare,
} from '../lib/load';
import { scrollBehavior } from '../lib/motion';
import SettingsButton from './SettingsButton';

const speculateDelay = 500;

export default function Header() {
  const [state] = useStore(defaultStore);
  const [isEmbedded, setIsEmbedded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef(0);

  useEffect(() => {
    setIsEmbedded(document.documentElement.dataset.embedded === 'true');

    if (adoptPayload()) return;

    const shared = urlFromShare(new URLSearchParams(window.location.search));
    if (shared) loadArticle(shared, { history: 'replace' });
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const q = currentQuery();
      if (q) {
        loadArticle(q, { history: 'none' });
      } else {
        defaultStore.setState({ document: { kind: 'idle' } });
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (inputRef.current) inputRef.current.value = currentQuery() ?? '';
  }, [state.document]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName;
      if (
        activeTag === 'INPUT' ||
        activeTag === 'TEXTAREA' ||
        activeTag === 'SELECT'
      )
        return;

      if (e.key === '/') {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: scrollBehavior() });
        document.getElementById('url')?.focus();
      }

      const q = currentQuery();
      if (e.key === '?' && q) {
        e.preventDefault();
        loadArticle(q, { forceRefresh: true, history: 'none' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    return () => window.clearTimeout(timer.current);
  }, []);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    window.clearTimeout(timer.current);
    const url = e.currentTarget.querySelector<HTMLInputElement>('#url')!.value;
    loadArticle(url);
  }

  function speculate() {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const url = inputRef.current?.value.trim() ?? '';
      if (isUrl(url) && url !== currentQuery()) {
        loadArticle(url, { mode: 'speculative', history: 'none' });
      }
    }, speculateDelay);
  }

  if (isEmbedded) {
    return null;
  }

  return (
    <header
      className={`navbar flex content-center justify-center w-full max-w-4xl mx-auto relative z-10 bg-transparent`}
    >
      <div className="flex w-full max-w-6xl p-2">
        <form
          onSubmit={handleSubmit}
          name="submit"
          className="flex-1 flex flex-col gap-1"
        >
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
            <label htmlFor="url" className="sr-only">
              Article URL
            </label>
            <input
              type="text"
              id="url"
              ref={inputRef}
              onPaste={speculate}
              onBlur={speculate}
              className="input input-accent bg-base-300 border-2 border-r-0 border-primary placeholder-primary/50 text-primary text-sm rounded-none rounded-bl-lg block w-full pl-10 p-3 ease-linear h-full"
              placeholder="Paste a URL to read"
              required
            />
            <button
              type="submit"
              className="block bg-base-300 border-2 border-l-0 rounded-tr-xl border-primary top-0 right-0 text-primary cursor-pointer hover:text-primary h-full px-2"
              aria-label="Read article"
              title="Read article"
            >
              <svg
                aria-hidden="true"
                className="w-6 h-6 text-primary"
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
