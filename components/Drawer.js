import { useEffect, useState } from 'react';
import Voices from '@components/Drawer/Voices';
import ThemeSwitcher from '@components/ThemeSwitcher';
import FontSwitcher from '@components/FontSwitcher';
import QRElem from '@components/QR/index.js';

export default function Drawer(props) {
  const [isWindow, setWindow] = useState(false);
  const print = (ev) => {
    if (typeof window !== 'undefined') {
      var headstr = document.head.outerHTML + '<body>';
      var footstr = '</body>';
      var newstr = document.querySelector('article').outerHTML;
      var oldstr = document.body.innerHTML;
      document.body.innerHTML = headstr + newstr + footstr;
      window.print();
      document.body.innerHTML = oldstr;
      return false;
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if ('speechSynthesis' in window) {
        setWindow(true);
      }
    }
  }, []);
  return (
    <div className="drawer-side  print:hidden">
      <label htmlFor="drawer" className="drawer-overlay"></label>
      <div className="menu p-4 overflow-y-auto w-100 bg-base-100 text-base-content">
        <label htmlFor="drawer">
          <div className="text-primary hover:text-primary-focus text-xl rotate-45 p-1.5 absolute top-2 right-2 inline-flex items-center cursor-pointer ease-linear duration-75">
            &#10010;<span className="sr-only">Close menu</span>
          </div>
        </label>

        <div className="mt-6 prose prose-slate">
          <h3 className="heading-3">Options</h3>
          <div className="flex">
            <ThemeSwitcher />
            <FontSwitcher onChange={props.onFont} />
          </div>
          {props.post && (
            <div data-props={props.post}>
              <hr className="divider border-none" />
              <h3 className="heading-3">Scan for mobile reading</h3>
              <QRElem url={props.post.url} />
            </div>
          )}

          <hr className="divider border-none" />
          {/* <button
            className="text-primary-focus hover:text-primary"
            onClick={print}>
            <svg aria-hidden="true" className="w-6 h-6" viewBox="0 0 20 20">
              <use href="#print" />
            </svg>
          </button> */}
          {isWindow ? (
            <span>
              <h4 className="heading-4">Text-to-Speech</h4>
              <Voices />
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
