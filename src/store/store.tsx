import { useState, useEffect } from 'react';
import type { ParsedPost } from '../lib/types';

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
    if (typeof window === 'undefined' || !window.localStorage) {
      return {};
    }

    try {
      const stored = localStorage.getItem(this.key);
      if (!stored) {
        return {};
      }

      const parsed = JSON.parse(stored) as Partial<T>;
      const subset: Partial<T> = {};
      for (const key of this.persist) {
        if (key in parsed) {
          subset[key] = parsed[key];
        }
      }
      return subset;
    } catch {
      return {};
    }
  }

  private saveState() {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    try {
      const subset: Partial<T> = {};
      for (const key of this.persist) subset[key] = this.state[key];
      localStorage.setItem(this.key, JSON.stringify(subset));
    } catch (error) {
      console.warn('Failed to save state to localStorage:', error);
    }
  }

  getState(): T {
    return this.state;
  }

  setState(newState: Partial<T>) {
    this.state = { ...this.state, ...newState };
    this.saveState();
    this.notifySubscribers();
  }

  subscribe(callback: (state: T) => void) {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter((cb) => cb !== callback);
    };
  }

  private notifySubscribers() {
    this.subscribers.forEach((callback) => callback(this.state));
  }
}

function useStore<T extends object>(store: Store<T>) {
  const [state, setState] = useState(store.getState());

  useEffect(() => {
    return store.subscribe((newState) => setState(newState));
  }, [store]);

  return [state, store.setState.bind(store)] as const;
}

type IdleDoc = { kind: 'idle' };

type LoadingDoc = { kind: 'loading'; url: string; step: string | null };

type LoadedDoc = {
  kind: 'loaded';
  post: ParsedPost;
  leadImageUrl: string | null;
  paywalled: boolean;
  stage: 'draft' | 'final';
};

type ErrorDoc = {
  kind: 'error';
  message: string;
  url: string;
};

type DocumentState = IdleDoc | LoadingDoc | LoadedDoc | ErrorDoc;

type TtsState = 'idle' | 'speaking' | 'paused';

type DefaultState = {
  theme: string;
  font: string;
  document: DocumentState;
  initialized: boolean;
  ttsState: TtsState;
  showTranslateBar: boolean;
  showSettings: boolean;
  textSize: string;
  lineHeight: string;
};

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
export type { ParsedPost, DocumentState, LoadedDoc, DefaultState };
