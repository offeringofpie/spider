import { useState, useEffect } from 'react';

const sortByLang = (a, b) => {
  const aname = a.lang.toUpperCase(),
    bname = b.lang.toUpperCase();
  if (aname < bname) return -1;
  else if (aname == bname) return 0;
  else return +1;
};

export default function Voices() {
  const [voices, setVoices] = useState(
    window.speechSynthesis.getVoices().sort(sortByLang)
  );
  const [post, setPost] = useState(false);

  const [voice, setVoice] = useState(0);
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setVoices(window.speechSynthesis.getVoices().sort(sortByLang));
      if (localStorage.getItem('pitch'))
        setPitch(localStorage.getItem('pitch'));

      if (localStorage.getItem('rate')) setRate(localStorage.getItem('rate'));
      if (localStorage.getItem('voice')) {
        setVoice(
          voices.findIndex((voice) => {
            return voice.name == localStorage.getItem('voice');
          })
        );
      }
    }
  }, []);

  const updatePitch = (ev) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('pitch', ev.target.value);
      setPitch(ev.target.value);
    }
  };
  const updateRate = (ev) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('rate', ev.target.value);
      setRate(ev.target.value);
    }
  };

  const updateVoice = (ev) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('voice', voices[ev.target.value].name);
      setVoice(ev.target.value);

      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        setTimeout(() => {
          window.speechSynthesis.resume();
        }, 200);
      }
    }
  };

  return (
    <div>
      <select
        className="select select-secondary focus:outline-0 w-full max-w-xs text-primary-focus hover:text-primary rounded-xl"
        onChange={updateVoice}
        value={voice}
      >
        <option disabled value="">
          Select your favourite voice
        </option>
        {voices.map((voice, i) => {
          return (
            <option
              data-lang={voice.lang}
              data-name={voice.name}
              key={i}
              value={i}
            >
              {voice.name} ({voice.lang})
            </option>
          );
        })}
      </select>
      <label className="my-4 block">
        <h4>Pitch: {pitch}</h4>
        <input
          type="range"
          min="0"
          max="2"
          defaultValue={pitch}
          className="range range-secondary hover:range-primary range-xs w-full"
          step="0.5"
          onChange={updatePitch}
        />
        <div className="w-full flex justify-between text-xs px-1 text-secondary">
          <span>|</span>
          <span>|</span>
          <span>|</span>
          <span>|</span>
          <span>|</span>
        </div>
      </label>
      <label className="my-4 block">
        <h4>Rate: {rate}</h4>
        <input
          type="range"
          min="0"
          max="2"
          defaultValue={rate}
          className="range range-secondary hover:range-primary range-xs w-full"
          step="0.1"
          onChange={updateRate}
        />
        <div className="w-full flex justify-between text-xs px-1 text-secondary">
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
      </label>
    </div>
  );
}
