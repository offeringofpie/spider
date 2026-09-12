type Availability =
  | 'unavailable'
  | 'downloadable'
  | 'downloading'
  | 'available';

type DownloadMonitor = {
  readonly addEventListener: (
    type: 'downloadprogress',
    listener: (event: { loaded: number }) => void,
  ) => void;
};

type CreateOptions = {
  readonly sourceLanguage: string;
  readonly targetLanguage: string;
  readonly monitor?: (monitor: DownloadMonitor) => void;
};

type NativeTranslator = {
  readonly translate: (text: string) => Promise<string>;
  readonly destroy: () => void;
};

type TranslatorFactory = {
  readonly availability: (options: {
    sourceLanguage: string;
    targetLanguage: string;
  }) => Promise<Availability>;
  readonly create: (options: CreateOptions) => Promise<NativeTranslator>;
};

type LanguageDetectorFactory = {
  readonly create: () => Promise<{
    readonly detect: (
      text: string,
    ) => Promise<{ detectedLanguage: string; confidence: number }[]>;
    readonly destroy: () => void;
  }>;
};

type WidgetElement = new (
  options: { pageLanguage: string },
  hostId: string,
) => unknown;

declare global {
  interface Window {
    Translator?: TranslatorFactory;
    LanguageDetector?: LanguageDetectorFactory;
    googleTranslateElementInit?: () => void;
    google?: { translate: { TranslateElement: WidgetElement } };
  }
}

type TranslateResult =
  | { kind: 'translated' }
  | { kind: 'unsupported'; reason: string }
  | { kind: 'error'; message: string };

type TranslateOptions = {
  readonly sourceLang?: string | null;
  readonly onDownload?: (progress: number) => void;
  readonly onProgress?: (progress: number) => void;
};

const roots = ['#article-title', '#article-dek', '#article-content'] as const;
const skipTags = 'code, pre, script, style, .notranslate';
const minLength = 2;
const batchSize = 8;
const detectSampleLength = 600;
const stallTimeout = 12000;
const stallCheckInterval = 1000;

const hasNativeTranslator = (): boolean => {
  if (typeof window === 'undefined' || !window.Translator) {
    return false;
  }

  return (
    typeof window.Translator.availability === 'function' &&
    typeof window.Translator.create === 'function'
  );
};

let snapshot: { node: Text; text: string }[] | null = null;

const collectTextNodes = () => {
  const nodes: Text[] = [];

  for (const selector of roots) {
    const root = document.querySelector(selector);
    if (!root) {
      continue;
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent || parent.closest(skipTags)) {
          return NodeFilter.FILTER_REJECT;
        }
        const text = node.nodeValue?.trim() ?? '';
        if (text.length < minLength) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  }

  return nodes;
};

const primarySubtag = (lang: string) => {
  return lang.split('-')[0].toLowerCase();
};

const detectLanguage = async (sample: string) => {
  if (!window.LanguageDetector) {
    return null;
  }

  const detector = await window.LanguageDetector.create();
  try {
    const results = await detector.detect(sample);
    return results[0]?.detectedLanguage ?? null;
  } finally {
    detector.destroy();
  }
};

type StallGuard = {
  readonly signal: () => void;
  readonly watch: <T>(work: Promise<T>) => Promise<T>;
};

const stallGuard = (): StallGuard => {
  let last = Date.now();

  return {
    signal: () => {
      last = Date.now();
    },
    watch: (work) => {
      return new Promise((resolve, reject) => {
        const timer = setInterval(() => {
          if (Date.now() - last < stallTimeout) {
            return;
          }
          clearInterval(timer);
          reject(new Error('On-device translator stopped responding'));
        }, stallCheckInterval);

        work.then(resolve, reject).finally(() => clearInterval(timer));
      });
    },
  };
};

const translateBatches = async (
  translator: NativeTranslator,
  texts: readonly string[],
  guard: StallGuard,
  onProgress?: (progress: number) => void,
) => {
  const output: string[] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const translated = await guard.watch(
      Promise.all(batch.map((text) => translator.translate(text))),
    );
    output.push(...translated);
    guard.signal();
    onProgress?.(output.length / texts.length);
  }

  return output;
};

async function translateArticle(
  targetLang: string,
  options: TranslateOptions = {},
): Promise<TranslateResult> {
  const factory = window.Translator;
  if (!factory) {
    return { kind: 'unsupported', reason: 'No on-device translator' };
  }

  restoreArticle();

  const nodes = collectTextNodes();
  if (nodes.length === 0) {
    return { kind: 'error', message: 'Nothing to translate.' };
  }

  const texts = nodes.map((node) => node.nodeValue ?? '');
  const targetLanguage = primarySubtag(targetLang);

  const guard = stallGuard();

  try {
    const sample = texts.join(' ').slice(0, detectSampleLength);
    const detected =
      options.sourceLang ?? (await guard.watch(detectLanguage(sample)));
    if (!detected) {
      return {
        kind: 'error',
        message: 'Could not detect the source language.',
      };
    }

    const sourceLanguage = primarySubtag(detected);
    if (sourceLanguage === targetLanguage) {
      return { kind: 'error', message: 'Already in that language.' };
    }

    guard.signal();
    const availability = await guard.watch(
      factory.availability({ sourceLanguage, targetLanguage }),
    );
    if (availability === 'unavailable') {
      return {
        kind: 'unsupported',
        reason: 'This language pair is not available on this device',
      };
    }

    guard.signal();
    const translator = await guard.watch(
      factory.create({
        sourceLanguage,
        targetLanguage,
        monitor: (monitor) => {
          monitor.addEventListener('downloadprogress', (event) => {
            guard.signal();
            options.onDownload?.(event.loaded);
          });
        },
      }),
    );

    try {
      guard.signal();
      const translated = await translateBatches(
        translator,
        texts,
        guard,
        options.onProgress,
      );

      snapshot = nodes.map((node, i) => ({ node, text: texts[i] }));
      translated.forEach((text, i) => {
        nodes[i].nodeValue = text;
      });

      return { kind: 'translated' };
    } finally {
      translator.destroy();
    }
  } catch (error) {
    console.warn('On-device translation failed:', error);
    return { kind: 'unsupported', reason: 'On-device translation failed' };
  }
}

function restoreArticle(): void {
  if (!snapshot) {
    return;
  }

  for (const { node, text } of snapshot) {
    if (node.isConnected) {
      node.nodeValue = text;
    }
  }
  snapshot = null;
}

const widgetScriptId = 'google-translate-script';
const widgetSrc =
  'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
const widgetSelect = '.goog-te-combo';
const widgetHostId = 'google_translate_element_hidden';
const expiredCookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC';

function loadWidget(): void {
  if (document.getElementById(widgetScriptId)) {
    return;
  }

  window.googleTranslateElementInit = () => {
    const factory = window.google?.translate.TranslateElement;
    if (factory) {
      new factory({ pageLanguage: 'auto' }, widgetHostId);
    }
  };

  const script = document.createElement('script');
  script.id = widgetScriptId;
  script.src = widgetSrc;
  script.async = true;
  document.body.appendChild(script);
}

function widgetReady(): boolean {
  return document.querySelector(widgetSelect) !== null;
}

function setWidgetLanguage(lang: string): void {
  const select = document.querySelector<HTMLSelectElement>(widgetSelect);
  if (!select) {
    return;
  }

  select.value = lang;
  select.dispatchEvent(
    new Event('change', { bubbles: true, cancelable: true }),
  );
}

function clearWidget(): void {
  document.cookie = `${expiredCookie}; path=/;`;
  document.cookie = `${expiredCookie}; path=/; domain=${window.location.hostname}`;
  window.location.reload();
}

export {
  hasNativeTranslator,
  translateArticle,
  restoreArticle,
  loadWidget,
  widgetReady,
  setWidgetLanguage,
  clearWidget,
  widgetHostId,
};
export type { TranslateResult };
