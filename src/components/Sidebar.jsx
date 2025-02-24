import { useEffect, useState } from 'react';
import Voices from './Voices';
export default function Sidebar(props) {
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

      </div>
    </div>
  );
}
