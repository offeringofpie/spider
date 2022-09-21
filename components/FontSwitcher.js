import { useState, useEffect } from "react";

export default function FontSwitcher(props) {
  const [font, setFont] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (localStorage.getItem("font")) {
        setFont(localStorage.getItem("font"));
      }
    }
  }, []);

  const updateFont = (ev) => {
    if (typeof window !== "undefined") {
      setFont(localStorage.setItem("font", ev.target.value));
      setFont(localStorage.getItem("font"));
    }
    props.onChange(ev);
  };

  return (
    <select
      className="select bg-base-300 border-primary border-2 focus:border-primary border-l-0 focus:outline-0 placeholder-primary-focus text-primary-focus text-sm max-w-xs flex-none rounded-none rounded-br-xl"
      value={font}
      data-value={font}
      onChange={updateFont}>
      <option disabled>Select Font</option>
      <option value="font-comic">Comic</option>
      <option value="font-cursive">Cursive</option>
      <option value="font-fantasy">Fantasy</option>
      <option value="font-mono">Mono</option>
      <option value="font-sans">Sans-serif</option>
      <option value="font-serif">Serif</option>
      <option value="font-typewriter">Typewriter</option>
    </select>
  );
}
