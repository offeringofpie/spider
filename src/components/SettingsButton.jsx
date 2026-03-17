import { useState, useEffect } from 'react';
import { defaultStore, useStore } from '../store/store';

import ThemeSwitcher from './ThemeSwitcher';
import FontSwitcher from './FontSwitcher';
import TextSettings from './TextSettings';
import Voices from './Voices';

const SettingsButton = ({ variant = 'header', tabIndex = 0 }) => {
  const [state, setState] = useStore(defaultStore);
  const [post, setPost] = useState(false);

  useEffect(() => {
    if (state.posts) {
      setPost(JSON.parse(state.posts));
    }
  }, [state.posts]);

  const openModal = () => document.getElementById('settings_modal').showModal();

  return (
    <>
      {variant === 'fab' ? (
        <button
          onClick={openModal}
          tabIndex={tabIndex}
          aria-label="Settings"
          className="btn bg-base-100 text-base-content hover:bg-base-200 border-none rounded-full flex items-center gap-2 pl-5 pr-2 h-14 shadow-sm"
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
          onClick={openModal}
          className={`text-primary-focus cursor-pointer hover:text-primary h-full pr-1 relative`}
          title="Settings"
          aria-label="Settings"
        >
          <svg aria-hidden="true" className="w-10 h-10" viewBox="0 0 24 24">
            <use href="#spiderweb" />
          </svg>
        </button>
      )}

      <dialog
        id="settings_modal"
        className="modal modal-bottom sm:modal-middle overflow-x-hidden backdrop-blur-sm"
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
