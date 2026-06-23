import { useState, useEffect, useRef } from 'react';
import { defaultStore, useStore } from '../store/store';
import SettingsButton from './SettingsButton';

const blocks = 'h1, h2, h3, h4, h5, h6, p, li, blockquote';

const getReadableBlocks = () => {
  const container =
    document.querySelector('article') ||
    document.querySelector('#article-content') ||
    document.body;
  return Array.from(container.querySelectorAll(blocks)).filter((el) => {
    const hasBlockChildren = el.querySelector(blocks);
    return !hasBlockChildren && (el.textContent?.trim().length ?? 0) > 0;
  });
};

export default function Fab() {
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useStore(defaultStore);
  const [copied, setCopied] = useState(false);
  const [isEmbedded, setIsEmbedded] = useState(false);

  const synthRef = useRef<SpeechSynthesis | null>(null);
  const fabRef = useRef<HTMLDivElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const shouldReadRef = useRef(false);
  const restartingRef = useRef(false);

  useEffect(() => {
    synthRef.current = window.speechSynthesis;
    setIsEmbedded(document.documentElement.dataset.embedded === 'true');
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (fabRef.current && !fabRef.current.contains(e.target as Node))
        setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  useEffect(() => {
    const hasOpen = isOpen || state.showSettings || state.showTranslateBar;
    if (!hasOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (isOpen) setIsOpen(false);
      if (state.showSettings || state.showTranslateBar)
        setState({ showSettings: false, showTranslateBar: false });
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, state.showSettings, state.showTranslateBar]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  const handleShare = async () => {
    const title = post.title ?? document.title;
    if (navigator.share) {
      try {
        await navigator.share({ title, url: window.location.href });
        setIsOpen(false);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') copyToClipboard();
      }
    } else {
      copyToClipboard();
    }
  };

  const clearHighlights = () => {
    document.querySelectorAll('.tts').forEach((el) => {
      el.classList.remove('tts');
    });
  };

  const stopSpeech = () => {
    shouldReadRef.current = false;
    synthRef.current?.cancel();
    setState({ ttsState: 'idle' });
    clearHighlights();
    utteranceRef.current = null;
  };

  useEffect(() => {
    if (state.document.kind === 'loading' && state.ttsState !== 'idle') {
      stopSpeech();
    }
  }, [state.document.kind]);

  useEffect(() => {
    return () => {
      shouldReadRef.current = false;
      synthRef.current?.cancel();
    };
  }, []);

  useEffect(() => {
    const handler = () => {
      if (!shouldReadRef.current || !synthRef.current?.speaking) return;
      restartingRef.current = true;
      synthRef.current.cancel();
    };
    window.addEventListener('tts-settings-change', handler);
    return () => window.removeEventListener('tts-settings-change', handler);
  }, []);

  const scrollIntoViewIfNeeded = (el: Element | null) => {
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

    switch (state.ttsState) {
      case 'speaking': {
        synthRef.current.pause();
        setState({ ttsState: 'paused' });
        return;
      }
      case 'paused': {
        synthRef.current.resume();
        setState({ ttsState: 'speaking' });
        return;
      }
      case 'idle':
        break;
      default: {
        const _exhaustive: never = state.ttsState;
        throw new Error(`Unhandled ttsState: ${_exhaustive}`);
      }
    }

    const initialBlocks = getReadableBlocks();
    if (initialBlocks.length === 0) return;

    setState({ ttsState: 'speaking' });
    shouldReadRef.current = true;
    utteranceRef.current = null;

    let currentBlockIndex = 0;

    const speakNext = () => {
      if (!shouldReadRef.current) {
        setState({ ttsState: 'idle' });
        clearHighlights();
        return;
      }

      const liveBlocks = getReadableBlocks();

      if (currentBlockIndex >= liveBlocks.length) {
        setState({ ttsState: 'idle' });
        clearHighlights();
        return;
      }

      const block = liveBlocks[currentBlockIndex];
      const utterance = new SpeechSynthesisUtterance(block.textContent ?? '');

      utteranceRef.current = utterance;

      const voiceName = localStorage.getItem('voice');
      const voices = synthRef.current?.getVoices() ?? [];
      const selectedVoice = voiceName
        ? voices.find((v) => v.name === voiceName)
        : null;
      if (selectedVoice) utterance.voice = selectedVoice;
      utterance.rate = parseFloat(localStorage.getItem('rate') || '1');
      utterance.pitch = parseFloat(localStorage.getItem('pitch') || '1');
      utterance.volume = parseFloat(localStorage.getItem('volume') || '1');

      clearHighlights();
      block.classList.add('tts');
      scrollIntoViewIfNeeded(block);

      utterance.onend = () => {
        if (restartingRef.current) {
          restartingRef.current = false;
          setTimeout(speakNext, 50);
          return;
        }
        currentBlockIndex++;
        if (shouldReadRef.current) {
          setTimeout(speakNext, 50);
        }
      };

      utterance.onerror = (e) => {
        if (e.error === 'canceled' && restartingRef.current) {
          restartingRef.current = false;
          setTimeout(speakNext, 50);
        } else if (e.error !== 'canceled') {
          console.error('TTS Error:', e);
          currentBlockIndex++;
          if (shouldReadRef.current) setTimeout(speakNext, 50);
        } else {
          clearHighlights();
        }
      };

      synthRef.current?.speak(utterance);
    };

    setTimeout(speakNext, 100);
  };

  const toggleTranslateBar = () => {
    setState({ showTranslateBar: !state.showTranslateBar });
    setIsOpen(false);
  };

  if (state.document.kind !== 'loaded') return null;
  const { post } = state.document;

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
          className="bg-base-300/50 backdrop-blur-xs border border-base-200 text-base-content hover:bg-base-300/70 rounded-full flex items-center gap-2 pl-5 pr-2 h-14 transition-all"
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
          className="bg-base-300/50 backdrop-blur-xs border border-base-200 text-base-content hover:bg-base-300/70 rounded-full flex items-center gap-2 pl-5 pr-2 h-14 transition-all"
        >
          <span className="text-sm font-medium">Translate</span>
          <div className="bg-primary/10 text-primary rounded-full p-2">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <use href="#translate" />
            </svg>
          </div>
        </button>
        {state.ttsState === 'idle' && (
          <div className="flex items-center gap-1">
            <button
              onClick={toggleSpeech}
              tabIndex={menuTabIndex}
              aria-label="Read Article Aloud"
              className="bg-base-300/50 backdrop-blur-xs border border-base-200 text-base-content hover:bg-base-300/70 rounded-full flex items-center gap-2 pl-5 pr-2 h-14 transition-all"
            >
              <span className="text-sm font-medium">Text-to-Speech</span>
              <div className="bg-secondary/10 text-secondary rounded-full p-2">
                <svg className="w-5 h-5" viewBox="0 0 32 32">
                  <use href="#mic" />
                </svg>
              </div>
            </button>
            <button
              onClick={() => {
                setState({ showSettings: true });
                setIsOpen(false);
              }}
              tabIndex={menuTabIndex}
              aria-label="Voice & speed settings"
              title="Voice & speed settings"
              className="bg-base-300/50 backdrop-blur-xs border border-base-200 text-base-content/60 hover:text-secondary hover:bg-base-300/70 rounded-full h-14 w-14 flex items-center justify-center transition-all shrink-0"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <use href="#controls" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {state.ttsState !== 'idle' && (
        <div className="bg-base-300/50 backdrop-blur-xs border border-base-200 text-base-content rounded-full flex items-center gap-2 pl-5 pr-2 h-14 transition-all">
          <span className="text-sm font-medium pr-2">
            {state.ttsState === 'paused' ? 'Paused' : 'Reading'}
          </span>
          <button
            onClick={toggleSpeech}
            aria-label={state.ttsState === 'paused' ? 'Resume' : 'Pause'}
            className="btn-circle btn-sm bg-secondary/10 text-secondary h-10 w-10 flex items-center justify-center"
          >
            {state.ttsState === 'paused' ? (
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-5 h-5 ml-0.5"
              >
                <use href="#play" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <use href="#pause" />
              </svg>
            )}
          </button>
          <button
            onClick={stopSpeech}
            aria-label="Stop"
            className="btn btn-circle btn-sm bg-error/10 text-error h-10 w-10 flex items-center justify-center ml-1"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <use href="#stop" />
            </svg>
          </button>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label="Menu"
        className="btn btn-circle bg-primary/10 text-primary hover:text-secondary backdrop-blur-xs hover:bg-secondary/10 border-none h-12 w-12 transition-all duration-300 pointer-events-auto"
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
