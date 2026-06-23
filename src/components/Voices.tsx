import { useState, useEffect } from 'react';

type QualityTier = 'premium' | 'enhanced' | 'standard';

const getQuality = (v: SpeechSynthesisVoice): QualityTier => {
  const n = v.name.toLowerCase();
  if (n.includes('premium')) return 'premium';
  if (n.includes('enhanced') || n.includes('neural')) return 'enhanced';
  return 'standard';
};

const qualityOrder: Record<QualityTier, number> = {
  premium: 0,
  enhanced: 1,
  standard: 2,
};

const buildVoiceGroups = (voices: SpeechSynthesisVoice[]) => {
  const groups = new Map<string, SpeechSynthesisVoice[]>();
  for (const v of voices) {
    const existing = groups.get(v.lang) ?? [];
    existing.push(v);
    groups.set(v.lang, existing);
  }
  for (const [lang, group] of groups) {
    groups.set(
      lang,
      group.sort((a, b) => qualityOrder[getQuality(a)] - qualityOrder[getQuality(b)]),
    );
  }
  return new Map(
    [...groups.entries()].sort(([a], [b]) => {
      const aEn = a.startsWith('en');
      const bEn = b.startsWith('en');
      if (aEn && !bEn) return -1;
      if (!aEn && bEn) return 1;
      return a.localeCompare(b);
    }),
  );
};

const findBestVoiceName = (
  voices: SpeechSynthesisVoice[],
  savedName: string | null,
): string => {
  if (savedName && voices.some((v) => v.name === savedName)) return savedName;

  const def = voices.find((v) => v.default);
  if (def) return def.name;

  if (navigator.language) {
    const userLang = navigator.language.split('-')[0];
    const local = voices
      .filter((v) => v.lang.startsWith(userLang))
      .sort((a, b) => qualityOrder[getQuality(a)] - qualityOrder[getQuality(b)]);
    if (local.length > 0) return local[0].name;
  }

  return voices[0]?.name ?? '';
};

export default function Voices() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voice, setVoice] = useState('');
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    const loadVoices = () => {
      const available = window.speechSynthesis.getVoices();
      if (available.length === 0) return;
      setVoices(available);
      const savedName = localStorage.getItem('voice');
      const name = findBestVoiceName(available, savedName);
      setVoice(name);
    };

    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);

    const savedPitch = localStorage.getItem('pitch');
    if (savedPitch) setPitch(parseFloat(savedPitch));
    const savedRate = localStorage.getItem('rate');
    if (savedRate) setRate(parseFloat(savedRate));
    const savedVolume = localStorage.getItem('volume');
    if (savedVolume) setVolume(parseFloat(savedVolume));

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
    };
  }, []);

  const updateVoice = (ev: React.ChangeEvent<HTMLSelectElement>) => {
    const name = ev.target.value;
    localStorage.setItem('voice', name);
    setVoice(name);

    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      setTimeout(() => window.speechSynthesis.resume(), 200);
    }
  };

  const notifySettingsChange = () => window.dispatchEvent(new CustomEvent('tts-settings-change'));

  const updateRate = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const val = ev.target.value;
    localStorage.setItem('rate', val);
    setRate(parseFloat(val));
    notifySettingsChange();
  };

  const updatePitch = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const val = ev.target.value;
    localStorage.setItem('pitch', val);
    setPitch(parseFloat(val));
    notifySettingsChange();
  };

  const updateVolume = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const val = ev.target.value;
    localStorage.setItem('volume', val);
    setVolume(parseFloat(val));
    notifySettingsChange();
  };

  const voiceGroups = buildVoiceGroups(voices);

  const voiceLabel = (v: SpeechSynthesisVoice) => {
    const tier = getQuality(v);
    const badge = tier === 'premium' ? ' ★★' : tier === 'enhanced' ? ' ★' : '';
    return `${v.name}${badge}`;
  };

  const optgroups: React.ReactNode[] = [];
  for (const [lang, group] of voiceGroups) {
    const options = group.map((v) => {
      return (
        <option key={v.name} value={v.name}>
          {voiceLabel(v)}
        </option>
      );
    });
    optgroups.push(
      <optgroup key={lang} label={lang}>
        {options}
      </optgroup>,
    );
  }

  return (
    <div className="flex flex-col gap-6 mb-4">
      <div className="w-full">
        <label htmlFor="voice-select" className="sr-only">
          Select voice
        </label>
        <select
          id="voice-select"
          className="select select-secondary focus:outline-0 w-full text-primary-focus hover:text-primary rounded-xl cursor-pointer"
          onChange={updateVoice}
          value={voice}
        >
          <option disabled value="">
            {voices.length === 0 ? 'Loading voices…' : 'Select your favourite voice'}
          </option>
          {optgroups}
        </select>
      </div>

      <div className="flex flex-row w-full gap-4 md:gap-6">
        <div className="flex-1 min-w-0">
          <label htmlFor="rate-slider" className="font-medium block mb-2">
            Rate: {rate.toFixed(1)}
          </label>
          <input
            id="rate-slider"
            type="range"
            min="0.5"
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
            <span>0.5×</span>
            <span>1×</span>
            <span>1.5×</span>
            <span>2×</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <label htmlFor="pitch-slider" className="font-medium block mb-2">
            Pitch: {pitch.toFixed(1)}
          </label>
          <input
            id="pitch-slider"
            type="range"
            min="0"
            max="2"
            value={pitch}
            className="range range-secondary hover:range-primary range-xs w-full"
            step="0.1"
            onChange={updatePitch}
          />
          <div
            className="w-full flex justify-between text-xs px-1 text-secondary"
            aria-hidden="true"
          >
            <span>0</span>
            <span>1</span>
            <span>2</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <label htmlFor="volume-slider" className="font-medium block mb-2">
            Volume: {Math.round(volume * 100)}%
          </label>
          <input
            id="volume-slider"
            type="range"
            min="0"
            max="1"
            value={volume}
            className="range range-secondary hover:range-primary range-xs w-full"
            step="0.1"
            onChange={updateVolume}
          />
          <div
            className="w-full flex justify-between text-xs px-1 text-secondary"
            aria-hidden="true"
          >
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
