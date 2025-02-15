import React, { useState, useEffect } from 'react';
import { defaultStore, useStore } from '../store/store';

import ThemeSwitcher from './ThemeSwitcher';
import FontSwitcher from './FontSwitcher';
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

  const copyToClipboard = () => {
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch((err) => console.error('Failed to copy: ', err));
  };

  return (
    <>
      <button
        onClick={() => document.getElementById('settings_modal').showModal()}
        className={`text-primary-focus cursor-pointer hover:text-primary h-full pr-1 relative`}
      >
        <svg aria-hidden="true" className="w-10 h-10" viewBox="0 0 24 24">
          <use href="#spiderweb" />
        </svg>
      </button>
      <dialog id="settings_modal" className="modal">
        <div className="modal-box">
          <form method="dialog">
            <button className="text-primary hover:text-primary-focus text-xl rotate-45 p-1.5 absolute top-2 right-2 inline-flex items-center cursor-pointer ease-linear duration-75">
              +
            </button>
          </form>
          <h3 className="font-bold text-lg flex justify-center mb-3">
            Theme and Font
          </h3>
          <div className="flex flex-1">
            <ThemeSwitcher />
            <FontSwitcher />
          </div>
          <div className="mt-4">
            <hr className="divider border-none my-4" />
            <span>
              <h4 className="heading-4 my-4">Text-to-Speech</h4>
              <Voices />
            </span>
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
