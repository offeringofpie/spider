import { useEffect, useState } from "react";

export default function Buttons(props) {
  const [isWindow, setWindow] = useState(false);
  const print = (ev) => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      setWindow(true);
    }
  }, []);

  return (
    <div className="pr-2 bg-base-300 border-primary border-2 focus:border-primary border-l-0 focus:outline-0 placeholder-primary-focus text-sm max-w-xs flex-none rounded-tr-lg">
      <button
        className="h-full text-primary-focus hover:text-primary"
        onClick={print}>
        <svg aria-hidden="true" className="w-6 h-6" viewBox="0 0 20 20">
          <use href="#print" />
        </svg>
      </button>
      {isWindow ? (
        <button
          className="h-full text-primary-focus hover:text-primary"
          onClick={props.onSpeak}>
          <svg aria-hidden="true" className="w-6 h-6" viewBox="0 0 20 20">
            <use href="#mic" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
