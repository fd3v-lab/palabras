/// <reference lib="webworker" />
// Whisper speech-to-text via transformers.js, off the main thread.
// The model is downloaded lazily on first use and cached by the library.
import { pipeline, env } from '@huggingface/transformers';

export type WhisperRequest =
  | { id: number; type: 'load' }
  | { id: number; type: 'transcribe'; audio: Float32Array };

export type WhisperResponse =
  | { id: number; type: 'progress'; progress: number; file?: string }
  | { id: number; type: 'ready'; device: string }
  | { id: number; type: 'result'; text: string }
  | { id: number; type: 'error'; message: string };

const MODEL = 'onnx-community/whisper-base';
const ctx = self as unknown as DedicatedWorkerGlobalScope;
env.allowLocalModels = false;

type Transcriber = (audio: Float32Array, opts: Record<string, unknown>) => Promise<unknown>;
let transcriber: Transcriber | null = null;
let device = 'wasm';
let loading: Promise<void> | null = null;
let activeId = 0;
const lastPct = new Map<string, number>();

async function hasWebGPU(): Promise<boolean> {
  try {
    const gpu = (navigator as unknown as { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
    return !!gpu && !!(await gpu.requestAdapter());
  } catch {
    return false;
  }
}

async function build(useGpu: boolean): Promise<Transcriber> {
  const opts = {
    device: useGpu ? 'webgpu' : 'wasm',
    dtype: useGpu
      ? { encoder_model: 'fp32', decoder_model_merged: 'q4' }
      : { encoder_model: 'q8', decoder_model_merged: 'q8' },
    progress_callback: (p: { status: string; progress?: number; file?: string }) => {
      if (p.status === 'progress' && typeof p.progress === 'number') {
        const whole = Math.floor(p.progress);
        if (lastPct.get(p.file ?? '') === whole) return;
        lastPct.set(p.file ?? '', whole);
        ctx.postMessage({ id: activeId, type: 'progress', progress: p.progress, file: p.file } satisfies WhisperResponse);
      }
    },
  };
  const make = pipeline as unknown as (task: string, model: string, o: unknown) => Promise<Transcriber>;
  const p = await make('automatic-speech-recognition', MODEL, opts);
  device = useGpu ? 'webgpu' : 'wasm';
  return p;
}

function load(): Promise<void> {
  if (transcriber) return Promise.resolve();
  loading ??= (async () => {
    const gpu = await hasWebGPU();
    try {
      transcriber = await build(gpu);
    } catch (e) {
      if (!gpu) throw e;
      transcriber = await build(false);
    }
  })().finally(() => {
    loading = null;
  });
  return loading;
}

let chain: Promise<void> = Promise.resolve();

ctx.onmessage = (e: MessageEvent<WhisperRequest>) => {
  const req = e.data;
  chain = chain.then(async () => {
    activeId = req.id;
    try {
      await load();
      if (req.type === 'load') {
        ctx.postMessage({ id: req.id, type: 'ready', device } satisfies WhisperResponse);
        return;
      }
      const out = (await transcriber!(req.audio, { language: 'spanish', task: 'transcribe' })) as
        | { text?: string }
        | { text?: string }[];
      const text = Array.isArray(out) ? out.map((o) => o.text ?? '').join(' ') : (out?.text ?? '');
      ctx.postMessage({ id: req.id, type: 'result', text: text.trim() } satisfies WhisperResponse);
    } catch (err) {
      ctx.postMessage({
        id: req.id,
        type: 'error',
        message: String(err instanceof Error ? err.message : err),
      } satisfies WhisperResponse);
    }
  });
};
