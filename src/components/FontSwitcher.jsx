import { useState, useEffect } from 'react';
import { defaultStore, useStore } from '../store/store';

export default function FontSwitcher(props) {
  const [state, setState] = useStore(defaultStore);
  const [font, setFont] = useState('');

  const change = (e) => {
    setState({ font: e.target.value });
  };

  return (
    <select
      className="select select-primary  border-l-0 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-base-100 text-primary-focus hover:text-primary text-sm rounded-none rounded-r-xl cursor-pointer transition-all"
      defaultValue={state.font}
      onChange={change}
      onBlur={change}
      tabIndex={state.showSettings ? 0 : -1} // Integrated accessibility
    >
      <option disabled>Select Font</option>
      <option value="font-comic">Comic</option>
      <option value="font-cursive">Cursive</option>
      <option value="font-fantasy">Fantasy</option>
      <option value="font-mono">Mono</option>
      <option value="font-sans">Sans-serif</option>
      <option value="font-serif">Serif</option>
      <option value="font-typewriter">Typewriter</option>
      <option value="font-editorial">Editorial</option>
    </select>
  );
}
