import { useState, useEffect } from 'react';

class Store<T extends object> {
  private state: T;
  private subscribers: ((state: T) => void)[] = [];
  private key: string;
  private persist: (keyof T)[];

  constructor(initialState: T, key: string, persist: (keyof T)[]) {
    this.key = key;
    this.persist = persist;
    this.state = { ...initialState, ...this.readPersisted() };
  }

  private readPersisted(): Partial<T> {
    if (typeof window === 'undefined' || !window.localStorage) return {};

    try {
      const stored = localStorage.getItem(this.key);
      if (!stored) return {};

      const parsed = JSON.parse(stored) as Partial<T>;
      const subset: Partial<T> = {};
      for (const key of this.persist) {
        if (key in parsed) subset[key] = parsed[key];
      }
      return subset;
    } catch {
      return {};
    }
  }

  private saveState() {
    if (typeof window === 'undefined' || !window.localStorage) return;

    try {
      const subset: Partial<T> = {};
      for (const key of this.persist) subset[key] = this.state[key];
      localStorage.setItem(this.key, JSON.stringify(subset));
    } catch (error) {
      console.warn('Failed to save state to localStorage:', error);
    }
  }

  // Get current state
  getState(): T {
    return this.state;
  }

  // Update state, save to localStorage, and notify subscribers
  setState(newState: Partial<T>) {
    this.state = { ...this.state, ...newState };
    this.saveState();
    this.notifySubscribers();
  }

  // Add a subscriber to be notified of state changes
  subscribe(callback: (state: T) => void) {
    this.subscribers.push(callback);
    // Return an unsubscribe function
    return () => {
      this.subscribers = this.subscribers.filter((cb) => cb !== callback);
    };
  }

  // Notify all subscribers of state change
  private notifySubscribers() {
    this.subscribers.forEach((callback) => callback(this.state));
  }
}

// Custom React hook to use the Store in components
function useStore<T extends object>(store: Store<T>) {
  const [state, setState] = useState(store.getState());

  useEffect(() => {
    // Subscribe to store changes and update local state
    return store.subscribe((newState) => setState(newState));
  }, [store]);

  // Return current state and setState function
  return [state, store.setState.bind(store)] as const;
}

interface ParsedPost {
  title: string | null;
  content: string;
  url: string;
  author: string | null;
  word_count: number | null;
  date_published: string | null;
  lead_image_url: string | null;
  dek: string | null;
  excerpt: string | null;
  lang: string | null;
}

interface IdleDoc {
  kind: 'idle';
}
interface LoadingDoc {
  kind: 'loading';
}
interface LoadedDoc {
  kind: 'loaded';
  post: ParsedPost;
  leadImageUrl: string | null;
  paywalled: boolean;
}
interface ErrorDoc {
  kind: 'error';
  message: string;
  url: string;
}

type DocumentState = IdleDoc | LoadingDoc | LoadedDoc | ErrorDoc;

type TtsState = 'idle' | 'speaking' | 'paused';

// Define the shape of the default state
interface DefaultState {
  theme: string;
  font: string;
  document: DocumentState;
  initialized: boolean;
  ttsState: TtsState;
  showTranslateBar: boolean;
  showSettings: boolean;
  textSize: string;
  lineHeight: string;
}

// Create a default store instance
const defaultStore = new Store<DefaultState>(
  {
    theme: 'abyss',
    font: 'font-mono',
    document: { kind: 'idle' },
    initialized: false,
    ttsState: 'idle',
    showTranslateBar: false,
    showSettings: false,
    textSize: 'prose-xl',
    lineHeight: 'leading-relaxed',
  },
  'default-state',
  ['theme', 'font', 'textSize', 'lineHeight'],
);

export { defaultStore, useStore };
export type { ParsedPost, DocumentState, DefaultState };
