import React, { useState, useEffect, useRef } from 'react';
import { defaultStore, useStore } from '../store/store';

export default function Fab() {
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useStore(defaultStore);
  const [copied, setCopied] = useState(false);

  const [isSpeaking, setIsSpeaking] = useState(false);
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

  const toggleSpeech = () => {
    if (!synthRef.current) return;
    if (isSpeaking) {
      synthRef.current.cancel();
      setIsSpeaking(false);
      return;
    }
    const titleElem = document.querySelector('article h1');
    const contentElem = document.querySelector('article .prose');

    let textToRead = '';

    if (titleElem && contentElem) {
      textToRead = `${titleElem.innerText}. ${contentElem.innerText}`;
    } else if (state.posts) {
      try {
        const post = JSON.parse(state.posts);
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = post.content;
        textToRead = `${post.title}. ${tempDiv.innerText || tempDiv.textContent || ''}`;
      } catch (e) {
        console.error('Failed to parse post for speech fallback', e);
      }
    }

    if (!textToRead) return;

    const utterance = new SpeechSynthesisUtterance(textToRead);

    const voiceName = localStorage.getItem('voice');
    const voices = synthRef.current.getVoices();

    if (voiceName) {
      const selectedVoice = voices.find((v) => v.name === voiceName);
      if (selectedVoice) utterance.voice = selectedVoice;
    }

    utterance.rate = parseFloat(localStorage.getItem('rate') || '1');
    utterance.pitch = parseFloat(localStorage.getItem('pitch') || '1');

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false); // Safety catch

    synthRef.current.speak(utterance);
    setIsSpeaking(true);
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

        <button
          onClick={toggleSpeech}
          tabIndex={menuTabIndex}
          aria-label={isSpeaking ? 'Stop Reading Aloud' : 'Read Article Aloud'}
          className="btn bg-base-100 text-base-content hover:bg-base-200 border-none rounded-full flex items-center gap-2 pl-5 pr-2 h-14"
        >
          <span className="text-sm font-medium">
            {isSpeaking ? 'Stop Reading' : 'Text-to-Speech'}
          </span>
          <div
            className={`${isSpeaking ? 'bg-error/10 text-error' : 'bg-secondary/10 text-secondary'} rounded-full p-2`}
          >
            {isSpeaking ? (
              <span>◻️</span>
            ) : (
              <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 32 32">
                <use href="#mic" />
              </svg>
            )}
          </div>
        </button>
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
          className={`w-6 h-6 transition-transform duration-300 ease-in-out ${isOpen ? 'rotate-[135deg]' : 'rotate-0'}`}
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
