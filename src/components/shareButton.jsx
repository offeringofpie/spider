import React, { useState, useEffect } from 'react';
import { defaultStore, useStore } from '../store/store';
import QRElem from './QR/index';

const ShareButton = () => {
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
        onClick={() => document.getElementById('my_modal_2').showModal()}
        className={`text-primary-focus cursor-pointer hover:text-primary h-full pr-1 relative`}
      >
        <svg aria-hidden="true" className="w-6 h-6" viewBox="0 0 20 20">
          <use href="#share" />
        </svg>
      </button>
      <dialog id="my_modal_2" className="modal">
        <div className="modal-box">
          <form method="dialog">
            <button className="text-primary hover:text-primary-focus text-xl rotate-45 p-1.5 absolute top-2 right-2 inline-flex items-center cursor-pointer ease-linear duration-75">
              +
            </button>
          </form>
          <h3 className="font-bold text-lg flex justify-center">
            <button
              className={`btn btn-dash btn-lg btn-primary cursor-pointer h-full p-2 relative flex items-center justify-center`}
              onClick={copyToClipboard}
            >
                      <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 20 20">
          <use href="#share" />
        </svg>
        Click to copy the URL
            </button>
          </h3>
          {state.loaded && (
            <div data-props={post}>
              <hr className="divider border-none" />
              <h3 className="heading-3">Scan for mobile reading</h3>
              <QRElem url={post.url} />
            </div>
          )}
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </>
  );
};

export default ShareButton;
