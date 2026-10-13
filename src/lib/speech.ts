// Text-to-speech: Piper neural voices (in a worker, cached in OPFS) with a
// speechSynthesis fallback. All failures degrade silently to the fallback.
import { getSettings, type SpeechEngine, type VoicePref } from './db';
import type { PiperRequest, PiperResponse } from '../workers/piper.worker';

export interface PiperVoiceInfo {
  id: string;
  label: string;
}

export const PIPER_VOICES: PiperVoiceInfo[] = [
  { id: 'es_ES-davefx-medium', label: 'Spain - Davefx (63 MB)' },
  { id: 'es_MX-ald-medium', label: 'Mexico - Ald (63 MB)' },
  { id: 'es_MX-claude-high', label: 'Mexico - Claude (63 MB)' },
];

// ---- browser speechSynthesis fallback ----

function getSynth(): SpeechSynthesis | null {
  if (typeof window === 'undefined') return null;
  if (!('speechSynthesis' in window)) return null;
  return window.speechSynthesis;
}

export function isSpeechAvailable(): boolean {
  return getSynth() !== null;
}

function pickVoice(voices: SpeechSynthesisVoice[], pref: VoicePref): SpeechSynthesisVoice | null {
  const esVoices = voices.filter((v) => v.lang?.toLowerCase().startsWith('es'));
  if (esVoices.length === 0) return null;
  if (pref === 'auto') return esVoices[0];
  const exact = esVoices.find((v) => v.lang.toLowerCase() === pref.toLowerCase());
  return exact ?? esVoices[0];
}

export function speakBrowser(text: string, voicePref: VoicePref = 'auto'): void {
  const synth = getSynth();
  if (!synth) return;
  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voicePref === 'auto' ? 'es-ES' : voicePref;
    const voice = pickVoice(synth.getVoices(), voicePref);
    if (voice) utterance.voice = voice;
    synth.cancel();
    synth.speak(utterance);
  } catch {
    // degrade silently
  }
}

// ---- Piper worker client ----

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<
  number,
  {
    resolve: (v: ArrayBuffer | null) => void;
    reject: (e: Error) => void;
    onProgress?: (loaded: number, total: number, url: string) => void;
  }
>();

function getWorker(): Worker {
  if (worker) return worker;
  const w = new Worker(new URL('../workers/piper.worker.ts', import.meta.url), { type: 'module' });
  w.onmessage = (e: MessageEvent<PiperResponse>) => {
    const msg = e.data;
    const p = pending.get(msg.id);
    if (!p) return;
    if (msg.type === 'progress') {
      p.onProgress?.(msg.loaded, msg.total, msg.url);
      return;
    }
    pending.delete(msg.id);
    if (msg.type === 'audio') p.resolve(msg.buffer);
    else if (msg.type === 'done') p.resolve(null);
    else p.reject(new Error(msg.message));
  };
  w.onerror = (ev) => {
    const err = new Error(ev.message || 'Piper worker failed');
    for (const p of pending.values()) p.reject(err);
    pending.clear();
    worker?.terminate();
    worker = null;
  };
  worker = w;
  return w;
}

function request(
  req: { type: 'speak'; text: string; voiceId: string } | { type: 'download'; voiceId: string },
  onProgress?: (loaded: number, total: number, url: string) => void,
): Promise<ArrayBuffer | null> {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject, onProgress });
    try {
      getWorker().postMessage({ ...req, id, base: location.origin + import.meta.env.BASE_URL.replace(/\/$/, '') } as PiperRequest);
    } catch (e) {
      pending.delete(id);
      reject(e instanceof Error ? e : new Error(String(e)));
    }
  });
}

/** Downloads (and caches in OPFS) a voice model. Progress is 0..1 for the model file. */
export async function downloadVoice(voiceId: string, onProgress?: (fraction: number) => void): Promise<void> {
  await request({ type: 'download', voiceId }, (loaded, total, url) => {
    if (url.endsWith('.onnx') && total > 0) onProgress?.(loaded / total);
  });
  readyVoices.add(voiceId);
  onProgress?.(1);
}

const readyVoices = new Set<string>();

export async function storedVoices(): Promise<string[]> {
  try {
    const tts = await import('@mintplex-labs/piper-tts-web');
    return await tts.stored();
  } catch {
    return [];
  }
}

// ---- audio cache (LRU) + playback ----

const CACHE_MAX = 100;
const audioCache = new Map<string, string>(); // key -> blob URL

function cacheGet(key: string): string | undefined {
  const url = audioCache.get(key);
  if (url) {
    audioCache.delete(key);
    audioCache.set(key, url);
  }
  return url;
}

function cacheSet(key: string, url: string): void {
  audioCache.set(key, url);
  while (audioCache.size > CACHE_MAX) {
    const oldest = audioCache.keys().next().value as string;
    URL.revokeObjectURL(audioCache.get(oldest) as string);
    audioCache.delete(oldest);
  }
}

export interface SpeakOptions {
  engine?: SpeechEngine;
  voiceId?: string;
  voicePref?: VoicePref;
  /** True when triggered by an explicit user click (bypasses dedupe once the previous playback ended). */
  explicit?: boolean;
}

export interface PlaybackHandle {
  stop(): void;
}

export interface PlaybackDeps {
  now(): number;
  resolveSettings(): Promise<{ engine?: SpeechEngine; voiceId?: string; voicePref?: VoicePref }>;
  neuralAvailable(): boolean;
  synth(text: string, voiceId: string): Promise<string>;
  /** Starts playing; resolves once audio has started. `onEnded` fires when finished. */
  play(url: string, onEnded: () => void): Promise<PlaybackHandle>;
  speakBrowser(text: string, voicePref?: VoicePref): void;
  cancelBrowser(): void;
}

export const DEDUPE_MS = 800;

/** Single playback manager: one current playback, latest request wins, never neural + fallback together. */
export function createPlaybackManager(deps: PlaybackDeps) {
  let token = 0;
  let current: PlaybackHandle | null = null;
  let active = false; // a request is in flight or audio is playing
  let lastText = '';
  let lastAt = -Infinity;

  function stopCurrent(): void {
    if (current) {
      try {
        current.stop();
      } catch {
        // ignore
      }
      current = null;
    }
    deps.cancelBrowser();
    active = false;
  }

  async function speak(text: string, opts: SpeakOptions = {}): Promise<void> {
    if (!text) return;
    const now = deps.now();
    if (text === lastText && now - lastAt < DEDUPE_MS && (!opts.explicit || active)) return;
    lastText = text;
    lastAt = now;
    const my = ++token;
    stopCurrent();
    active = true;

    let { engine, voiceId, voicePref } = opts;
    if (!engine || !voiceId || !voicePref) {
      try {
        const s = await deps.resolveSettings();
        engine ??= s.engine;
        voiceId ??= s.voiceId;
        voicePref ??= s.voicePref;
      } catch {
        // use defaults
      }
      if (my !== token) return;
    }
    if (engine === 'browser' || !deps.neuralAvailable()) {
      deps.speakBrowser(text, voicePref);
      return;
    }
    let url: string;
    try {
      url = await deps.synth(text, voiceId ?? PIPER_VOICES[0].id);
    } catch (err) {
      if (my !== token) return;
      console.warn('Neural speech failed, using browser voice:', err);
      deps.speakBrowser(text, voicePref);
      return;
    }
    if (my !== token) return; // stale
    try {
      const handle = await deps.play(url, () => {
        if (my === token) {
          active = false;
          current = null;
        }
      });
      if (my !== token) {
        handle.stop();
        return;
      }
      current = handle;
    } catch (err) {
      // Audio never started (e.g. autoplay blocked): fallback is safe.
      if (my !== token) return;
      console.warn('Audio playback failed, using browser voice:', err);
      deps.speakBrowser(text, voicePref);
    }
  }

  return {
    speak,
    stop: () => {
      token++;
      stopCurrent();
    },
  };
}

async function synthNeural(text: string, voiceId: string): Promise<string> {
  const key = `${voiceId}|${text}`;
  const cached = cacheGet(key);
  if (cached) return cached;
  const buffer = await request({ type: 'speak', text, voiceId });
  if (!buffer) throw new Error('No audio');
  const url = URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
  cacheSet(key, url);
  readyVoices.add(voiceId);
  return url;
}

const manager = createPlaybackManager({
  now: () => Date.now(),
  async resolveSettings() {
    const s = await getSettings();
    return { engine: s.speechEngine, voiceId: s.piperVoice, voicePref: s.voicePref };
  },
  neuralAvailable: () => typeof Worker !== 'undefined',
  synth: synthNeural,
  async play(url, onEnded) {
    const audio = new Audio(url);
    audio.addEventListener('ended', onEnded);
    await audio.play();
    return { stop: () => audio.pause() };
  },
  speakBrowser,
  cancelBrowser: () => getSynth()?.cancel(),
});

/** Speaks Spanish text. Never throws. */
export function speak(text: string, opts: SpeakOptions = {}): Promise<void> {
  return manager.speak(text, opts);
}

export function stopSpeaking(): void {
  manager.stop();
}
