import { coreOf } from './verbs/engine.ts';
import { verbKind } from './verbs/classes.ts';
import { HABER_PRESENT, IR_PRESENT, REFLEXIVE_PRONOUN } from './verbs/endings.ts';
import { attach, plain, stripClitics } from './verbs/orthography.ts';
import { PERSONS, type Person, type Table } from './verbs/types.ts';

export type Tense =
  | 'present'
  | 'preterite'
  | 'imperfect'
  | 'perfect'
  | 'future'
  | 'conditional'
  | 'subjunctive'
  | 'imperative'
  | 'near-future';
export type { Person, Table };

export { verbKind, allKnownVerbs } from './verbs/classes.ts';

interface Resolved {
  base: string;
  reflexive: boolean;
}

function resolve(lemma: string): Resolved | null {
  const l = lemma.trim().toLowerCase();
  const kind = verbKind(l);
  if (!kind) return null;
  if (kind === 'reflexive') return { base: l.slice(0, -2), reflexive: true };
  return { base: l, reflexive: false };
}

function filterOnly(table: Table, only?: Person[]): Table {
  if (!only) return table;
  const out: Table = {};
  for (const p of only) out[p] = table[p];
  return out;
}

function withPronoun(table: Table): Table {
  const out: Table = {};
  for (const p of PERSONS) {
    const f = table[p];
    if (f !== undefined) out[p] = `${REFLEXIVE_PRONOUN[p]} ${f}`;
  }
  return out;
}

function reflexiveImperative(imper: Table): Table {
  const out: Table = {};
  if (imper.tu) out.tu = attach(imper.tu, 'te');
  if (imper.el) out.el = attach(imper.el, 'se');
  if (imper.nosotros) out.nosotros = attach(imper.nosotros.replace(/s$/, ''), 'nos');
  if (imper.vosotros) {
    const v = imper.vosotros;
    out.vosotros = v === 'id' ? 'idos' : v.replace(/id$/, 'íos').replace(/d$/, 'os');
  }
  if (imper.ellos) out.ellos = attach(imper.ellos, 'se');
  return out;
}

/** Conjugate a verb in one tense; null when the lemma is not a known verb. */
export function conjugate(lemma: string, tense: Tense): Table | null {
  const r = resolve(lemma);
  if (!r) return null;
  const core = coreOf(r.base);
  if (!core) return null;
  let table: Table;
  switch (tense) {
    case 'present':
      table = core.pres;
      break;
    case 'preterite':
      table = core.pret;
      break;
    case 'imperfect':
      table = core.imperf;
      break;
    case 'future':
      table = core.fut;
      break;
    case 'conditional':
      table = core.cond;
      break;
    case 'subjunctive':
      table = core.subj;
      break;
    case 'imperative':
      return r.reflexive ? reflexiveImperative(core.imper) : { ...core.imper };
    case 'perfect': {
      const t: Table = {};
      for (const p of PERSONS) t[p] = `${HABER_PRESENT[p]} ${core.part}`;
      table = t;
      break;
    }
    case 'near-future': {
      const t: Table = {};
      for (const p of PERSONS) t[p] = `${IR_PRESENT[p]} a ${core.inf}`;
      table = t;
      break;
    }
  }
  const filtered = filterOnly(table, tense === 'perfect' || tense === 'near-future' ? undefined : core.only);
  return r.reflexive ? withPronoun(filtered) : { ...filtered };
}

export function participle(lemma: string): string {
  const r = resolve(lemma);
  return (r && coreOf(r.base)?.part) || '';
}

export function gerund(lemma: string): string {
  const r = resolve(lemma);
  return (r && coreOf(r.base)?.ger) || '';
}

// ---------------------------------------------------------------------------
// Sentence analysis
// ---------------------------------------------------------------------------

export interface SentenceLike {
  grammar: string;
  tokens: { t: string; id: number }[];
}

export interface FoundVerb {
  lemma: string;
  tense: Tense;
  person?: Person;
  tokenIndex: number;
}

const TENSES: readonly Tense[] = [
  'present',
  'preterite',
  'imperfect',
  'perfect',
  'future',
  'conditional',
  'subjunctive',
  'imperative',
  'near-future',
];

const PRONOUN_PERSON: Record<string, Person> = {
  yo: 'yo',
  tu: 'tu',
  el: 'el',
  ella: 'el',
  usted: 'el',
  nosotros: 'nosotros',
  nosotras: 'nosotros',
  vosotros: 'vosotros',
  vosotras: 'vosotros',
  ellos: 'ellos',
  ellas: 'ellos',
  ustedes: 'ellos',
};

/** Words of a form that matter for matching (reflexive pronoun dropped). */
function mainWord(form: string): string {
  const parts = form.split(' ');
  return parts[parts.length - 1];
}

function matchingPersons(table: Table, surface: string, imperative: boolean, reflexiveForm: boolean): Person[] {
  const candidates = imperative ? stripClitics(surface) : [plain(surface)];
  const out: Person[] = [];
  for (const p of PERSONS) {
    const f = table[p];
    if (f === undefined) continue;
    const target = plain(reflexiveForm || f.includes(' ') ? mainWord(f) : f);
    if (candidates.includes(target)) out.push(p);
  }
  return out;
}

function personFromContext(options: Person[], sentence: SentenceLike, index: number): Person {
  if (options.length > 1) {
    for (let k = index - 1; k >= Math.max(0, index - 2); k--) {
      const p = PRONOUN_PERSON[plain(sentence.tokens[k].t)];
      if (p && options.includes(p)) return p;
    }
  }
  return options[0];
}

export function findSentenceVerb(
  sentence: SentenceLike,
  lemmaOf: (id: number) => string | undefined,
): FoundVerb | null {
  const tense = TENSES.find((t) => t === sentence.grammar);
  if (!tense) return null;
  const tokens = sentence.tokens;

  const isVerb = (id: number): string | undefined => {
    const l = lemmaOf(id);
    return l && verbKind(l) ? l : undefined;
  };

  if (tense === 'perfect' || tense === 'near-future') {
    const aux = tense === 'perfect' ? 'haber' : 'ir';
    const auxTable = tense === 'perfect' ? HABER_PRESENT : IR_PRESENT;
    for (let i = 0; i < tokens.length; i++) {
      if (lemmaOf(tokens[i].id) !== aux) continue;
      const persons = PERSONS.filter((p) => plain(auxTable[p]) === plain(tokens[i].t));
      if (persons.length === 0) continue;
      const person = personFromContext(persons, sentence, i);
      for (let j = i + 1; j < tokens.length; j++) {
        const lemma = isVerb(tokens[j].id);
        if (!lemma || (lemma === aux && !(tense === 'perfect' && plain(tokens[j].t) === 'habido'))) continue;
        const r = resolve(lemma);
        const core = r && coreOf(r.base);
        if (!core) continue;
        if (tense === 'perfect') {
          if (plain(tokens[j].t) === plain(core.part)) return { lemma, tense, person, tokenIndex: j };
        } else if (plain(tokens[j - 1]?.t ?? '') === 'a') {
          if (stripClitics(tokens[j].t).includes(plain(core.inf))) return { lemma, tense, person, tokenIndex: j };
        }
      }
    }
    return null;
  }

  for (let i = 0; i < tokens.length; i++) {
    const lemma = isVerb(tokens[i].id);
    if (!lemma) continue;
    const table = conjugate(lemma, tense);
    if (!table) continue;
    const persons = matchingPersons(table, tokens[i].t, tense === 'imperative', verbKind(lemma) === 'reflexive');
    // impersonal "hay" (haber, present)
    if (persons.length === 0 && tense === 'present' && lemma === 'haber' && plain(tokens[i].t) === 'hay') persons.push('el');
    // negative commands use the present subjunctive ("no abras")
    if (persons.length === 0 && tense === 'imperative' && tokens.slice(Math.max(0, i - 3), i).some((x) => plain(x.t) === 'no')) {
      const sub = conjugate(lemma, 'subjunctive');
      if (sub) persons.push(...matchingPersons(sub, tokens[i].t, false, verbKind(lemma) === 'reflexive'));
    }
    if (persons.length === 0 && tense === 'imperative' && lemma === 'ir') {
      // "vayamos" is an accepted alternative to "vamos"
      const alt = conjugate(lemma, 'subjunctive');
      if (alt && plain(alt.nosotros ?? '') === plain(tokens[i].t)) persons.push('nosotros');
    }
    if (persons.length > 0) return { lemma, tense, person: personFromContext(persons, sentence, i), tokenIndex: i };
  }
  return null;
}
