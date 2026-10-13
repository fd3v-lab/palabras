// Copies the ONNX runtime + piper-phonemize WASM files into public/vendor so
// neural TTS works without CDN access (and offline once cached at runtime).
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const jobs = [
  ['node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs', 'public/vendor/ort/ort-wasm-simd-threaded.mjs'],
  ['node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm', 'public/vendor/ort/ort-wasm-simd-threaded.wasm'],
  ['node_modules/@diffusionstudio/piper-wasm/build/piper_phonemize.wasm', 'public/vendor/piper/piper_phonemize.wasm'],
  ['node_modules/@diffusionstudio/piper-wasm/build/piper_phonemize.data', 'public/vendor/piper/piper_phonemize.data'],
];
for (const [from, to] of jobs) {
  const src = resolve(root, from);
  const dst = resolve(root, to);
  if (!existsSync(src)) {
    console.warn(`copy-vendor: missing ${from}`);
    continue;
  }
  mkdirSync(resolve(dst, '..'), { recursive: true });
  copyFileSync(src, dst);
}
console.log('copy-vendor: done');
