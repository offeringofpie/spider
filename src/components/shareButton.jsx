import React, { useState } from 'react';

const ShareButton = () => {
  const [copied, setCopied] = useState(false);

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
    <button
      onClick={copyToClipboard}
      className={`text-primary-focus cursor-pointer hover:text-primary h-full bg-base-300 border-primary border-2 border-x-0 pr-1 relative focus:tooltip`}
      data-tip="copied!"
    >
      <svg aria-hidden="true" className="w-6 h-6" viewBox="0 0 20 20">
        <use href="#share" />
      </svg>
    </button>
  );
};

export default ShareButton;
