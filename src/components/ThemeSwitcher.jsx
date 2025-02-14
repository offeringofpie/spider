import { useEffect } from "react";
import { defaultStore, useStore } from '../store/store';

// import { themeChange } from "theme-change";

export default function ThemeSwitcher(props) {
  const [state, setState] = useStore(defaultStore);

  const change = (e) => {
    setState({theme: e.target.value});
  }
  
  // useEffect(() => {
  //   themeChange(false);
  //   // 👆 false parameter is required for react project
  // }, []);
  return (
    <select
      className="select bg-base-300 border-primary focus:border-primary border-r-0 focus:outline-0 text-primary-focus hover:text-primary text-sm rounded-none rounded-l-xl cursor-pointer"
      defaultValue={state.theme}
      onChange={change}
      onBlur={change}>
      <option disabled>Dark Themes</option>
      <option value="aqua">Aqua</option>
      <option value="abyss">Abyss</option>
      <option value="black">Black</option>
      <option value="business">Business</option>
      <option value="coffee">Coffee</option>
      <option value="dark">Dark</option>
      <option value="dim">Dim</option>
      <option value="dracula">Dracula</option>
      <option value="forest">Forest</option>
      <option value="halloween">halloween</option>
      <option value="luxury">Luxury</option>
      <option value="night">Night</option>
      <option value="sunset">Sunset</option>
      <option value="synthwave">Synthwave</option>
      <option disabled>Light Themes</option>
      <option value="acid">Acid</option>
      <option value="autumn">Autumn</option>
      <option value="bumblebee">Bumblebee</option>
      <option value="cmyk">Cmyk</option>
      <option value="caramellatte">caramellatte</option>
      <option value="cmyk">CMYK</option>
      <option value="corporate">Corporate</option>
      <option value="cupcake">Cupcake</option>
      <option value="cyberpunk">Cyberpunk</option>
      <option value="emerald">Emerald</option>
      <option value="fantasy">Fantasy</option>
      <option value="garden">Garden</option>
      <option value="lemonade">Lemonade</option>
      <option value="light">Light</option>
      <option value="lofi">Lofi</option>
      <option value="nord">Nord</option>
      <option value="pastel">Pastel</option>
      <option value="retro">Retro</option>
      <option value="silk">Silk</option>
      <option value="valentine">Valentine</option>
      <option value="winter">Winter</option>
      <option value="wireframe">Wireframe</option>
    </select>
  );
}
