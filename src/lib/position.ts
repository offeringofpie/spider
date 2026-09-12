type Entry = {
  readonly url: string;
  readonly offset: number;
};

const storageKey = 'scroll-positions';
const maxEntries = 50;

const isEntry = (value: unknown): value is Entry => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.url === 'string' && typeof candidate.offset === 'number'
  );
};

const read = (): readonly Entry[] => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }

  try {
    const stored = localStorage.getItem(storageKey);
    const parsed: unknown = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
  } catch {
    return [];
  }
};

const write = (entries: readonly Entry[]) => {
  try {
    localStorage.setItem(storageKey, JSON.stringify(entries));
  } catch (error) {
    console.warn('Failed to save scroll position:', error);
  }
};

function savePosition(url: string, offset: number): void {
  const others = read().filter((entry) => entry.url !== url);
  write([{ url, offset }, ...others].slice(0, maxEntries));
}

function readPosition(url: string): number | null {
  return read().find((entry) => entry.url === url)?.offset ?? null;
}

export { savePosition, readPosition };
