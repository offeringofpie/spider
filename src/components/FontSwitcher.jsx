import { useState, useEffect } from "react";
import { defaultStore, useStore } from '../store/store';

export default function FontSwitcher(props) {
  const [state, setState] = useStore(defaultStore);
  const [font, setFont] = useState("");

  const change = (e) => {
    setState({font: e.target.value});
  }

  return (
    <select
      className="select bg-base-300 border-primary focus:border-primary border-l-0 focus:outline-0 text-primary-focus hover:text-primary text-sm rounded-none rounded-r-xl"
      defaultValue={state.font}
      onChange={change}
      onBlur={change}>
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
