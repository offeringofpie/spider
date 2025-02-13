import React, { useState, useEffect } from "react";

export default function Header(props) {
  const [value, setValue] = useState("");
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("q")) {
        setValue(urlParams.get("q"));
      }
    }
  }, []);

  const speak = (ev) => {
    setPlaying(!playing);
    props.onSpeak(ev);
  };

  return (
    <div className="flex items-center w-full">
      <form onSubmit={props.onClick} name="submit" className="flex-1">
        <div className="relative w-full">
          <div className="flex absolute -left-0.5 items-center pointer-events-none">
            <svg
              aria-hidden="true"
              className="w-10 h-10 text-primary"
              viewBox="0 0 24 24">
              <use href="#web" />
            </svg>
          </div>
          <input
            type="text"
            id="url"
            className="input input-accent bg-base-300 border-2 border-r-0 border-primary placeholder-primary-focus text-primary-focus text-sm rounded-none rounded-bl-lg block w-full pl-10 p-3 ease-linear h-full"
            placeholder="Insert URL"
            defaultValue={value}
            required
          />
        </div>
      </form>
      <button
        className={`${
          playing && props.loaded ? "text-primary" : "text-primary-focus"
        } hover:text-primary h-full bg-base-300 border-primary border-2 border-l-0 rounded-tr-xl pr-1`}
        onClick={speak}>
        <svg aria-hidden="true" className="w-6 h-6" viewBox="0 0 20 20">
          <use href="#mic" />
        </svg>
      </button>
    </div>
  );
}
