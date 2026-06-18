import { defaultStore, useStore } from '../store/store';

interface Props {
  variant?: 'header' | 'fab';
  tabIndex?: number;
}

const SettingsButton = ({ variant = 'header', tabIndex = 0 }: Props) => {
  const [state, setState] = useStore(defaultStore);

  const toggleSettings = () => {
    setState({
      showSettings: !state.showSettings,
      ...(!state.showSettings && { showTranslateBar: false }),
    });
  };

  return variant === 'fab' ? (
    <button
      onClick={toggleSettings}
      tabIndex={tabIndex}
      aria-label="Settings"
      className="bg-base-300/50 backdrop-blur-xs border border-base-200 text-base-content hover:bg-base-300/70 rounded-full flex items-center gap-2 pl-5 pr-2 h-14 transition-all"
    >
      <span className="text-sm font-medium">Settings</span>
      <div className="bg-info/10 text-info rounded-full p-2">
        <svg
          aria-hidden="true"
          className="w-5 h-5"
          viewBox="0 0 512.002 512.002"
        >
          <use href="#spiderweb" />
        </svg>
      </div>
    </button>
  ) : (
    <button
      onClick={toggleSettings}
      tabIndex={tabIndex}
      className={`text-primary-focus cursor-pointer hover:text-primary h-full relative transition-all duration-300 ${state.showSettings ? 'text-primary rotate-180 origin-center' : ''}`}
      title="Settings"
      aria-label="Settings"
    >
      <svg aria-hidden="true" className="w-10 h-10" viewBox="0 0 24 24">
        <use href="#spiderweb" />
      </svg>
    </button>
  );
};

export default SettingsButton;
