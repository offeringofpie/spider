import { useState, useEffect } from 'react';

class Store<T> {
  private state: T;
  private subscribers: ((state: T) => void)[] = [];
  private key: string;

  constructor(initialState: T, key: string) {
    this.key = key;

    if (typeof window !== 'undefined' && window.localStorage) {
      const storedState = localStorage.getItem(this.key);
      if (storedState) {
        this.state = { ...initialState, ...JSON.parse(storedState) };
      } else {
        this.state = initialState;
        this.saveState();
      }
    } else {
      this.state = initialState;
    }
  }

  // Load state from localStorage or use initial state if not found
  private loadState(initialState: T): T {
    try {
      const storedState = localStorage.getItem(this.key);
      return storedState ? JSON.parse(storedState) : initialState;
    } catch {
      return initialState;
    }
  }

  // Save current state to localStorage
  private saveState() {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(this.key, JSON.stringify(this.state));
      } catch (error) {
        console.warn('Failed to save state to localStorage:', error);
      }
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
function useStore<T>(store: Store<T>) {
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
  word_count: number | null;
  date_published: string | null;
  lead_image_url: string | null;
  dek: string | null;
  excerpt: string | null;
}

interface ArchiveLink {
  url: string;
  label: string;
}

interface IdleDoc    { kind: 'idle' }
interface LoadingDoc { kind: 'loading' }
interface LoadedDoc  { kind: 'loaded'; post: ParsedPost; leadImageUrl: string | null }
interface ErrorDoc   { kind: 'error'; message: string; archiveLinks: ArchiveLink[] }

type DocumentState = IdleDoc | LoadingDoc | LoadedDoc | ErrorDoc;

// Define the shape of the default state
interface DefaultState {
  theme: string;
  font: string;
  document: DocumentState;
  initialized: boolean;
  isSpeaking: boolean;
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
    isSpeaking: false,
    showTranslateBar: false,
    showSettings: false,
    textSize: 'prose-xl',
    lineHeight: 'leading-relaxed',
  },
  'default-state',
);

if (defaultStore.getState().document.kind !== 'idle') {
  defaultStore.setState({ document: { kind: 'idle' } });
}

export { defaultStore, useStore };
