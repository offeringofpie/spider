type Era = 'none' | '1995';

const eraValue: Era = '1995';
const eraParam = 'era';
const eraTheme = `era-${eraValue}`;
const dismissedKey = 'era-dismissed';
const eraDate = { month: 3, day: 1 } as const;

const konamiCode = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
]
  .join('')
  .toLowerCase();

const parseEra = (value: string | null | undefined): Era => {
  return value === eraValue ? eraValue : 'none';
};

const serverEra = (url: URL): Era => {
  return parseEra(url.searchParams.get(eraParam));
};

const pageEra = (): Era => {
  if (typeof document === 'undefined') {
    return 'none';
  }
  return parseEra(document.documentElement.dataset.era);
};

const themeFor = (era: Era, theme: string): string => {
  return era === 'none' ? theme : eraTheme;
};

const inDate = (date: Date): boolean => {
  return (
    date.getMonth() === eraDate.month && date.getDate() === eraDate.day
  );
};

const dropEraParam = (): void => {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(eraParam)) {
    return;
  }
  url.searchParams.delete(eraParam);
  history.replaceState(history.state, '', url);
};

const dismissForToday = (): void => {
  const today = new Date();
  if (!inDate(today)) {
    return;
  }

  try {
    localStorage.setItem(dismissedKey, today.toDateString());
  } catch (error) {
    console.warn('Failed to save era dismissal:', error);
  }
};

const listenForKonami = (onMatch: () => void): void => {
  let code = '';

  window.addEventListener('keyup', (e) => {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
      return;
    }

    code = (code + e.key.toLowerCase()).slice(-konamiCode.length);

    if (code === konamiCode) {
      code = '';
      onMatch();
    }
  });
};

export {
  eraValue,
  eraParam,
  eraTheme,
  dismissedKey,
  eraDate,
  serverEra,
  pageEra,
  themeFor,
  dropEraParam,
  dismissForToday,
  listenForKonami,
};
export type { Era };
