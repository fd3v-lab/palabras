# Content data schema

All content is authored as JSON (UTF-8, no BOM) in `content/` and merged into `src/data/` by a build script.
App UI language is English; the learner types Spanish.

## lemmas.json — ranked frequency list (source of truth for word IDs)

```json
[{ "id": 1, "lemma": "de", "pos": "prep" }]
```
- `id` = frequency rank, 1..N, unique, contiguous. Never renumber once published; extensions (1001..5000) append.
- `pos`: noun | verb | adj | adv | pron | prep | conj | det | num | interj | other
- Only lemmas (dictionary forms): `ser`, not `es`; `bueno`, not `buena`. No duplicates (ser/estar are separate lemmas; `el`/`la`/`los` = one lemma `el`).

## words/*.json — flashcard entries (one per lemma id)

```json
{
  "id": 42,
  "es": "la casa",
  "accept": ["casa"],
  "en": "house, home",
  "hint": "",
  "pos": "noun",
  "gender": "f",
  "example": { "es": "Mi casa es pequeña.", "en": "My house is small." }
}
```
- `es`: canonical answer the learner must type. Nouns WITH definite article (`el`/`la`; `el agua` is `f`). Verbs as infinitive. Adjectives masculine singular.
- `accept`: other Spanish answers that are fully correct for the English prompt (genuine synonyms or variant forms, e.g. `"la computadora"` / `"el ordenador"`). Do NOT list the noun without its article; the app handles that case itself as "missing article". Use `[]` when there are none.
- `en`: English prompt shown to the learner, comma-separated senses, most common first. Must be specific enough to point to ONE Spanish answer.
- `hint`: disambiguation shown under the prompt when `en` is ambiguous, e.g. `"to be (permanent)"` vs `"to be (temporary/location)"`, `"you (informal)"`. Empty string if not needed.
- `gender`: `m` | `f` | `mf` (e.g. `el/la estudiante`) — nouns only, otherwise omit.
- `example`: short, natural sentence using the word, A1–A2 level where possible.

## sentences/*.json — translation exercises

```json
{
  "id": "s0001",
  "en": "I have two brothers.",
  "es": "Tengo dos hermanos.",
  "alt": ["Yo tengo dos hermanos."],
  "stage": 1,
  "grammar": "present",
  "tokens": [
    { "t": "Tengo", "id": 18, "gloss": "I have", "form": "tener · present · yo" },
    { "t": "dos", "id": 60, "gloss": "two" },
    { "t": "hermanos", "id": 210, "gloss": "brothers", "form": "hermano · plural" }
  ]
}
```
- Prompt is `en`; learner types Spanish. `es` is the canonical answer, `alt` holds other fully correct translations (subject pronoun included/omitted, word-order variants, synonyms).
- `tokens`: every Spanish WORD of `es` in order (no punctuation tokens). `t` is the exact surface form as it appears in `es` (case included). `id` is the lemma id from `lemmas.json`; use `null` only for proper names. Contractions: `al` → id of `a`, `del` → id of `de` (gloss "to the"/"of the").
- `gloss`: English meaning of that exact form in context (shown when the learner taps the word).
- `form`: grammar note for inflected forms (`lemma · tense · person`, or `lemma · plural/feminine`). Omit when the surface form equals the lemma.
- `stage` / `grammar` progression:
  1. present (regular + ser/estar/tener/ir) — `present`
  2. present irregular / stem-changing, `ir a` + infinitive — `present`, `near-future`
  3. preterite — `preterite`
  4. imperfect — `imperfect`
  5. present perfect — `perfect`
  6. future / conditional — `future`, `conditional`
  7. imperative, present subjunctive (common triggers) — `imperative`, `subjunctive`
- Sentences 3–10 words, natural, everyday, neutral Latin-American/Peninsular-compatible vocabulary. Avoid vosotros in canonical answers (accept in `alt` where natural).
