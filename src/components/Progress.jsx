import { useState, useEffect, useCallback } from "react";
export default function Progress() {
  const [scrolled, setScrolled] = useState(0);

  const handleScroll = useCallback((ev) => {
    const scrollPx = document.querySelector(".drawer-content").scrollTop;
    const winHeightPx =
      document.querySelector(".drawer-content").scrollHeight -
      document.querySelector(".drawer-content").clientHeight;
    const scroll = `${(scrollPx / winHeightPx) * 100}%`;
    setScrolled(scroll);
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      document
        .querySelector(".drawer-content")
        .addEventListener("scroll", handleScroll);

      return () => {
        document
          .querySelector(".drawer-content")
          .removeEventListener("scroll", handleScroll);
      };
    }
  }, [setScrolled]);
  return (
    <div className="bg-ghost fixed w-full h-1">
      <hr
        className="drop-shadow-xl bg-primary-focus absolute w-full h-full left-0 top-0 border-none animate-pulse"
        style={{
          width: `${scrolled}`,
        }}
      />
    </div>
  );
}
