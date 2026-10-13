/// <reference lib="webworker" />
// Runs Piper neural TTS off the main thread. Models are fetched from
// Hugging Face on first use and cached by the package in OPFS.
import { TtsSession } from '@mintplex-labs/piper-tts-web';

export type PiperRequest =
  | { id: number; type: 'speak'; text: string; voiceId: string; base: string }
  | { id: number; type: 'download'; voiceId: string; base: string };

export type PiperResponse =
  | { id: number; type: 'progress'; loaded: number; total: number; url: string }
  | { id: number; type: 'audio'; buffer: ArrayBuffer }
  | { id: number; type: 'done' }
  | { id: number; type: 'error'; message: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

let session: TtsSession | null = null;
let sessionKey = '';
let activeId = 0;

async function getSession(voiceId: string, base: string): Promise<TtsSession> {
  const key = `${voiceId}@${base}`;
  if (session && sessionKey === key) return session;
  session = null;
  const s = await TtsSession.create({
    voiceId,
    wasmPaths: {
      onnxWasm: `${base}/vendor/ort/`,
      piperData: `${base}/vendor/piper/piper_phonemize.data`,
      piperWasm: `${base}/vendor/piper/piper_phonemize.wasm`,
    },
    progress: (p) => {
      ctx.postMessage({ id: activeId, type: 'progress', loaded: p.loaded, total: p.total, url: p.url } satisfies PiperResponse);
    },
  });
  session = s;
  sessionKey = key;
  return s;
}

// Requests are handled one at a time so progress is attributed correctly.
let chain: Promise<void> = Promise.resolve();

ctx.onmessage = (e: MessageEvent<PiperRequest>) => {
  const req = e.data;
  chain = chain.then(async () => {
    activeId = req.id;
    try {
      const s = await getSession(req.voiceId, req.base);
      if (req.type === 'download') {
        ctx.postMessage({ id: req.id, type: 'done' } satisfies PiperResponse);
        return;
      }
      const blob = await s.predict(req.text);
      const buffer = await blob.arrayBuffer();
      ctx.postMessage({ id: req.id, type: 'audio', buffer } satisfies PiperResponse, [buffer]);
    } catch (err) {
      session = null;
      ctx.postMessage({ id: req.id, type: 'error', message: String(err instanceof Error ? err.message : err) } satisfies PiperResponse);
    }
  });
};
