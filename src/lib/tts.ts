import { scrollBehavior } from './motion';

type TtsState = 'idle' | 'speaking' | 'paused';

type TrackInfo = {
  readonly title: string;
  readonly artist: string | null;
  readonly artwork: string | null;
};

const playbackStates = {
  idle: 'none',
  paused: 'paused',
  speaking: 'playing',
} as const;

const blockSelector = 'h1, h2, h3, h4, h5, h6, p, li, blockquote';
const highlightClass = 'tts';
const silenceSrc = '/silence.wav';
const gap = 50;
const startDelay = 100;

let state: TtsState = 'idle';
let index = 0;
let session = 0;
let shouldRead = false;
let restarting = false;
let handlersBound = false;
let keepAlive: HTMLAudioElement | null = null;
let subscribers: ((state: TtsState) => void)[] = [];

const synth = () => {
  return typeof window === 'undefined' ? null : window.speechSynthesis;
};

const getReadableBlocks = () => {
  const container =
    document.querySelector('article') ??
    document.querySelector('#article-content') ??
    document.body;

  return Array.from(container.querySelectorAll(blockSelector)).filter((el) => {
    if (el.querySelector(blockSelector)) {
      return false;
    }
    return (el.textContent?.trim().length ?? 0) > 0;
  });
};

const clearHighlights = () => {
  document.querySelectorAll(`.${highlightClass}`).forEach((el) => {
    el.classList.remove(highlightClass);
  });
};

const scrollIntoViewIfNeeded = (el: Element) => {
  const rect = el.getBoundingClientRect();
  const viewportHeight =
    window.innerHeight || document.documentElement.clientHeight;
  if (rect.top >= 0 && rect.bottom <= viewportHeight) {
    return;
  }

  el.scrollIntoView({ behavior: scrollBehavior(), block: 'center' });
};

const publish = (next: TtsState) => {
  state = next;
  subscribers.forEach((callback) => callback(state));
  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = playbackStates[next];
  }
};

const startKeepAlive = () => {
  if (!keepAlive) {
    keepAlive = new Audio(silenceSrc);
    keepAlive.loop = true;
    keepAlive.volume = 0;
  }
  keepAlive.play().catch(() => {});
};

const stopKeepAlive = () => {
  keepAlive?.pause();
};

const applySettings = (utterance: SpeechSynthesisUtterance) => {
  const voiceName = localStorage.getItem('voice');
  const voices = synth()?.getVoices() ?? [];
  const voice = voiceName ? voices.find((v) => v.name === voiceName) : null;
  if (voice) {
    utterance.voice = voice;
  }

  utterance.rate = parseFloat(localStorage.getItem('rate') || '1');
  utterance.pitch = parseFloat(localStorage.getItem('pitch') || '1');
  utterance.volume = parseFloat(localStorage.getItem('volume') || '1');
};

const finish = () => {
  shouldRead = false;
  clearHighlights();
  stopKeepAlive();
  publish('idle');
};

const speakNext = (mine: number) => {
  if (mine !== session || !shouldRead) {
    return;
  }

  const blocks = getReadableBlocks();
  if (index >= blocks.length) {
    finish();
    return;
  }

  const block = blocks[index];
  const utterance = new SpeechSynthesisUtterance(block.textContent ?? '');
  applySettings(utterance);

  clearHighlights();
  block.classList.add(highlightClass);
  scrollIntoViewIfNeeded(block);

  utterance.onend = () => {
    if (mine !== session) {
      return;
    }
    if (restarting) {
      restarting = false;
      setTimeout(() => speakNext(mine), gap);
      return;
    }
    index++;
    if (shouldRead) {
      setTimeout(() => speakNext(mine), gap);
    }
  };

  utterance.onerror = (event) => {
    if (mine !== session) {
      return;
    }
    if (event.error === 'canceled') {
      if (!restarting) {
        clearHighlights();
        return;
      }
      restarting = false;
      setTimeout(() => speakNext(mine), gap);
      return;
    }

    console.error('TTS Error:', event);
    index++;
    if (shouldRead) {
      setTimeout(() => speakNext(mine), gap);
    }
  };

  synth()?.speak(utterance);
};

function start(fromIndex = 0): void {
  if (!synth()) {
    return;
  }

  const blocks = getReadableBlocks();
  if (blocks.length === 0) {
    return;
  }

  session++;
  const mine = session;

  shouldRead = false;
  restarting = false;
  synth()?.cancel();
  clearHighlights();

  index = Math.min(Math.max(fromIndex, 0), blocks.length - 1);
  shouldRead = true;
  bindMediaHandlers();
  startKeepAlive();
  publish('speaking');

  setTimeout(() => speakNext(mine), startDelay);
}

function pause(): void {
  if (state !== 'speaking') {
    return;
  }
  synth()?.pause();
  stopKeepAlive();
  publish('paused');
}

function resume(): void {
  if (state !== 'paused') {
    return;
  }
  synth()?.resume();
  startKeepAlive();
  publish('speaking');
}

function stop(): void {
  session++;
  shouldRead = false;
  restarting = false;
  synth()?.cancel();
  finish();
}

function skip(delta: number): void {
  if (state === 'idle') {
    return;
  }
  start(index + delta);
}

function setTrack(track: TrackInfo): void {
  if (!('mediaSession' in navigator)) {
    return;
  }

  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title,
    artist: track.artist ?? '',
    album: 'Spider',
    artwork: track.artwork ? [{ src: track.artwork }] : [],
  });
}

function bindMediaHandlers(): void {
  if (handlersBound || !('mediaSession' in navigator)) {
    return;
  }
  handlersBound = true;

  navigator.mediaSession.setActionHandler('play', resume);
  navigator.mediaSession.setActionHandler('pause', pause);
  navigator.mediaSession.setActionHandler('stop', stop);
  navigator.mediaSession.setActionHandler('nexttrack', () => skip(1));
  navigator.mediaSession.setActionHandler('previoustrack', () => skip(-1));
}

function subscribe(callback: (state: TtsState) => void): () => void {
  subscribers.push(callback);
  return () => {
    subscribers = subscribers.filter((cb) => cb !== callback);
  };
}

const handleSettingsChange = () => {
  if (!shouldRead || !synth()?.speaking) {
    return;
  }
  restarting = true;
  synth()?.cancel();
};

if (typeof window !== 'undefined') {
  window.addEventListener('tts-settings-change', handleSettingsChange);
}

export { start, pause, resume, stop, setTrack, subscribe };
export type { TtsState };
