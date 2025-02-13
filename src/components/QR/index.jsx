import QR from 'qrcode';
import { useState, useEffect, useRef } from 'react';

function rgba2hex(orig) {
  var a, isPercent,
    rgb = orig.replace(/\s/g, '').match(/^rgba?\((\d+),(\d+),(\d+),?([^,\s)]+)?/i),
    alpha = (rgb && rgb[4] || "").trim(),
    hex = rgb ?
    (rgb[1] | 1 << 8).toString(16).slice(1) +
    (rgb[2] | 1 << 8).toString(16).slice(1) +
    (rgb[3] | 1 << 8).toString(16).slice(1) : orig;

  if (alpha !== "") {
    a = alpha;
  } else {
    a = '01';
  }
  // multiply before convert to HEX
  a = ((a * 255) | 1 << 8).toString(16).slice(1)
  hex = hex + a;

  return hex;
}


export default function QRElem(props) {
  const ref = useRef();
  const [theSVG, setSVG] = useState(false);

  const updateQR= () => {
    const computed = window.getComputedStyle(ref.current);
    QR.toString(
      `https://spider.jlopes.eu/?q=${props.url}`,
      {
        type: 'svg',
        color: {
          dark: `#${rgba2hex(computed.color)}`,
          light: '#0000',
        },
      },
      function (err, string) {
        if (err) throw err;
        setSVG(string);
      }
    );
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      updateQR();

      new MutationObserver(updateQR
      ).observe(document.documentElement, {attributes: true});


    }
  }, [props.url]);

  return (
    <div
      className="max-w-xs flex-none text-primary"
      ref={ref}
      dangerouslySetInnerHTML={{ __html: theSVG }}
      data-url={props.url}
    ></div>
  );
}
