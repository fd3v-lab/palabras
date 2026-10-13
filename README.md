# Palabras

An offline-capable Spanish learning PWA: vocabulary and example sentences with spaced repetition, typed or spoken answers, and conjugation drills.

## Features

- Spaced-repetition (SRS) sessions over words and sentences
- Typed answers with accent-key row and diff-based feedback
- Spoken answers via on-device Whisper speech-to-text (transformers.js)
- Neural Spanish text-to-speech via Piper (WASM, downloaded on demand)
- Verb conjugation engine and drills
- Installable PWA; all progress stored locally (IndexedDB / Dexie)

## Run locally

```sh
npm install
npm run dev      # on Windows PowerShell use: npm.cmd run dev
npm test
```

`npm run dev|build|test` first generate `src/data/*.json` from `content/` and copy the ONNX/Piper WASM files into `public/vendor` (both git-ignored).

## Deploy (GitHub Pages)

1. Push to `main` of a GitHub repository.
2. In the repository, Settings -> Pages -> Source = **GitHub Actions**.
3. `.github/workflows/deploy.yml` runs tests and builds with `BASE_PATH=/<repo>/`; the app is served at `https://USER.github.io/REPO/`.

For a manual sub-path build: `BASE_PATH=/repo/ npm run build`.

## Install on a phone

- Android: Chrome -> menu -> Install app
- iPhone: Safari -> Share -> Add to Home Screen

Progress is stored per device. Use Settings -> Export / Import to move it between devices.

## Content

- `content/` - source data: `lemmas.json`, `words/`, `sentences/`, and `overrides.json` (manual corrections merged last)
- `content/DATA_SCHEMA.md` - format of the content files
- `scripts/build-content.mjs` merges these into `src/data/*.json`
