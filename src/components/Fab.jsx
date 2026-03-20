import React, { useState, useEffect, useRef } from 'react';
import { defaultStore, useStore } from '../store/store';
import SettingsButton from './SettingsButton';

export default function Fab() {
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useStore(defaultStore);
  const [copied, setCopied] = useState(false);
  const [isEmbedded, setIsEmbedded] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const synthRef = useRef(null);
  const fabRef = useRef(null);
  const utterancesRef = useRef([]);

  const shouldReadRef = useRef(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      synthRef.current = window.speechSynthesis;
      setIsEmbedded(document.documentElement.dataset.embedded === 'true');
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isOpen) setIsOpen(false);
        if (state.showSettings || state.showTranslateBar) {
          setState({ showSettings: false, showTranslateBar: false });
        }
      }
    };

    const handleClickOutside = (e) => {
      if (fabRef.current && !fabRef.current.contains(e.target))
        setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const copyToClipboard = () => {
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch((err) => console.error('Failed to copy: ', err));
  };

  const handleShare = async () => {
    let title = document.title;
    if (state.posts) {
      try {
        const article = JSON.parse(state.posts);
        title = article.title || document.title;
      } catch (err) {
        console.error(err);
      }
    }
    if (navigator.share) {
      try {
        await navigator.share({ title, url: window.location.href });
        setIsOpen(false);
      } catch (err) {
        if (err.name !== 'AbortError') copyToClipboard();
      }
    } else {
      copyToClipboard();
    }
  };

  const cleanUpHighlights = () => {
    document.querySelectorAll('.tts').forEach((el) => {
      el.classList.remove('tts');
    });
  };

  const scrollIntoViewIfNeeded = (el) => {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const isInViewport =
      rect.top >= 0 &&
      rect.bottom <=
        (window.innerHeight || document.documentElement.clientHeight);
    if (!isInViewport) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const toggleSpeech = () => {
    if (!synthRef.current) return;

    if (state.isSpeaking && !isPaused) {
      synthRef.current.pause();
      setIsPaused(true);
      return;
    }

    if (state.isSpeaking && isPaused) {
      synthRef.current.resume();
      setIsPaused(false);
      return;
    }

    if (state.isSpeaking) {
      shouldReadRef.current = false;
      synthRef.current.cancel();
      setState({ isSpeaking: false });
      setIsPaused(false);
      cleanUpHighlights();
      return;
    }

    const initialContainer =
      document.querySelector('article') ||
      document.querySelector('#article-content') ||
      document.body;

    const initialBlocks = Array.from(
      initialContainer.querySelectorAll(
        'h1, h2, h3, h4, h5, h6, p, li, blockquote',
      ),
    ).filter((el) => {
      const hasBlockChildren = el.querySelector(
        'p, h1, h2, h3, h4, h5, h6, li, blockquote',
      );
      return !hasBlockChildren && el.textContent.trim().length > 0;
    });

    if (initialBlocks.length === 0) return;

    const voiceName = localStorage.getItem('voice');
    const voices = synthRef.current.getVoices();
    const selectedVoice = voiceName
      ? voices.find((v) => v.name === voiceName)
      : null;
    const rate = parseFloat(localStorage.getItem('rate') || '1');
    const pitch = parseFloat(localStorage.getItem('pitch') || '1');

    setState({ isSpeaking: true });
    shouldReadRef.current = true;
    utterancesRef.current = [];

    let currentBlockIndex = 0;

    const speakNext = () => {
      if (!shouldReadRef.current) {
        setState({ isSpeaking: false });
        cleanUpHighlights();
        return;
      }

      const liveContainer =
        document.querySelector('article') ||
        document.querySelector('#article-content') ||
        document.body;

      const liveBlocks = Array.from(
        liveContainer.querySelectorAll(
          'h1, h2, h3, h4, h5, h6, p, li, blockquote',
        ),
      ).filter((el) => {
        const hasBlockChildren = el.querySelector(
          'p, h1, h2, h3, h4, h5, h6, li, blockquote',
        );
        return !hasBlockChildren && el.textContent.trim().length > 0;
      });

      if (currentBlockIndex >= liveBlocks.length) {
        setState({ isSpeaking: false });
        cleanUpHighlights();
        return;
      }

      const block = liveBlocks[currentBlockIndex];
      const utterance = new SpeechSynthesisUtterance(block.textContent);

      utterancesRef.current[0] = utterance;

      if (selectedVoice) utterance.voice = selectedVoice;
      utterance.rate = rate;
      utterance.pitch = pitch;

      cleanUpHighlights();
      block.classList.add('tts');
      scrollIntoViewIfNeeded(block);

      utterance.onstart = () => {
        block.classList.add('tts');
      };

      utterance.onend = () => {
        currentBlockIndex++;
        if (shouldReadRef.current) {
          setTimeout(speakNext, 50);
        }
      };

      utterance.onerror = (e) => {
        if (e.error !== 'canceled') {
          console.error('TTS Error:', e);
          currentBlockIndex++;
          if (shouldReadRef.current) setTimeout(speakNext, 50);
        } else {
          cleanUpHighlights();
        }
      };

      synthRef.current.speak(utterance);
    };

    setTimeout(speakNext, 100);
  };

  const toggleTranslateBar = () => {
    setState({ showTranslateBar: !state.showTranslateBar });
    setIsOpen(false);
  };

  if (!state.loaded || !state.posts) return null;

  const menuTabIndex = isOpen ? 0 : -1;

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 print:hidden"
      ref={fabRef}
    >
      <div
        id="fab-menu"
        aria-hidden={!isOpen}
        className={`flex flex-col items-end gap-1 transition-all duration-300 origin-bottom ${isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-90 translate-y-4 pointer-events-none'}`}
      >
        {isEmbedded && <SettingsButton variant="fab" tabIndex={menuTabIndex} />}
        <button
          onClick={handleShare}
          tabIndex={menuTabIndex}
          aria-label="Share Article"
          className="bg-base-100 text-base-content hover:bg-base-200 border-none rounded-full flex items-center gap-2 pl-5 pr-2 h-14"
        >
          <span className="text-sm font-medium">
            {copied ? 'Link Copied!' : 'Share'}
          </span>
          <div
            className={`${copied ? 'bg-success/10 text-success' : 'bg-accent/10 text-accent'} rounded-full p-2`}
          >
            <svg className="w-5 h-5" viewBox="0 0 458.624 458.624">
              <use href="#share" />
            </svg>
          </div>
        </button>
        <button
          onClick={toggleTranslateBar}
          tabIndex={menuTabIndex}
          aria-label="Translate Article"
          className="bg-base-100 text-base-content hover:bg-base-200 border-none rounded-full flex items-center gap-2 pl-5 pr-2 h-14"
        >
          <span className="text-sm font-medium">Translate</span>
          <div className="bg-primary/10 text-primary rounded-full p-2">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <use href="#translate" />
            </svg>
          </div>
        </button>
        {!state.isSpeaking ? (
          <button
            onClick={toggleSpeech}
            tabIndex={menuTabIndex}
            aria-label="Read Article Aloud"
            className="bg-base-100 text-base-content hover:bg-base-200 border-none rounded-full flex items-center gap-2 pl-5 pr-2 h-14"
          >
            <span className="text-sm font-medium">Text-to-Speech</span>
            <div className="bg-secondary/10 text-secondary rounded-full p-2">
              <svg className="w-5 h-5" viewBox="0 0 32 32">
                <use href="#mic" />
              </svg>
            </div>
          </button>
        ) : (
          <div className="bg-base-100 text-base-content rounded-full flex items-center gap-2 pl-5 pr-2 h-14 pointer-events-auto">
            <span className="text-sm font-medium pr-2">
              {isPaused ? 'Paused' : 'Reading'}
            </span>
            <button
              onClick={toggleSpeech}
              aria-label={isPaused ? 'Resume' : 'Pause'}
              className="btn-circle btn-sm bg-secondary/10 text-secondary h-10 w-10 flex items-center justify-center"
            >
              {isPaused ? (
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-5 h-5 ml-0.5"
                >
                  <use href="#play" />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-5 h-5"
                >
                  <use href="#pause" />
                </svg>
              )}
            </button>
            <button
              onClick={() => {
                shouldReadRef.current = false;
                synthRef.current.cancel();
                setState({ isSpeaking: false });
                setIsPaused(false);
                cleanUpHighlights();
                utterancesRef.current = [];
              }}
              aria-label="Stop"
              className="btn btn-circle btn-sm bg-error/10 text-error h-10 w-10 flex items-center justify-center ml-1"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <use href="#stop" />
              </svg>
            </button>
          </div>
        )}
      </div>

      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label="Menu"
        className="btn btn-circle bg-primary text-primary-content hover:bg-secondary border-none h-12 w-12 transition-transform duration-300 pointer-events-auto"
      >
        <svg
          className={`w-6 h-6 transition-transform duration-300 ${isOpen ? 'rotate-135' : 'rotate-0'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.5"
            d="M12 4v16m8-8H4"
          />
        </svg>
      </button>
    </div>
  );
}
