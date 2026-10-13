# Sentence review pass: instructions

Context: the sentence files were written while `lemmas.json` was missing core words. It now has 1128 lemmas (ids 1001–1128 were appended). Learn order: each word's order key is `overrides.json` → `promote[lemma]` if present, otherwise its id. Learners meet words in ascending order.

For EVERY sentence in your files:

1. **Token ids.** Each token `id` must be the correct lemma for that surface form. Fix any merges or workarounds:
   - `ella`, `ellas`, `ustedes`, `te`, `nos`, `les`, `la`/`los`/`las` (as object clitics), `mí`, `ti`, `tu` (possessive), `esto`, `eso` and `aquello` now exist as their own lemmas.
   - `ese` and `este` are separate lemmas.
   - Articles `el/la/los/las` → lemma `el`; `un/una/unos/unas` → lemma `un`.
   - Interrogatives with an accent (`cómo`, `dónde`, `cuándo`, `quién`, `cuál`, `qué`) → the accented lemma. Relative forms without an accent → the unaccented lemma.
   - Contractions: `al` → `a`, `del` → `de`.
   - Multi-word lemmas (`sin embargo`, `a veces`, `tal vez`): tokenize word by word (`a` → a, `veces` → vez), never one multi-word token.
   - Remove bogus `form` notes such as "él · fem".
2. **Workarounds.** Rewrite sentences that were bent around missing words (e.g. "esta noche" used instead of "hoy", no `te`/`nos`) so they read naturally, using the new lemmas where that is more natural. Keep the sentence's `stage`, `grammar` and main teaching target (verb, tense, bracket vocabulary).
3. **tú/usted.** Plain English "you" (singular) → canonical `es` uses **tú**, and `alt` includes the usted version. If the formal form is the point, write "(formal)" in `en` and use usted. "you all" / "you (plural)" → canonical ustedes, and `alt` includes the vosotros version.
4. **Vocabulary range.** A sentence in file `s-NNNN.json` should use words whose learn-order key is ≤ NNNN. At most one word may come from the next 100. Proper names use `id` null.
5. **Correctness.** The Spanish must be grammatical and natural, and the English an accurate, natural prompt. `alt` must cover obvious valid variants: with/without subject pronoun where the verb form is unambiguous, common word-order variants, preterite/perfect alternation where both are natural.
6. Every token has `t` (the exact surface form in order) and `gloss` (English for that form in context). Inflected forms get `form` like `tener · present · yo` or `hermano · plural`.

**Validation** (PowerShell or Node, which is installed at `C:\Program Files\nodejs`). Per file:
- the file parses
- ids are unique and unchanged
- the count is unchanged
- every token id exists in lemmas.json
- the concatenated token `t` values, in order, equal the words of `es` (punctuation stripped)

Keep one object per line, UTF-8. Edit in chunks of ≤ 40 sentences per write to avoid huge generations.
