#!/usr/bin/env node
// Merges content/lemmas.json, content/words/*.json, content/sentences/*.json and
// content/overrides.json into src/data/words.json and src/data/sentences.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CONTENT = path.join(ROOT, 'content');
const OUT_DIR = path.join(ROOT, 'src', 'data');

const PUNCT_RE = /[¿¡?!.,;:"'']/g;

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function listJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => path.join(dir, f));
}

function normalizeForTokenMatch(s) {
  return s.replace(PUNCT_RE, '').trim();
}

function main() {
  const errors = [];
  const warnings = [];

  // ---- lemmas ----
  const lemmasPath = path.join(CONTENT, 'lemmas.json');
  const lemmas = readJson(lemmasPath);
  const lemmaById = new Map();
  const lemmaSeen = new Set();
  for (const l of lemmas) {
    if (lemmaSeen.has(l.id)) {
      errors.push(`duplicate lemma id: ${l.id}`);
    }
    lemmaSeen.add(l.id);
    lemmaById.set(l.id, l);
  }

  // ---- overrides ----
  const overridesPath = path.join(CONTENT, 'overrides.json');
  const overrides = fs.existsSync(overridesPath)
    ? readJson(overridesPath)
    : { promote: {}, patch: {} };
  const promote = overrides.promote ?? {};
  const patch = overrides.patch ?? {};

  // ---- words ----
  const wordsDir = path.join(CONTENT, 'words');
  const wordFiles = listJsonFiles(wordsDir);
  const wordsById = new Map();
  const wordSeenIds = new Set();
  const REQUIRED_WORD_FIELDS = ['id', 'es', 'en', 'pos', 'example'];

  for (const file of wordFiles) {
    const entries = readJson(file);
    for (const w of entries) {
      if (wordSeenIds.has(w.id)) {
        errors.push(`duplicate word id: ${w.id} (in ${path.basename(file)})`);
        continue;
      }
      wordSeenIds.add(w.id);

      for (const field of REQUIRED_WORD_FIELDS) {
        if (w[field] === undefined || w[field] === null) {
          errors.push(`word ${w.id} is missing required field "${field}" (in ${path.basename(file)})`);
        }
      }

      const lemma = lemmaById.get(w.id);
      if (!lemma) {
        errors.push(`word ${w.id} has no matching lemma in lemmas.json`);
        continue;
      }

      let entry = {
        id: w.id,
        lemma: lemma.lemma,
        es: w.es,
        accept: w.accept ?? [],
        en: w.en,
        hint: w.hint ?? '',
        pos: w.pos,
        example: w.example,
      };
      if (w.gender) entry.gender = w.gender;

      // apply patch override, if any, keyed by lemma
      const p = patch[lemma.lemma];
      if (p) {
        entry = { ...entry, ...p };
      }

      // learn order: promote key if given, else id. Ties broken by id (handled in sort).
      const promoted = promote[lemma.lemma];
      entry.order = promoted !== undefined ? promoted : w.id;

      wordsById.set(w.id, entry);
    }
  }

  if (errors.length > 0) {
    console.error('Content build errors:');
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  const words = [...wordsById.values()].sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.id - b.id;
  });

  // ---- sentences ----
  const sentencesDir = path.join(CONTENT, 'sentences');
  const sentenceFiles = listJsonFiles(sentencesDir);
  const REQUIRED_SENTENCE_FIELDS = ['id', 'en', 'es', 'stage', 'grammar', 'tokens'];
  const sentences = [];
  const sentenceIdsSeen = new Set();
  let dropped = 0;

  for (const file of sentenceFiles) {
    const entries = readJson(file);
    for (const s of entries) {
      let bad = false;
      for (const field of REQUIRED_SENTENCE_FIELDS) {
        if (s[field] === undefined || s[field] === null) {
          warnings.push(`sentence ${s.id ?? '?'} missing required field "${field}" (in ${path.basename(file)}) — dropped`);
          bad = true;
        }
      }
      if (bad) {
        dropped++;
        continue;
      }

      if (sentenceIdsSeen.has(s.id)) {
        warnings.push(`duplicate sentence id: ${s.id} (in ${path.basename(file)}) — dropped`);
        dropped++;
        continue;
      }

      // token id existence check
      let tokenIdsOk = true;
      for (const tok of s.tokens) {
        if (tok.id !== null && tok.id !== undefined && !wordsById.has(tok.id)) {
          warnings.push(`sentence ${s.id}: token "${tok.t}" has unknown id ${tok.id} — dropped`);
          tokenIdsOk = false;
        }
      }
      if (!tokenIdsOk) {
        dropped++;
        continue;
      }

      // token order-within-es check (subsequence match, case-sensitive)
      const esWords = normalizeForTokenMatch(s.es).split(/\s+/).filter(Boolean);
      let cursor = 0;
      let orderOk = true;
      for (const tok of s.tokens) {
        const idx = esWords.indexOf(tok.t, cursor);
        if (idx === -1) {
          orderOk = false;
          break;
        }
        cursor = idx + 1;
      }
      if (!orderOk) {
        warnings.push(`sentence ${s.id}: tokens could not be matched in order inside "es" — dropped`);
        dropped++;
        continue;
      }

      sentenceIdsSeen.add(s.id);
      sentences.push({
        id: s.id,
        en: s.en,
        es: s.es,
        alt: s.alt ?? [],
        stage: s.stage,
        grammar: s.grammar,
        tokens: s.tokens,
      });
    }
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'words.json'), JSON.stringify(words, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'sentences.json'), JSON.stringify(sentences, null, 2));

  if (warnings.length > 0) {
    console.warn('Content build warnings:');
    for (const w of warnings) console.warn(`  - ${w}`);
  }

  const byStage = new Map();
  for (const s of sentences) {
    byStage.set(s.stage, (byStage.get(s.stage) ?? 0) + 1);
  }
  const stageSummary = [...byStage.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([stage, count]) => `stage ${stage}: ${count}`)
    .join(', ');

  console.log('Content build summary:');
  console.log(`  words: ${words.length}`);
  console.log(`  sentences: ${sentences.length}${stageSummary ? ` (${stageSummary})` : ''}`);
  console.log(`  dropped: ${dropped}`);
}

main();
