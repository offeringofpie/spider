import { useState, useEffect } from 'react';
import { defaultStore, useStore } from '../store/store';

import ThemeSwitcher from './ThemeSwitcher';
import FontSwitcher from './FontSwitcher';
import TextSettings from './TextSettings';
import Voices from './Voices';

const SettingsButton = () => {
  const [copied, setCopied] = useState(false);
  const [state, setState] = useStore(defaultStore);
  const [post, setPost] = useState(false);

  useEffect(() => {
    if (state.posts) {
      setPost(JSON.parse(state.posts));
    }
  }, [state.posts]);

  return (
    <>
      <button
        onClick={() => document.getElementById('settings_modal').showModal()}
        className={`text-primary-focus cursor-pointer hover:text-primary h-full pr-1 relative`}
        title="Settings"
        aria-label="Settings"
      >
        <svg aria-hidden="true" className="w-10 h-10" viewBox="0 0 24 24">
          <use href="#spiderweb" />
        </svg>
      </button>
      <dialog
        id="settings_modal"
        className="modal modal-bottom sm:modal-middle overflow-x-hidden"
      >
        <div className="modal-box">
          <form method="dialog">
            <button
              className="text-primary hover:text-primary-focus text-xl rotate-45 p-1.5 absolute top-2 right-2 inline-flex items-center cursor-pointer ease-linear duration-75"
              aria-label="Close settings"
            >
              +
            </button>
          </form>

          <h3 className="font-bold text-lg flex justify-center mb-4">
            Appearance
          </h3>
          <div className="flex flex-1 justify-center mb-6">
            <ThemeSwitcher />
            <FontSwitcher />
          </div>

          <div className="flex flex-1 justify-center mb-6">
            <TextSettings />
          </div>

          <hr className="border-base-300 my-6" />

          <h3 className="font-bold text-lg flex justify-center mb-4">
            Text to Speech Settings
          </h3>
          <div className="mb-2 px-4">
            <Voices />
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </>
  );
};

export default SettingsButton;
