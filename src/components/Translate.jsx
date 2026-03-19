import React, { useEffect, useState } from 'react';
import { defaultStore, useStore } from '../store/store';

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'nl', name: 'Dutch' },
  { code: 'fr', name: 'French' },
  { code: 'es', name: 'Spanish' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pl', name: 'Polish' },
  { code: 'cs', name: 'Czech' },
  { code: 'zh-CN', name: 'Chinese (Simplified)' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'eo', name: 'Esperanto' },
  { code: 'la', name: 'Latin' },
];

export default function TranslateBar() {
  const [state, setState] = useStore(defaultStore);
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);

  const [selectedLang, setSelectedLang] = useState('');

  useEffect(() => {
    if (!state.showTranslateBar) return;

    if (!document.getElementById('google-translate-script')) {
      window.googleTranslateElementInit = () => {
        new window.google.translate.TranslateElement(
          { pageLanguage: 'auto' },
          'google_translate_element_hidden',
        );
      };
      const script = document.createElement('script');
      script.id = 'google-translate-script';
      script.src =
        'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      script.async = true;
      document.body.appendChild(script);
    }

    let attempts = 0;
    const checkReady = setInterval(() => {
      attempts++;
      if (document.querySelector('.goog-te-combo')) {
        setIsReady(true);
        clearInterval(checkReady);
      } else if (attempts > 30) {
        setHasError(true);
        clearInterval(checkReady);
      }
    }, 500);

    return () => clearInterval(checkReady);
  }, [state.showTranslateBar]);

  const handleTranslateClick = () => {
    if (!selectedLang) return;

    if (selectedLang === 'auto') {
      document.cookie =
        'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      document.cookie =
        'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=' +
        document.domain;

      window.location.reload();
      return;
    }

    const select = document.querySelector('.goog-te-combo');
    if (select) {
      select.value = selectedLang;
      select.dispatchEvent(
        new Event('change', { bubbles: true, cancelable: true }),
      );
    }
  };

  return (
    <div
      className={`w-full bg-base-300 transition-all duration-300 ease-in-out notranslate ${state.showTranslateBar ? 'max-h-20 border-b border-primary/20' : 'max-h-0 overflow-hidden'}`}
    >
      <div className="w-full mx-auto max-w-4xl px-6 p-4 flex items-center justify-between">
        <h3 className="text-base-content hidden sm:block">Translate</h3>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end relative">
          <div id="google_translate_element_hidden" className="sr-only"></div>

          <select
            className={`select select-bordered select-sm w-full max-w-xs bg-base-100 ${hasError ? 'select-error text-error' : 'select-primary'}`}
            onChange={(e) => setSelectedLang(e.target.value)}
            value={selectedLang}
            disabled={!isReady || hasError}
          >
            <option value="" disabled>
              {hasError
                ? 'Translation blocked'
                : isReady
                  ? 'Select language...'
                  : 'Connecting to Google...'}
            </option>
            {isReady && <option value="auto">Restore</option>}
            {isReady && <option disabled>──────────</option>}
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>

          <button
            onClick={handleTranslateClick}
            disabled={!isReady || !selectedLang || hasError}
            className="btn btn-ghost btn-sm"
          >
            <svg
              aria-hidden="true"
              className="w-5 h-5 text-primary"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <use href="#translate" />
            </svg>
          </button>

          <button
            onClick={() => setState({ showTranslateBar: false })}
            className="btn btn-ghost btn-lg btn-circle text-base-content ml-2"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
