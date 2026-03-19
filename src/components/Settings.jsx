import { defaultStore, useStore } from '../store/store';
import ThemeSwitcher from './ThemeSwitcher';
import FontSwitcher from './FontSwitcher';
import TextSettings from './TextSettings';
import Voices from './Voices';

export default function Settings() {
  const [state, setState] = useStore(defaultStore);
  const isVisible = state.showSettings;

  return (
    <div
      inert={!isVisible ? 'true' : undefined}
      className={`w-full bg-base-200 transition-all duration-300 ease-in-out border-b border-primary/20 ${
        isVisible
          ? 'max-h-200 opacity-100 py-6'
          : 'max-h-0 opacity-0 py-0 border-transparent overflow-hidden invisible'
      }`}
    >
      <div
        className={`w-full mx-auto max-w-4xl px-6 relative ${state.showSettings ? 'py-6' : ''}`}
      >
        <button
          onClick={() => setState({ showSettings: false })}
          className="btn btn-ghost btn-lg btn-circle text-base-content absolute top-0 right-4"
          aria-label="Close settings"
        >
          ✕
        </button>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row w-full gap-x-6 gap-y-4 md:items-end">
              <div className="flex flex-col gap-2 flex-1">
                <h3 class="text-center tracking-wider">Appearance</h3>
                <div className="flex w-full h-12 md:mb-2 *:flex-1 *:min-w-0">
                  <ThemeSwitcher />
                  <FontSwitcher />
                </div>
              </div>

              <div className="w-full md:w-2/3">
                <TextSettings />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <h3 class="text-center tracking-wider">Text to Speech</h3>

            <div className="w-full">
              <Voices />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
