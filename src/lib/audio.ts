// Pure audio helpers for the microphone flow.

/** Linear-interpolation resample of mono samples to `targetRate`. */
export function resample(input: Float32Array, fromRate: number, targetRate = 16000): Float32Array {
  if (fromRate === targetRate || input.length === 0) return input;
  const ratio = fromRate / targetRate;
  const outLen = Math.floor(input.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const frac = pos - i0;
    out[i] = input[i0] * (1 - frac) + input[i1] * frac;
  }
  return out;
}

export function rms(buf: Float32Array): number {
  if (buf.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  return Math.sqrt(sum / buf.length);
}

export interface EndpointOptions {
  silenceMs: number;
  maxMs: number;
  /** Stop when nothing has been said at all after this long. */
  noSpeechMs: number;
  threshold: number;
}

export const DEFAULT_ENDPOINT: EndpointOptions = { silenceMs: 1500, maxMs: 8000, noSpeechMs: 5000, threshold: 0.012 };

/** Tracks speech/silence per audio chunk; `update` returns true when recording should stop. */
export class Endpointer {
  private elapsed = 0;
  private silent = 0;
  private heard = false;
  private opts: EndpointOptions;
  constructor(opts: EndpointOptions = DEFAULT_ENDPOINT) {
    this.opts = opts;
  }

  update(level: number, chunkMs: number): boolean {
    this.elapsed += chunkMs;
    if (level >= this.opts.threshold) {
      this.heard = true;
      this.silent = 0;
    } else {
      this.silent += chunkMs;
    }
    if (this.elapsed >= this.opts.maxMs) return true;
    if (this.heard && this.silent >= this.opts.silenceMs) return true;
    if (!this.heard && this.elapsed >= this.opts.noSpeechMs) return true;
    return false;
  }
}
