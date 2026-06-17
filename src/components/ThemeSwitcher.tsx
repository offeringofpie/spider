import { defaultStore, useStore } from '../store/store';

export default function ThemeSwitcher() {
  const [state, setState] = useStore(defaultStore);

  const change = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setState({ theme: e.target.value });
  };
  return (
    <select
      className="select select-primary border-r-0 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-base-100 text-primary-focus hover:text-primary text-sm rounded-none rounded-l-xl cursor-pointer transition-all"
      defaultValue={state.theme}
      onChange={change}
      onBlur={change}
      tabIndex={state.showSettings ? 0 : -1}
    >
      <option disabled>Dark Themes</option>
      <option value="abyss">Abyss</option>
      <option value="coffee">Coffee</option>
      <option value="dark">Dark</option>
      <option value="dracula">Dracula</option>
      <option value="night">Night</option>
      <option value="luxury">Luxury</option>
      <option value="sunset">Sunset</option>
      <option value="synthwave">Synthwave</option>
      <option disabled>Light Themes</option>
      <option value="caramellatte">caramellatte</option>
      <option value="cmyk">CMYK</option>
      <option value="cyberpunk">Cyberpunk</option>
      <option value="light">Light</option>
      <option value="lofi">Lofi</option>
      <option value="valentine">Valentine</option>
    </select>
  );
}
