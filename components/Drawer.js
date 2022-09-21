import { useEffect, useState } from "react";
import Voices from "@components/Drawer/Voices";

export default function Drawer(props) {
  const [isWindow, setWindow] = useState(false);
  const print = (ev) => {
    if (typeof window !== "undefined") {
      var headstr = document.head.outerHTML + "<body>";
      var footstr = "</body>";
      var newstr = document.querySelector("article").outerHTML;
      var oldstr = document.body.innerHTML;
      document.body.innerHTML = headstr + newstr + footstr;
      window.print();
      document.body.innerHTML = oldstr;
      return false;
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      if ("speechSynthesis" in window) {
        setWindow(true);
      }
    }
  }, []);
  return (
    <div className="drawer-side  print:hidden">
      <label htmlFor="drawer" className="drawer-overlay"></label>
      <div className="menu p-4 overflow-y-auto w-80 bg-base-100 text-base-content">
        <label htmlFor="drawer">
          <div className="text-primary hover:text-primary-focus text-xl rotate-45 p-1.5 absolute top-2 right-2 inline-flex items-center cursor-pointer ease-linear duration-75">
            &#10010;<span className="sr-only">Close menu</span>
          </div>
        </label>

        <div className="mt-6">
          {/* <button
            className="text-primary-focus hover:text-primary"
            onClick={print}>
            <svg aria-hidden="true" className="w-6 h-6" viewBox="0 0 20 20">
              <use href="#print" />
            </svg>
          </button> */}
          {isWindow ? (
            <span>
              <button
                className="text-primary-focus hover:text-primary mb-3"
                onClick={props.onSpeak}>
                <svg aria-hidden="true" className="w-6 h-6" viewBox="0 0 20 20">
                  <use href="#mic" />
                </svg>
              </button>
              <Voices />
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
