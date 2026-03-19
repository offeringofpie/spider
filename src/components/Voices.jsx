import { useState, useEffect } from 'react';

const sortByLang = (a, b) => {
  const aname = a.lang.toUpperCase(),
    bname = b.lang.toUpperCase();
  if (aname < bname) return -1;
  else if (aname == bname) return 0;
  else return +1;
};

export default function Voices() {
  const [voices, setVoices] = useState([]);
  const [voice, setVoice] = useState('');
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const loadVoices = () => {
      const availableVoices = window.speechSynthesis
        .getVoices()
        .sort(sortByLang);

      if (availableVoices.length > 0) {
        setVoices(availableVoices);

        const savedVoiceName = localStorage.getItem('voice');
        let selectedIndex = -1;

        if (savedVoiceName) {
          selectedIndex = availableVoices.findIndex(
            (v) => v.name === savedVoiceName,
          );
        }

        if (selectedIndex === -1) {
          selectedIndex = availableVoices.findIndex((v) => v.default);
        }

        if (selectedIndex === -1 && navigator.language) {
          const userLang = navigator.language.split('-')[0];
          selectedIndex = availableVoices.findIndex((v) =>
            v.lang.startsWith(userLang),
          );
        }

        setVoice(selectedIndex !== -1 ? selectedIndex : 0);
      }
    };

    loadVoices();

    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    if (localStorage.getItem('pitch'))
      setPitch(parseFloat(localStorage.getItem('pitch')));
    if (localStorage.getItem('rate'))
      setRate(parseFloat(localStorage.getItem('rate')));

    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  const updatePitch = (ev) => {
    const val = ev.target.value;
    localStorage.setItem('pitch', val);
    setPitch(parseFloat(val));
  };

  const updateRate = (ev) => {
    const val = ev.target.value;
    localStorage.setItem('rate', val);
    setRate(parseFloat(val));
  };

  const updateVoice = (ev) => {
    const selectedIndex = ev.target.value;
    localStorage.setItem('voice', voices[selectedIndex].name);
    setVoice(selectedIndex);

    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      setTimeout(() => {
        window.speechSynthesis.resume();
      }, 200);
    }
  };

  return (
    <div className="flex flex-col gap-6 mb-4">
      <div className="w-full">
        <label htmlFor="voice-select" className="sr-only">
          Select voice language
        </label>
        <select
          id="voice-select"
          className="select select-secondary focus:outline-0 w-full text-primary-focus hover:text-primary rounded-xl cursor-pointer"
          onChange={updateVoice}
          value={voice}
        >
          <option disabled value="">
            {voices.length === 0
              ? 'Loading voices...'
              : 'Select your favourite voice'}
          </option>
          {voices.map((v, i) => (
            <option data-lang={v.lang} data-name={v.name} key={i} value={i}>
              {v.name} ({v.lang})
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-row w-full gap-4 md:gap-6">
        <div className="flex-1 min-w-0">
          <label htmlFor="pitch-slider" className="font-medium block mb-2">
            Pitch: {pitch}
          </label>
          <input
            id="pitch-slider"
            type="range"
            min="0"
            max="2"
            value={pitch}
            className="range range-secondary hover:range-primary range-xs w-full"
            step="0.5"
            onChange={updatePitch}
          />
          <div
            className="w-full flex justify-between text-xs px-1 text-secondary"
            aria-hidden="true"
          >
            <span>|</span>
            <span>|</span>
            <span>|</span>
            <span>|</span>
            <span>|</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <label htmlFor="rate-slider" className="font-medium block mb-2">
            Rate: {rate}
          </label>
          <input
            id="rate-slider"
            type="range"
            min="0"
            max="2"
            value={rate}
            className="range range-secondary hover:range-primary range-xs w-full"
            step="0.1"
            onChange={updateRate}
          />
          <div
            className="w-full flex justify-between text-xs px-1 text-secondary"
            aria-hidden="true"
          >
            <span>|</span>
            <span>|</span>
            <span>|</span>
            <span>|</span>
            <span>|</span>
            <span>|</span>
            <span>|</span>
            <span>|</span>
            <span>|</span>
            <span>|</span>
            <span>|</span>
            <span>|</span>
            <span>|</span>
            <span>|</span>
            <span>|</span>
            <span>|</span>
            <span>|</span>
            <span>|</span>
            <span>|</span>
            <span>|</span>
            <span>|</span>
          </div>
        </div>
      </div>
    </div>
  );
}
