import { defaultStore, useStore } from '../store/store';
import { darkThemeList, lightThemeList } from '../lib/themes';

export default function ThemeSwitcher() {
  const [state, setState] = useStore(defaultStore);

  const change = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setState({ theme: e.target.value });
  };
  return (
    <select
      aria-label="Theme"
      className="select select-primary border-r-0 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-base-100 text-primary hover:text-primary text-sm rounded-none rounded-l-xl cursor-pointer transition-all"
      defaultValue={state.theme}
      onChange={change}
      onBlur={change}
      tabIndex={state.showSettings ? 0 : -1}
    >
      <option disabled>Dark Themes</option>
      {darkThemeList.map((theme) => {
        return (
          <option key={theme.value} value={theme.value}>
            {theme.label}
          </option>
        );
      })}
      <option disabled>Light Themes</option>
      {lightThemeList.map((theme) => {
        return (
          <option key={theme.value} value={theme.value}>
            {theme.label}
          </option>
        );
      })}
    </select>
  );
}
