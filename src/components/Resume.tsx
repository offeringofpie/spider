import { useEffect, useState } from 'react';
import { readPosition, savePosition } from '../lib/position';
import { scrollBehavior } from '../lib/motion';

type Props = {
  readonly url: string;
};

const noticeTimeout = 8000;

export default function Resume({ url }: Props): React.ReactElement | null {
  const [showNotice, setShowNotice] = useState(false);

  useEffect(() => {
    setShowNotice(false);

    const saved = readPosition(url);
    if (saved !== null && saved > window.innerHeight) {
      requestAnimationFrame(() => {
        window.scrollTo({ top: saved, behavior: 'auto' });
        setShowNotice(true);
      });
    }

    let frame = 0;
    const handleScroll = () => {
      if (frame) {
        return;
      }
      frame = requestAnimationFrame(() => {
        frame = 0;
        savePosition(url, Math.round(window.scrollY));
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (frame) {
        cancelAnimationFrame(frame);
      }
    };
  }, [url]);

  useEffect(() => {
    if (!showNotice) {
      return;
    }
    const timer = setTimeout(() => setShowNotice(false), noticeTimeout);
    return () => clearTimeout(timer);
  }, [showNotice]);

  if (!showNotice) {
    return null;
  }

  return (
    <div
      role="status"
      className="fixed bottom-6 left-6 z-50 flex items-center gap-2 rounded-full border border-base-200 bg-base-300/80 backdrop-blur-xs pl-5 pr-2 h-14 text-sm text-base-content print:hidden"
    >
      <span>Resumed where you left off</span>
      <button
        onClick={() => {
          window.scrollTo({ top: 0, behavior: scrollBehavior() });
          setShowNotice(false);
        }}
        className="rounded-full bg-primary/10 text-primary px-4 h-11"
      >
        Back to top
      </button>
      <button
        onClick={() => setShowNotice(false)}
        aria-label="Dismiss"
        className="rounded-full h-11 w-11 text-base-content/60 hover:text-base-content"
      >
        ✕
      </button>
    </div>
  );
}
