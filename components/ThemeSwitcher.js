import { useEffect } from "react";
import { themeChange } from "theme-change";

export default function ThemeSwitcher(props) {
  useEffect(() => {
    themeChange(false);
    // 👆 false parameter is required for react project
  }, []);
  return (
    <select
      className="select bg-base-300 border-primary focus:border-primary border-r-0 focus:outline-0 text-primary-focus hover:text-primary text-sm rounded-none rounded-l-xl"
      data-choose-theme
      defaultValue="dark">
      <option disabled>Dark Themes</option>
      <option value="aqua">Aqua</option>
      <option value="business">Business</option>
      <option value="coffee">Coffee</option>
      <option value="dark">Dark</option>
      <option value="dracula">Dracula</option>
      <option value="forest">Forest</option>
      <option value="luxury">Luxury</option>
      <option value="night">Night</option>
      <option value="synthwave">Synthwave</option>
      <option disabled>Light Themes</option>
      <option value="acid">Acid</option>
      <option value="autumn">Autumn</option>
      <option value="bumblebee">Bumblebee</option>
      <option value="cmyk">Cmyk</option>
      <option value="corporate">Corporate</option>
      <option value="cupcake">Cupcake</option>
      <option value="cyberpunk">Cyberpunk</option>
      <option value="emerald">Emerald</option>
      <option value="fantasy">Fantasy</option>
      <option value="garden">Garden</option>
      <option value="halloween">Halloween</option>
      <option value="lemonade">Lemonade</option>
      <option value="light">Light</option>
      <option value="lofi">Lofi</option>
      <option value="pastel">Pastel</option>
      <option value="retro">Retro</option>
      <option value="valentine">Valentine</option>
      <option value="winter">Winter</option>
      <option value="wireframe">Wireframe</option>
    </select>
  );
}
