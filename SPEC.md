# Spanish vocab + sentence trainer — spec

PWA, UI in English. The learner types Spanish. Everything is stored locally (IndexedDB). There is no backend.

## Stack
- Vite + React + TypeScript (strict), plain CSS (CSS variables, light and dark via `prefers-color-scheme`), mobile-first. No UI framework.
- `dexie` for IndexedDB, `vite-plugin-pwa` for the manifest and offline cache, `vitest` for unit tests.
- Project root is this folder. `content/` holds the authored data (see `content/DATA_SCHEMA.md`); the app never imports from it directly.

## Content build — `scripts/build-content.mjs`
- Runs on `npm run content`, and automatically before `dev`, `build` and `test`.
- Merges `content/lemmas.json`, `content/words/*.json`, `content/sentences/*.json` and `content/overrides.json` into `src/data/words.json` and `src/data/sentences.json`.
- `overrides.json`:
  - `promote`: an object mapping a lemma to the learn-order key it should get.
  - `patch`: an object mapping a lemma to fields that are merged into its word entry.
- Learn order: each word gets `order` = its promote key if one is given, otherwise its `id`. Ties are broken by `id`. New words are introduced in ascending `order`.
- Validation:
  - Errors (script exits 1): duplicate ids, a word without a lemma, a word that is missing required fields.
  - Warnings (printed, and the offending sentence is dropped): a token id that doesn't exist, token `t` values that can't be found in order inside `es`.
  - Print a summary: word count, sentence count per stage, number dropped.
- Missing or partial sentence files are fine; the script just uses what exists.

## Learning model

### Word state (per word id)
`{ id, introduced: boolean, reps, lapses, ease (2.5 start, min 1.3), interval (days), due (ms timestamp), lastSeen, history: last 10 grades }`

### Grades and SRS (a simplified SM-2)
- `again`: `lapses++`, `interval = 0`, due in 10 minutes, `ease -= 0.2`.
- `hard`: `interval = max(1, interval * 1.2)`, `ease -= 0.15`.
- `good`: `interval` goes 1 → 3 → `round(interval * ease)`, `ease` unchanged.
- `easy` is not used.
- `due = now + interval days`.
- Add ±10% fuzz to intervals ≥ 3 days.
- A word counts as **known** when it is introduced. It counts as **mastered** when `interval ≥ 21`.

### Answer checking — `src/lib/grade.ts` (pure functions, unit tested)
- Normalize both sides: trim, lowercase, collapse whitespace, strip `¿ ¡ ? ! . , ; : " '`.
- Compare the answer against the canonical `es` plus the `accept` list (for sentences: `es` plus `alt`).
- Outcomes:
  - `correct`: an exact match → `good`.
  - `accent`: matches once accents are removed (á→a, é→e, í→i, ó→o, ú→u, ü→u; ñ stays distinct from n). Counts as correct → `good`, but the correct spelling is shown with the accent highlighted.
  - `article-missing`: a noun typed without its article → `hard`, with the note "Include the article: la casa".
  - `article-wrong`: the wrong article (`el` instead of `la`) → `again`, with the note "Gender: la casa (feminine)".
  - `typo`: Damerau–Levenshtein distance 1 for words of ≥ 4 characters → `hard`. For sentences: distance ≤ max(1, floor(len/15)) against the closest accepted answer → `hard`.
  - `wrong`: everything else → `again`.
- For sentences and typos, return a word-level diff (tokens marked ok / wrong / missing / extra) against the closest accepted answer, for highlighting.
- The "I was right" override button turns the result into `good`, and adds the typed answer to a local per-item `userAccepted` list that later checks also accept.

### Multiple tries — `src/lib/attempts.ts` (pure, unit tested)
- Setting `maxTries` (default 3, range 1–5). Applies to word quiz cards and sentences.
- A wrong attempt (wrong / article-wrong / article-missing / typo) does not reveal the answer while tries remain: "Not quite — try again (N left)", the typed text stays selected and focused.
  - After the 1st miss: a nudge that does not leak the answer ("Include the article", "Check the gender", "Almost — check spelling").
  - From the 2nd miss: a hint. Words: first letter of each word plus the length pattern (`l_ c___`). Sentences: word-level markers of the typed words (wrong / missing as `___`), never the correct words.
  - After the last miss the answer is revealed.
- `accent` counts as correct immediately. "Don't know" reveals at once.
- SRS grade: correct on try 1 → good; correct on try 2+ → hard (not re-queued); all tries missed or "Don't know" → again (re-queued); "I was right" → good.
- The staged queue advance (`pendingSessionRef`) is computed only once the card is finished.
- Spoken answers: the transcript is normalised first (`src/lib/spoken.ts`: lowercase, punctuation stripped, digits 0–99 spelled out in Spanish) and then graded like typed input.

### Session — `src/lib/session.ts` (pure, unit tested)
Settings (defaults): `newPerSession 10`, `reviewsPerSession 20`, `sentencesPerSession 3`.

**Phase 1: words.**
- New words: the next `newPerSession` words that aren't introduced yet, in learn order.
- Reviews:
  - The most overdue `due ≤ now` words first, up to `reviewsPerSession`.
  - If fewer are due, fill up with introduced words that have the lowest `interval` and were not seen today.
  - If nothing is introduced yet, the session is new words only.
- A new word is first shown as an **intro card**: English, Spanish, gender, the example sentence (es + en) and a 🔊 button.  For verbs (pos "verb") a compact read-only present-tense table follows the example (labels as in the drill, 🔊 per row, respects "Include vosotros"; forms irregular vs. the regular pattern are bold/accent, via `irregularPresentPersons`). Auto-speak still reads only the word. The learner presses "Got it". The word is then quizzed 2–4 cards later.
- Quiz card: English prompt plus `hint`, and for nouns a gender-neutral reminder "(noun — include article)". The learner types, presses Enter, sees feedback, and presses Enter again to continue.
- Mix new and review cards so they don't come in blocks.
- An `again` card is re-queued 3–5 positions later until it has been answered correctly once in this session.
- **Only the first attempt in a session updates the SRS.** A new word that is answered correctly on its first quiz gets interval 1.
- Mark the word `introduced` once its intro card has been seen.

**Phase 2: sentences.**
- A sentence is eligible when every token id is either known or new-today, and at most 2 tokens are unknown (unknown = not introduced; proper names with `id` null count as known).
- Score:
  - +3 for each token that is a word from today's session
  - +1 for each token of a word with `interval < 7`
  - −2 for each unknown token
  - −10 if the sentence was seen within the last 5 days
  - −1 for each time it has already been answered correctly
  - +0.5 random noise
- Prefer stages ≤ `unlockedStage`. `unlockedStage` = the lowest stage for which the learner has fewer than 15 sentences answered correctly, capped by the stages that are available. Stages above `unlockedStage + 1` are excluded.
- Pick the top `sentencesPerSession` with distinct grammar where possible.
- Sentence card: show the English sentence (the Spanish is not shown) and a row of "word help" chips. Each chip stands for a word of the sentence and is labelled with its English `gloss`; tapping it reveals the Spanish `t` and the `form`. Chips for unknown words are highlighted as "new". Chips for known words are also available but muted, and tapping one counts as using a hint.
- After answering, show the canonical Spanish sentence with every token tappable (it reveals `gloss` + `form`), the diff highlighting, and a grammar line for each inflected verb (for example `tengo → tener · present · yo`).
- SRS side effects of sentences:
  - Any known word whose chip was tapped gets `due = now` (it needs review).
  - If the sentence is correct without any hints, each known word in it gets `lastSeen` updated. No interval change.
- Sentence state: `{ id, seen, correct, lastSeen, userAccepted[] }`.

**Phase 3: summary.**
- New words learned, accuracy, words that are now mastered, streak, and "Come back tomorrow: N reviews due".

## Screens
- **Home**:
  - Progress ring (introduced / total) and a mastered count
  - Due today, current streak (days with a completed session)
  - A big "Start session" button, and a secondary "Extra reviews" button (words-only session with reviews only)
- **Session**: phases as above, with a progress bar at the top. Esc/back asks "Quit session?"; progress already answered is kept.
- **Words**: a searchable list of all words (es / en / status: new, learning, mastered, due). Tapping a word opens its details (example, 🔊, SRS info).
- **Settings**:
  - Per-session counts
  - Tries before revealing the answer (`maxTries`, 1–5, default 3)
  - Speech: auto-speak on/off, engine (Neural / Browser), neural voice (3 Spanish voices), "Download voice now" with progress, "Test voice", browser voice preference (es-ES / es-MX / auto) when the engine is Browser
  - Microphone: "Show microphone button" (default on), "Auto-check after speaking" (default on)
  - Export and import progress as JSON
  - Reset progress (with confirmation)

## Conjugation drill
- Before each sentence whose verb `findSentenceVerb` finds (`src/lib/conjugate.ts`), a conjugation card is shown (`src/components/ConjugationCard.tsx`; pure logic and tests in `src/lib/conjugationDrill.ts`). Sentences with no verb go straight to the sentence card.
- Header "<lemma> (<English>) · <Tense label>" with a one-line tense tip. Perfect and near-future show a hint ("haber + participle", "ir + a + infinitive") and ask for the full form ("he tenido", "voy a tener").
- Rows are English-labelled: I, you – informal, he/she/you – formal, we, [you all – Spain (vosotros), only with the setting on], they/you all. The imperative has no yo row (you, you – formal, let's, [vosotros], you all).
- Enter moves to the next row; Enter in the last row checks. Accent keys work for the focused row. No mic.
- Rows are graded with `gradeWord` (an accent-only difference counts as correct and shows the corrected form). Attempts use `evaluateAttempt` with `maxTries`:
  - A miss turns wrong rows red and correct rows green (locked), and shows "N rows to fix — try again (k left)".
  - From the 2nd miss, hint patterns (first letter + length) appear for wrong rows.
  - After the last try the correct forms are revealed. "Show table" reveals everything at once.
- When the table is finished: a 🔊 per row (no auto-read of the whole table) and Continue (Enter). The row the next sentence uses is marked "next sentence" only at that point.
- Persistence: the Dexie table `conjugationStates` (DB version 2, additive migration), keyed `${lemma}|${tense}` with `{seen, perfect, lastSeen, lastScore}`. Included in export/import/reset. The word SRS is unaffected.
- Settings: "Conjugation drill before sentences" = Always (default) / Only new verb+tense combos (skipped once `perfect >= 2`) / Off; "Include vosotros" (default off).
- Word phase (new-word quizzes and reviews, also extra reviews): after every finished verb card (answered correctly or revealed; pos "verb", present conjugation exists) a present-tense conjugation card follows, regardless of the drill setting, once per verb per session (`shouldInsertWordDrill`; re-queued cards do not repeat it). It respects "Include vosotros", counts in the progress bar and persists like other tables. In the sentence phase the drill is skipped if the same `lemma|tense` was already drilled this session.
- The summary shows "Conjugation tables: X/Y perfect".  Extra-review tables are included.

## Input UX
- The input autofocuses, with `autocapitalize=off`, `autocorrect=off`, `spellcheck=false`, `lang="es"`.
- An accent key row `á é í ó ú ñ ü ¿ ¡` inserts the character at the cursor and keeps focus.
- Enter submits, and Enter again continues. There is also a "Don't know" button that grades `again` and shows the answer.

## Speech
- Output (`src/lib/speech.ts`): `speak(text)` uses neural Piper TTS (`@mintplex-labs/piper-tts-web`, run in `src/workers/piper.worker.ts`) when the engine is "neural" (default), and falls back to `speechSynthesis` on error or when the engine is "browser".
  - Voices: `es_ES-davefx-medium` (default), `es_MX-ald-medium`, `es_MX-claude-high` (~63 MB each). The model downloads on first use / via "Download voice now" and is cached in OPFS by the package. The ONNX runtime and piper-phonemize WASM are copied into `public/vendor/` by `scripts/copy-vendor.mjs` and cached at runtime (CacheFirst); none of these large files are precached.
  - Generated audio is kept in an in-memory LRU (100 entries) so repeat 🔊 is instant.
- Auto-speak (setting on): the Spanish is spoken on intro cards and after an answer is revealed or counted correct (words and sentences). Sentences also have a 🔊 button after the reveal.
- Input (`src/lib/stt.ts`, `src/workers/whisper.worker.ts`): 🎤 button next to the input on quiz and sentence cards, or Ctrl+M. Press to start, press again to stop; auto-stops after ~1.5 s of silence (after speech) or 8 s. Audio is recorded with getUserMedia and resampled to 16 kHz mono. `onnx-community/whisper-base` via `@huggingface/transformers` in a Web Worker, language forced to Spanish; WebGPU (fp32 encoder + q4 decoder) when available, otherwise WASM (q8). The model (~80–150 MB) downloads lazily on first use and is cached by the library. The transcript goes into the input box; with "Auto-check after speaking" it is checked straight away. Permission denied / missing getUserMedia show a clear message.

## PWA
- Manifest: name "Palabras", short name "Palabras", theme colour, and a simple SVG icon (plus PNG 192/512 rendered from it, or SVG-only if that's simpler).
- Precache all assets, including `src/data/*.json`, so the app works fully offline.

## Tests
Vitest covers:
- `grade` (all outcomes: accents, article cases, typos, sentence diff)
- the SRS transitions
- the session builder (new/review mix, re-queue, first-attempt-only)
- sentence eligibility and scoring
