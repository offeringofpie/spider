interface Theme {
  value: string;
  label: string;
}

const darkThemeList: Theme[] = [
  { value: 'abyss', label: 'Abyss' },
  { value: 'coffee', label: 'Coffee' },
  { value: 'dark', label: 'Dark' },
  { value: 'dracula', label: 'Dracula' },
  { value: 'night', label: 'Night' },
  { value: 'luxury', label: 'Luxury' },
  { value: 'sunset', label: 'Sunset' },
  { value: 'synthwave', label: 'Synthwave' },
];

const lightThemeList: Theme[] = [
  { value: 'caramellatte', label: 'Caramel Latte' },
  { value: 'cmyk', label: 'CMYK' },
  { value: 'cyberpunk', label: 'Cyberpunk' },
  { value: 'light', label: 'Light' },
  { value: 'lofi', label: 'Lofi' },
  { value: 'valentine', label: 'Valentine' },
];

const lightThemes = new Set(lightThemeList.map((t) => t.value));

const isLight = (theme: string) => {
  return lightThemes.has(theme);
};

export { darkThemeList, lightThemeList, lightThemes, isLight };
export type { Theme };
