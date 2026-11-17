import type { MouseEvent } from 'react';
import { loadArticle } from '../lib/load';
import type { Alternative } from '../lib/types';

type Props = {
  message: string;
  url: string;
  alternatives: Alternative[];
  onUnlock?: () => void;
};

const openInReader = (event: MouseEvent, url: string): void => {
  if (event.metaKey || event.ctrlKey || event.shiftKey) {
    return;
  }
  event.preventDefault();
  loadArticle(url);
};

export default function ArchiveNotice({
  message,
  url,
  alternatives,
  onUnlock,
}: Props) {
  const links = [
    { href: url, label: 'Open original' },
    {
      href: `https://web.archive.org/web/*/${url}`,
      label: 'Search archive.org',
    },
    { href: `https://archive.is/${url}`, label: 'Search archive.is' },
  ];

  return (
    <div className="notice mx-auto max-w-3xl mt-8 flex flex-col gap-3 rounded-lg border border-base-content/20 bg-base-200 p-4 text-sm">
      <div className="flex items-center gap-2 font-medium">
        <svg
          aria-hidden="true"
          className="w-5 h-5 text-warning"
          viewBox="0 0 24 24"
        >
          <use href={`#lock`} />
        </svg>
        <span>{message}</span>
      </div>
      {onUnlock && (
        <button
          type="button"
          onClick={onUnlock}
          className="btn btn-sm btn-primary self-start"
        >
          Unlock full article
        </button>
      )}
      {alternatives.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="font-medium">Also covered by</span>
          <ul className="flex flex-col gap-1">
            {alternatives.map((alt) => (
              <li key={alt.url}>
                <a
                  href={`/?q=${encodeURIComponent(alt.url)}`}
                  onClick={(event) => openInReader(event, alt.url)}
                  className="themed-link text-base-content underline"
                >
                  {alt.title}
                </a>
                <span className="text-base-content/60"> · {alt.source}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap gap-4">
        {links.map((l) => (
          <a
            key={l.label}
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            className="themed-link text-base-content underline"
          >
            {l.label}
          </a>
        ))}
      </div>
    </div>
  );
}
