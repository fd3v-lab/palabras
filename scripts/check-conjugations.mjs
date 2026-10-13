// Validate the conjugator against the sentence data.
// Run: npm run check:conj   (uses Node's built-in TypeScript stripping; pass --all to list every mismatch)
import { readFileSync } from 'node:fs';
import { conjugate, findSentenceVerb, participle, verbKind } from '../src/lib/conjugate.ts';
import { plain, stripClitics } from '../src/lib/verbs/orthography.ts';

const root = new URL('..', import.meta.url);
const read = (p) => JSON.parse(readFileSync(new URL(p, root), 'utf8'));
const lemmas = read('content/lemmas.json');
const sentences = read('src/data/sentences.json');
const lemmaById = new Map(lemmas.map((l) => [l.id, l.lemma]));
const lemmaOf = (id) => lemmaById.get(id);
const showAll = process.argv.includes('--all');

const TENSE_LABEL = {
  present: 'present',
  preterite: 'preterite',
  imperfect: 'imperfect',
  future: 'future',
  conditional: 'conditional',
  imperative: 'imperative',
  'present subjunctive': 'subjunctive',
};
const PERSON_LABEL = {
  yo: 'yo', 'tú': 'tu', 'él': 'el', ella: 'el', usted: 'el', nosotros: 'nosotros', vosotros: 'vosotros',
  ellos: 'ellos', ellas: 'ellos', ustedes: 'ellos', impersonal: 'el', 'él/ella': 'el',
};

const formMismatches = [];
const nullSentences = [];
const finderDisagree = [];
let checkedForms = 0;

for (const s of sentences) {
  s.tokens.forEach((tok) => {
    if (!tok.form || !tok.form.includes(' · ')) return;
    const [lemma, label, personRaw] = tok.form.split(' · ');
    if (!verbKind(lemma)) return;
    const surface = tok.t;
    if (lemma === 'haber' && plain(surface) === 'hay') return; // impersonal "hay" (unsupported by the table)
    if (/participle/.test(label)) {
      checkedForms++;
      const want = participle(lemma);
      // participles used as adjectives may agree in gender/number
      const norm = plain(surface);
      const ok = [want, want.replace(/o$/, 'a'), want.replace(/o$/, 'os'), want.replace(/o$/, 'as')].map(plain);
      if (!ok.includes(norm)) formMismatches.push({ id: s.id, grammar: s.grammar, form: tok.form, got: want, surface });
      return;
    }
    if (label === 'infinitive' || label.startsWith('infinitive')) return;
    const tense = TENSE_LABEL[label];
    if (!tense) return;
    const person = PERSON_LABEL[personRaw?.split(/[ (+]/)[0]];
    if (!person) return;
    checkedForms++;
    const table = conjugate(lemma, tense);
    const want = table?.[person];
    const target = want ? plain(want.split(' ').pop()) : undefined;
    const cands = tense === 'imperative' ? stripClitics(surface) : [plain(surface)];
    const alt = tense === 'imperative' && lemma === 'ir' && person === 'nosotros' ? 'vayamos' : null;
    if (!target || !(cands.includes(target) || (alt && cands.includes(alt)))) {
      formMismatches.push({ id: s.id, grammar: s.grammar, form: tok.form, got: want ?? '(none)', surface });
    }
  });
  const found = findSentenceVerb(s, lemmaOf);
  if (!found) nullSentences.push(s);
  else {
    // cross-check: the token the finder picked should carry a note naming the same lemma
    const note = s.tokens[found.tokenIndex].form?.split(' · ')[0];
    if (note && verbKind(note) && note !== found.lemma && !(verbKind(found.lemma) === 'reflexive'))
      finderDisagree.push({ id: s.id, grammar: s.grammar, es: s.es, found: found.lemma, note });
  }
}

const group = (arr, key) => {
  const m = new Map();
  for (const x of arr) m.set(key(x), (m.get(key(x)) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1]);
};

console.log(`Sentences: ${sentences.length}, verb forms checked: ${checkedForms}`);
console.log(`(a) form-note mismatches: ${formMismatches.length}`);
for (const [k, n] of group(formMismatches, (m) => m.form.split(' · ')[1])) console.log(`    ${k}: ${n}`);
for (const m of showAll ? formMismatches : formMismatches.slice(0, 40)) {
  console.log(`  ${m.id} [${m.grammar}] "${m.surface}"  note: ${m.form}  -> conjugator: ${m.got}`);
}
console.log(`(b) findSentenceVerb returned null: ${nullSentences.length}`);
for (const [k, n] of group(nullSentences, (x) => x.grammar)) console.log(`    ${k}: ${n}`);
for (const s of showAll ? nullSentences : nullSentences.slice(0, 40)) console.log(`  ${s.id} [${s.grammar}] ${s.es}`);

console.log(`(c) finder lemma disagrees with the form note: ${finderDisagree.length}`);
for (const d of finderDisagree.slice(0, 40)) console.log(`  ${d.id} [${d.grammar}] ${d.es}  found ${d.found}, note ${d.note}`);

const missing = lemmas.filter((l) => l.pos === 'verb' && !verbKind(l.lemma)).map((l) => l.lemma);
console.log(`Verbs in lemmas.json missing from classification: ${missing.length} ${missing.join(' ')}`);
