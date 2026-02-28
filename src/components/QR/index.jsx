import QR from 'qrcode';
import { useState, useEffect, useRef } from 'react';

function rgba2hex(orig) {
  var a,
    isPercent,
    rgb = orig
      .replace(/\s/g, '')
      .match(/^rgba?\((\d+),(\d+),(\d+),?([^,\s)]+)?/i),
    alpha = ((rgb && rgb[4]) || '').trim(),
    hex = rgb
      ? (rgb[1] | (1 << 8)).toString(16).slice(1) +
        (rgb[2] | (1 << 8)).toString(16).slice(1) +
        (rgb[3] | (1 << 8)).toString(16).slice(1)
      : orig;

  if (alpha !== '') {
    a = alpha;
  } else {
    a = '01';
  }
  a = ((a * 255) | (1 << 8)).toString(16).slice(1);
  hex = hex + a;
  return hex;
}

function oklchToHex(oklchString) {
  const match = oklchString.match(/oklch\(([\d.]+)%?\s+([\d.]+)\s+([\d.]+)\)/);
  if (!match) throw new Error('Invalid OKLCH string format');

  let [, l, c, h] = match.map(Number);
  l = l > 1 ? l / 100 : l;

  const aLab = c * Math.cos((h * Math.PI) / 180);
  const bLab = c * Math.sin((h * Math.PI) / 180);

  let y = (l + 0.16) / 1.16;
  let x = aLab / 500 + y;
  let z = y - bLab / 200;
  x = 0.95047 * (x ** 3 > 0.008856 ? x ** 3 : (x - 16 / 116) / 7.787);
  y = 1.0 * (y ** 3 > 0.008856 ? y ** 3 : (y - 16 / 116) / 7.787);
  z = 1.08883 * (z ** 3 > 0.008856 ? z ** 3 : (z - 16 / 116) / 7.787);

  let r = x * 3.2406 + y * -1.5372 + z * -0.4986;
  let g = x * -0.9689 + y * 1.8758 + z * 0.0415;
  let b = x * 0.0557 + y * -0.204 + z * 1.057;

  r = r > 0.0031308 ? 1.055 * r ** (1 / 2.4) - 0.055 : 12.92 * r;
  g = g > 0.0031308 ? 1.055 * g ** (1 / 2.4) - 0.055 : 12.92 * g;
  b = b > 0.0031308 ? 1.055 * b ** (1 / 2.4) - 0.055 : 12.92 * b;

  r = Math.round(Math.min(Math.max(0, r), 1) * 255);
  g = Math.round(Math.min(Math.max(0, g), 1) * 255);
  b = Math.round(Math.min(Math.max(0, b), 1) * 255);

  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export default function QRElem(props) {
  const ref = useRef();
  const [theSVG, setSVG] = useState(false);

  const updateQR = () => {
    if (!ref.current) return;

    const computed = window.getComputedStyle(ref.current);
    const color = computed.getPropertyValue('--color-primary').trim();

    QR.toString(
      `https://spider.jlopes.eu/?q=${props.url}`,
      {
        type: 'svg',
        color: {
          dark: oklchToHex(color),
          light: '#00000000',
        },
      },
      function (err, string) {
        if (err) throw err;
        setSVG(string);
      },
    );
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    updateQR();

    const observer = new MutationObserver(updateQR);
    observer.observe(document.documentElement, { attributes: true });

    return () => observer.disconnect();
  }, [props.url]);

  return (
    <div
      className="max-w-xs mx-auto text-primary"
      ref={ref}
      dangerouslySetInnerHTML={{ __html: theSVG }}
      data-url={props.url}
    ></div>
  );
}
