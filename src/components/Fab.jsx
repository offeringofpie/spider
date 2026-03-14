import React, { useState, useEffect, useRef } from 'react';
import { defaultStore, useStore } from '../store/store';

export default function Fab() {
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useStore(defaultStore);
  const [copied, setCopied] = useState(false);

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const synthRef = useRef(null);
  const fabRef = useRef(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      synthRef.current = window.speechSynthesis;
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    const handleClickOutside = (e) => {
      if (fabRef.current && !fabRef.current.contains(e.target)) {
        setIsOpen(false);
      }
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

  const cleanUpHighlights = () => {
    document.querySelectorAll('.tts-highlight').forEach((el) => {
      el.classList.remove(
        'bg-primary/20',
        'tts-highlight',
        'rounded-md',
        'transition-colors',
        'duration-300',
      );
    });
  };

  const toggleSpeech = () => {
    if (!synthRef.current) return;

    if (isSpeaking && !isPaused) {
      synthRef.current.pause();
      setIsPaused(true);
      return;
    }

    if (isSpeaking && isPaused) {
      synthRef.current.resume();
      setIsPaused(false);
      return;
    }

    if (isSpeaking) {
      synthRef.current.cancel();
      setIsSpeaking(false);
      cleanUpHighlights();
      return;
    }

    const article = document.querySelector('article');
    if (!article) return;

    const elements = Array.from(
      article.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, blockquote'),
    ).filter((el) => el.innerText && el.innerText.trim().length > 0);

    if (elements.length === 0) return;

    const voiceName = localStorage.getItem('voice');
    const voices = synthRef.current.getVoices();
    const selectedVoice = voiceName
      ? voices.find((v) => v.name === voiceName)
      : null;
    const rate = parseFloat(localStorage.getItem('rate') || '1');
    const pitch = parseFloat(localStorage.getItem('pitch') || '1');

    setIsSpeaking(true);

    elements.forEach((el, index) => {
      const textToRead = el.innerText;
      const utterance = new SpeechSynthesisUtterance(textToRead);

      if (selectedVoice) utterance.voice = selectedVoice;
      utterance.rate = rate;
      utterance.pitch = pitch;

      utterance.onstart = () => {
        cleanUpHighlights();

        el.classList.add(
          'bg-primary/20',
          'tts-highlight',
          'rounded-md',
          'transition-colors',
          'duration-300',
        );

        const rect = el.getBoundingClientRect();
        const isInViewport =
          rect.top >= 0 &&
          rect.bottom <=
            (window.innerHeight || document.documentElement.clientHeight);

        if (!isInViewport) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      };

      utterance.onend = () => {
        if (index === elements.length - 1) {
          setIsSpeaking(false);
          cleanUpHighlights();
        }
      };

      utterance.onerror = (e) => {
        if (e.error !== 'canceled') {
          console.error('Speech synthesis error:', e);
        }
        if (index === elements.length - 1) {
          setIsSpeaking(false);
          cleanUpHighlights();
        }
      };

      synthRef.current.speak(utterance);
    });
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
        className={`flex flex-col items-end gap-3 transition-all duration-300 origin-bottom ${isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-90 translate-y-4 pointer-events-none'}`}
      >
        <button
          onClick={copyToClipboard}
          tabIndex={menuTabIndex}
          aria-label="Share Article"
          className="btn bg-base-100 text-base-content hover:bg-base-200 border-none rounded-full flex items-center gap-2 pl-5 pr-2 h-14"
        >
          <span className="text-sm font-medium">
            {copied ? 'Link Copied!' : 'Share'}
          </span>
          <div
            className={`${copied ? 'bg-success/10 text-success' : 'bg-accent/10 text-accent'} rounded-full p-2 transition-colors`}
          >
            <svg
              aria-hidden="true"
              className="w-5 h-5"
              viewBox="0 0 458.624 458.624"
            >
              <use href="#share" />
            </svg>
          </div>
        </button>

        <button
          onClick={toggleTranslateBar}
          tabIndex={menuTabIndex}
          aria-label="Translate Article"
          className="btn bg-base-100 text-base-content hover:bg-base-200 border-none rounded-full flex items-center gap-2 pl-5 pr-2 h-14"
        >
          <span className="text-sm font-medium">Translate</span>
          <div className="bg-primary/10 text-primary rounded-full p-2">
            <svg
              aria-hidden="true"
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <use href="#translate" />
            </svg>
          </div>
        </button>

        {!isSpeaking ? (
          <button
            onClick={toggleSpeech}
            tabIndex={menuTabIndex}
            aria-label="Read Article Aloud"
            className="btn bg-base-100 text-base-content hover:bg-base-200 border-none rounded-full flex items-center gap-2 pl-5 pr-2 h-14 shadow-sm"
          >
            <span className="text-sm font-medium">Text-to-Speech</span>
            <div className="bg-secondary/10 text-secondary rounded-full p-2">
              <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 32 32">
                <use href="#mic" />
              </svg>
            </div>
          </button>
        ) : (
          <div className="bg-base-100 text-base-content rounded-full flex items-center gap-2 pl-5 pr-2 h-14 shadow-sm pointer-events-auto">
            <span className="text-sm font-medium pr-2">
              {isPaused ? 'Paused' : 'Reading'}
            </span>

            <button
              onClick={toggleSpeech}
              tabIndex={menuTabIndex}
              aria-label={isPaused ? 'Resume Reading' : 'Pause Reading'}
              className="btn btn-circle btn-sm bg-secondary/10 text-secondary hover:bg-secondary/20 border-none h-10 w-10 flex items-center justify-center"
            >
              {isPaused ? (
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-5 h-5 ml-0.5"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-5 h-5"
                >
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              )}
            </button>

            <button
              onClick={() => {
                synthRef.current.cancel();
                setIsSpeaking(false);
                setIsPaused(false);
                cleanUpHighlights();
              }}
              tabIndex={menuTabIndex}
              aria-label="Stop Reading"
              className="btn btn-circle btn-sm bg-error/10 text-error hover:bg-error/20 border-none h-10 w-10 flex items-center justify-center"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M6 6h12v12H6z" />
              </svg>
            </button>
          </div>
        )}
      </div>

      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls="fab-menu"
        aria-label={isOpen ? 'Close actions menu' : 'Open actions menu'}
        className="btn btn-circle bg-primary text-primary-content hover:bg-primary-focus border-none h-10 w-10"
      >
        <svg
          aria-hidden="true"
          className={`w-6 h-6 transition-transform duration-300 ease-in-out ${isOpen ? 'rotate-135' : 'rotate-0'}`}
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
