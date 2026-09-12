import { useState } from 'react';
import type { ParseAttempt } from '../lib/types';
import { loadArticle } from '../lib/load';

type Props = {
  readonly attempts: readonly ParseAttempt[];
  readonly url: string;
};

const labels = {
  googlebot: 'Googlebot',
  regular: 'Browser headers',
  bingbot: 'Bingbot',
  alternates: 'Feeds and Markdown',
  wayback: 'Wayback Machine',
  savepage: 'Save Page Now',
} as const;

const retryOrder = [
  'regular',
  'googlebot',
  'bingbot',
  'alternates',
  'wayback',
  'savepage',
] as const;

const marks = {
  failure: { glyph: '✕', tone: 'text-error' },
  partial: { glyph: '◐', tone: 'text-warning' },
  skipped: { glyph: '–', tone: 'text-base-content/40' },
} as const;

const label = (step: string): string => {
  return labels[step as keyof typeof labels] ?? step;
};

const detail = (attempt: ParseAttempt): string => {
  switch (attempt.status) {
    case 'failure': {
      return attempt.error;
    }
    case 'partial': {
      return 'Recovered partial content only';
    }
    case 'skipped': {
      return attempt.reason;
    }
    default: {
      const _exhaustive: never = attempt;
      throw new Error(
        `Unhandled attempt status: ${JSON.stringify(_exhaustive)}`,
      );
    }
  }
};

export default function Attempts({
  attempts,
  url,
}: Props): React.ReactElement | null {
  const [expanded, setExpanded] = useState(false);

  if (attempts.length === 0) {
    return null;
  }

  const tried = new Set(
    attempts
      .filter((attempt) => attempt.status !== 'skipped')
      .map((attempt) => attempt.step),
  );
  const retries = retryOrder.filter((step) => !tried.has(step));

  return (
    <div className="mx-auto max-w-3xl mt-8 rounded-lg border border-base-content/20 bg-base-200 text-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-2 p-4 text-left"
      >
        <span className="font-medium">
          {attempts.length} fetch {attempts.length === 1 ? 'method' : 'methods'}{' '}
          tried
        </span>
        <span
          aria-hidden="true"
          className={`transition-all duration-300 ease-in-out ${expanded ? 'rotate-180' : ''}`}
        >
          ▾
        </span>
      </button>

      {expanded && (
        <div className="flex flex-col gap-4 border-t border-base-content/10 p-4">
          <ul className="flex flex-col gap-2">
            {attempts.map((attempt, position) => (
              <li
                key={`${attempt.step}-${position}`}
                className="flex flex-col gap-1 sm:flex-row sm:gap-3"
              >
                <span className="flex items-center gap-3 sm:w-40 sm:shrink-0">
                  <span
                    aria-hidden="true"
                    className={marks[attempt.status].tone}
                  >
                    {marks[attempt.status].glyph}
                  </span>
                  {label(attempt.step)}
                </span>
                <span className="min-w-0 text-base-content/60 wrap-break-word">
                  {detail(attempt)}
                </span>
              </li>
            ))}
          </ul>

          {retries.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-base-content/60">Try another method</span>
              <div className="flex flex-wrap gap-2">
                {retries.map((step) => (
                  <button
                    key={step}
                    onClick={() => {
                      loadArticle(url, { strategy: step, history: 'none' });
                    }}
                    className="btn btn-sm btn-outline btn-primary"
                  >
                    {label(step)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
