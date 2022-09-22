import React, { useState, useEffect } from "react";

export default function Header({ onClick }) {
  const [value, setValue] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("q")) {
        setValue(urlParams.get("q"));
      }
    }
  }, []);

  return (
    <form onSubmit={onClick} name="submit" className="flex items-center flex-1">
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
          className="input input-accent bg-base-300 border-2 border-primary placeholder-primary-focus text-primary-focus text-sm rounded-none rounded-bl-lg rounded-tr-lg block w-full pl-10 p-3 ease-linear h-full"
          placeholder="Insert URL"
          defaultValue={value}
          required
        />
        <div className="flex absolute -right-0.5 bottom-0 rotate-180 items-center pointer-events-none">
          <svg
            aria-hidden="true"
            className="w-10 h-10 text-primary"
            viewBox="0 0 24 24">
            <use href="#web" />
          </svg>
        </div>
      </div>
    </form>
  );
}
