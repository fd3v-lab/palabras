// Client for the Whisper worker plus the microphone recorder.
import type { WhisperRequest, WhisperResponse } from '../workers/whisper.worker';
import { DEFAULT_ENDPOINT, Endpointer, resample, rms } from './audio';

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<
  number,
  { resolve: (v: string) => void; reject: (e: Error) => void; onProgress?: (pct: number) => void }
>();

function getWorker(): Worker {
  if (worker) return worker;
  const w = new Worker(new URL('../workers/whisper.worker.ts', import.meta.url), { type: 'module' });
  w.onmessage = (e: MessageEvent<WhisperResponse>) => {
    const m = e.data;
    const p = pending.get(m.id);
    if (!p) return;
    if (m.type === 'progress') {
      p.onProgress?.(m.progress);
      return;
    }
    pending.delete(m.id);
    if (m.type === 'result') p.resolve(m.text);
    else if (m.type === 'ready') p.resolve(m.device);
    else p.reject(new Error(m.message));
  };
  w.onerror = (ev) => {
    const err = new Error(ev.message || 'Speech recognition worker failed');
    for (const p of pending.values()) p.reject(err);
    pending.clear();
    worker?.terminate();
    worker = null;
  };
  worker = w;
  return w;
}

type WhisperJob = { type: 'load' } | { type: 'transcribe'; audio: Float32Array };

function send(req: WhisperJob, onProgress?: (pct: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject, onProgress });
    try {
      getWorker().postMessage({ ...req, id } as WhisperRequest);
    } catch (e) {
      pending.delete(id);
      reject(e instanceof Error ? e : new Error(String(e)));
    }
  });
}

/** Loads the model (downloads on first use). Progress 0..100. Resolves with the device used. */
export function loadWhisper(onProgress?: (pct: number) => void): Promise<string> {
  return send({ type: 'load' }, onProgress);
}

export function transcribeAudio(audio: Float32Array, onProgress?: (pct: number) => void): Promise<string> {
  return send({ type: 'transcribe', audio }, onProgress);
}

// ---- recording ----

export type MicError = 'unsupported' | 'denied' | 'no-device' | 'failed';

export class MicException extends Error {
  kind: MicError;
  constructor(kind: MicError, message: string) {
    super(message);
    this.kind = kind;
  }
}

export function micSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

export function describeMicError(e: unknown): string {
  if (e instanceof MicException) return e.message;
  return e instanceof Error ? e.message : 'Could not use the microphone.';
}

export interface Recording {
  /** Stops recording and resolves with 16 kHz mono samples. */
  stop: () => Promise<Float32Array>;
  /** Resolves when the recorder decided to stop by itself (silence / max length). */
  ended: Promise<void>;
}

export async function startRecording(): Promise<Recording> {
  if (!micSupported()) {
    throw new MicException(
      'unsupported',
      'Microphone access is not available here (it needs HTTPS or localhost and a browser with getUserMedia).',
    );
  }
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
  } catch (e) {
    const name = (e as DOMException)?.name;
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      throw new MicException('denied', 'Microphone permission was denied. Allow it in the browser address bar and try again.');
    }
    if (name === 'NotFoundError' || name === 'OverconstrainedError') {
      throw new MicException('no-device', 'No microphone found.');
    }
    throw new MicException('failed', 'Could not start the microphone.');
  }

  const AC: typeof AudioContext =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ac = new AC();
  const source = ac.createMediaStreamSource(stream);
  const proc = ac.createScriptProcessor(4096, 1, 1);
  const chunks: Float32Array[] = [];
  const endpoint = new Endpointer(DEFAULT_ENDPOINT);
  let resolveEnded: () => void = () => {};
  const ended = new Promise<void>((r) => (resolveEnded = r));
  let done = false;

  proc.onaudioprocess = (ev) => {
    if (done) return;
    const data = new Float32Array(ev.inputBuffer.getChannelData(0));
    chunks.push(data);
    if (endpoint.update(rms(data), (data.length / ac.sampleRate) * 1000)) resolveEnded();
  };
  source.connect(proc);
  proc.connect(ac.destination);

  const stop = async () => {
    if (!done) {
      done = true;
      proc.disconnect();
      source.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      await ac.close().catch(() => {});
    }
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const all = new Float32Array(total);
    let off = 0;
    for (const c of chunks) {
      all.set(c, off);
      off += c.length;
    }
    return resample(all, ac.sampleRate, 16000);
  };
  return { stop, ended };
}
