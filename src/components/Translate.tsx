import { useEffect, useState } from 'react';
import { defaultStore, useStore } from '../store/store';
import {
  clearWidget,
  hasNativeTranslator,
  loadWidget,
  restoreArticle,
  setWidgetLanguage,
  translateArticle,
  widgetHostId,
  widgetReady,
} from '../lib/translate';

const languages = [
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
] as const;

const restoreValue = 'auto';
const readyPollInterval = 500;
const readyPollLimit = 30;

type Engine = 'pending' | 'native' | 'widget';

type Status =
  | { kind: 'idle' }
  | { kind: 'downloading'; progress: number }
  | { kind: 'working'; progress: number }
  | { kind: 'error'; message: string };

export default function TranslateBar(): React.ReactElement {
  const [state, setState] = useStore(defaultStore);
  const [engine, setEngine] = useState<Engine>('pending');
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [translated, setTranslated] = useState(false);
  const [selectedLang, setSelectedLang] = useState('');

  const doc = state.document;
  const sourceLang = doc.kind === 'loaded' ? doc.post.lang : null;

  useEffect(() => {
    if (hasNativeTranslator()) {
      setEngine('native');
      setIsReady(true);
      return;
    }
    setEngine('widget');
  }, []);

  useEffect(() => {
    if (engine !== 'native') {
      return;
    }

    restoreArticle();
    setTranslated(false);
    setStatus({ kind: 'idle' });
    setSelectedLang('');
  }, [doc, engine]);

  useEffect(() => {
    if (engine !== 'widget' || !state.showTranslateBar) {
      return;
    }

    loadWidget();

    let polls = 0;
    const timer = setInterval(() => {
      polls++;
      if (widgetReady()) {
        setIsReady(true);
        clearInterval(timer);
        return;
      }
      if (polls > readyPollLimit) {
        setHasError(true);
        clearInterval(timer);
      }
    }, readyPollInterval);

    return () => clearInterval(timer);
  }, [engine, state.showTranslateBar]);

  const runWidget = () => {
    if (selectedLang === restoreValue) {
      clearWidget();
      return;
    }
    setWidgetLanguage(selectedLang);
  };

  const runNative = async () => {
    if (selectedLang === restoreValue) {
      restoreArticle();
      setTranslated(false);
      setStatus({ kind: 'idle' });
      return;
    }

    setStatus({ kind: 'working', progress: 0 });

    const result = await translateArticle(selectedLang, {
      sourceLang,
      onDownload: (progress) => setStatus({ kind: 'downloading', progress }),
      onProgress: (progress) => setStatus({ kind: 'working', progress }),
    });

    switch (result.kind) {
      case 'translated': {
        setTranslated(true);
        setStatus({ kind: 'idle' });
        return;
      }
      case 'unsupported': {
        setEngine('widget');
        setIsReady(false);
        setStatus({
          kind: 'error',
          message: `${result.reason}. Using Google.`,
        });
        return;
      }
      case 'error': {
        setStatus({ kind: 'error', message: result.message });
        return;
      }
      default: {
        const _exhaustive: never = result;
        throw new Error(`Unhandled translate result: ${_exhaustive}`);
      }
    }
  };

  const handleTranslateClick = () => {
    if (!selectedLang) {
      return;
    }
    if (engine === 'native') {
      runNative();
      return;
    }
    runWidget();
  };

  const isBusy = status.kind === 'downloading' || status.kind === 'working';

  const placeholder = () => {
    if (hasError) {
      return 'Translation blocked';
    }
    if (isReady) {
      return 'Select language...';
    }
    return engine === 'native' ? 'Preparing...' : 'Connecting to Google...';
  };

  const message = () => {
    switch (status.kind) {
      case 'downloading': {
        return `Downloading language model ${Math.round(status.progress * 100)}%`;
      }
      case 'working': {
        return `Translating ${Math.round(status.progress * 100)}%`;
      }
      case 'error': {
        return status.message;
      }
      case 'idle': {
        return engine === 'native' ? 'Translate on device' : 'Translate';
      }
      default: {
        const _exhaustive: never = status;
        throw new Error(`Unhandled status: ${_exhaustive}`);
      }
    }
  };

  const canRestore = engine === 'native' ? translated : isReady;

  return (
    <div
      inert={!state.showTranslateBar ? true : undefined}
      role="region"
      aria-label="Translate"
      className={`translator w-full bg-base-300 transition-all duration-300 ease-in-out notranslate ${
        state.showTranslateBar
          ? 'max-h-20 border-b border-primary/20'
          : 'max-h-0 overflow-hidden invisible'
      }`}
    >
      <div className="w-full mx-auto max-w-4xl px-6 p-4 flex items-center justify-between">
        <div
          className={`hidden sm:block ${status.kind === 'error' ? 'text-error' : 'text-base-content'}`}
          role={isBusy || status.kind === 'error' ? 'status' : undefined}
        >
          {message()}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end relative">
          <div id={widgetHostId} className="sr-only"></div>

          <select
            aria-label="Translate page to"
            className={`select select-bordered select-sm w-full max-w-xs bg-base-100 ${hasError ? 'select-error text-error' : 'select-primary'}`}
            onChange={(e) => setSelectedLang(e.target.value)}
            value={selectedLang}
            disabled={!isReady || hasError || isBusy}
          >
            <option value="" disabled>
              {placeholder()}
            </option>
            {canRestore && <option value={restoreValue}>Restore</option>}
            {canRestore && <option disabled>──────────</option>}
            {languages.map((language) => (
              <option key={language.code} value={language.code}>
                {language.name}
              </option>
            ))}
          </select>

          <button
            onClick={handleTranslateClick}
            disabled={!isReady || !selectedLang || hasError || isBusy}
            aria-label="Translate page"
            className="btn btn-ghost btn-sm"
          >
            {isBusy ? (
              <span className="loading loading-spinner loading-xs text-primary"></span>
            ) : (
              <svg
                aria-hidden="true"
                className="w-5 h-5 text-primary"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <use href="#translate" />
              </svg>
            )}
          </button>

          <button
            onClick={() => setState({ showTranslateBar: false })}
            aria-label="Close translate bar"
            className="btn btn-ghost btn-lg btn-circle text-base-content ml-2"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
