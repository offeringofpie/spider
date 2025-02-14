import { useState, useEffect, useCallback } from "react";

export default function Progress() {
  const [scrolled, setScrolled] = useState(0);

  const handleScroll = useCallback(() => {
    const scrollPx = window.scrollY;
    const winHeightPx = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const scroll = `${(scrollPx / winHeightPx) * 100}%`;
    setScrolled(scroll);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.addEventListener("scroll", handleScroll);

      return () => {
        window.removeEventListener("scroll", handleScroll);
      };
    }
  }, [handleScroll]);

  return (
    <div className="bg-ghost fixed w-full h-1">
      <hr
        className="drop-shadow-xl bg-secondary absolute w-full h-full left-0 top-0 border-none animate-pulse"
        style={{
          width: scrolled,
        }}
      />
    </div>
  );
}
