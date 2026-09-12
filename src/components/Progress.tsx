import { useState, useEffect, useRef } from 'react';
import { defaultStore, useStore } from '../store/store';

export default function Progress(): React.ReactElement | null {
  const [state] = useStore(defaultStore);
  const [percent, setPercent] = useState(0);
  const frame = useRef(0);

  useEffect(() => {
    const measure = () => {
      frame.current = 0;
      const scrollable =
        document.documentElement.scrollHeight -
        document.documentElement.clientHeight;
      setPercent(
        scrollable > 0
          ? Math.min(100, Math.max(0, (window.scrollY / scrollable) * 100))
          : 0,
      );
    };

    const handleScroll = () => {
      if (frame.current) {
        return;
      }
      frame.current = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      if (frame.current) {
        cancelAnimationFrame(frame.current);
      }
    };
  }, [state.document]);

  if (state.document.kind !== 'loaded') {
    return null;
  }

  return (
    <div
      role="progressbar"
      aria-label="Reading progress"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="fixed top-0 left-0 z-50 w-full h-1 backdrop-blur-sm print:hidden"
    >
      <hr
        className="drop-shadow-xl bg-linear-to-r from-secondary/50 to-secondary absolute h-full left-0 top-0 border-none"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
