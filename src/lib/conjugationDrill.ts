// Pure logic for the conjugation-table drill shown before a sentence.
import { conjugate, type Person, type Tense } from './conjugate';
import { gradeWord } from './grade';
import { PRESENT, REFLEXIVE_PRONOUN } from './verbs/endings';

export type DrillMode = 'always' | 'new' | 'off';

export interface ConjugationState {
  /** `${lemma}|${tense}` */
  id: string;
  seen: number;
  /** Number of tables answered all-correct on the first try. */
  perfect: number;
  lastSeen: number;
  /** Fraction (0..1) of rows right on the first try, last time. */
  lastScore: number;
}

export interface DrillRow {
  person: Person;
  label: string;
  answer: string;
}

export const TENSE_INFO: Record<Tense, { label: string; tip: string; hint?: string }> = {
  present: { label: 'Present', tip: 'Things happening now or habitually' },
  'near-future': {
    label: 'Near future (ir a + inf.)',
    tip: 'Things about to happen',
    hint: 'ir + a + infinitive',
  },
  preterite: { label: 'Preterite', tip: 'Completed actions in the past' },
  imperfect: { label: 'Imperfect', tip: 'Ongoing or habitual actions in the past' },
  perfect: { label: 'Present perfect', tip: 'Past actions with a link to now', hint: 'haber + participle' },
  future: { label: 'Future', tip: 'What will happen' },
  conditional: { label: 'Conditional', tip: 'What would happen' },
  subjunctive: { label: 'Present subjunctive', tip: 'Wishes, doubts and desires' },
  imperative: { label: 'Imperative (affirmative)', tip: 'Commands and requests' },
};

const LABELS: Record<Person, string> = {
  yo: 'I (yo)',
  tu: 'you – informal (tú)',
  el: 'he / she / you – formal (él/ella/usted)',
  nosotros: 'we (nosotros)',
  vosotros: 'you all – Spain (vosotros)',
  ellos: 'they / you all (ellos/ellas/ustedes)',
};

const IMPERATIVE_LABELS: Partial<Record<Person, string>> = {
  tu: 'you (tú)',
  el: 'you – formal (usted)',
  nosotros: "let's (nosotros)",
  vosotros: 'you all – Spain (vosotros)',
  ellos: 'you all (ustedes)',
};

const ORDER: Person[] = ['yo', 'tu', 'el', 'nosotros', 'vosotros', 'ellos'];

export function buildRows(lemma: string, tense: Tense, includeVosotros: boolean): DrillRow[] | null {
  const table = conjugate(lemma, tense);
  if (!table) return null;
  const rows: DrillRow[] = [];
  for (const p of ORDER) {
    const answer = table[p];
    if (!answer) continue;
    if (p === 'vosotros' && !includeVosotros) continue;
    if (tense === 'imperative' && p === 'yo') continue;
    rows.push({ person: p, label: (tense === 'imperative' ? IMPERATIVE_LABELS[p] : LABELS[p]) ?? LABELS[p], answer });
  }
  return rows.length ? rows : null;
}

export type RowStatus = 'correct' | 'accent' | 'wrong';

export interface RowCheck {
  status: RowStatus;
  ok: boolean;
}

/** Grade one row with the word grader; accent-only differences count as correct. */
export function checkRow(input: string, answer: string): RowCheck {
  if (!input.trim()) return { status: 'wrong', ok: false };
  const r = gradeWord(input, answer);
  if (r.outcome === 'correct') return { status: 'correct', ok: true };
  if (r.outcome === 'accent') return { status: 'accent', ok: true };
  return { status: 'wrong', ok: false };
}

export function checkRows(rows: DrillRow[], inputs: string[]): RowCheck[] {
  return rows.map((r, i) => checkRow(inputs[i] ?? '', r.answer));
}

export function stateId(lemma: string, tense: Tense): string {
  return `${lemma}|${tense}`;
}

/** Skip rule: never in 'off'; in 'new' skip once the table was perfect twice. */
export function shouldDrill(mode: DrillMode, state: ConjugationState | undefined): boolean {
  if (mode === 'off') return false;
  if (mode === 'new') return !state || state.perfect < 2;
  return true;
}

export function updateState(
  prev: ConjugationState | undefined,
  id: string,
  firstTryCorrect: number,
  total: number,
  now: number,
): ConjugationState {
  const perfectNow = total > 0 && firstTryCorrect === total;
  return {
    id,
    seen: (prev?.seen ?? 0) + 1,
    perfect: (prev?.perfect ?? 0) + (perfectNow ? 1 : 0),
    lastSeen: now,
    lastScore: total > 0 ? firstTryCorrect / total : 0,
  };
}

/** Persons whose present form differs from the regular -ar/-er/-ir pattern of the lemma. */
export function irregularPresentPersons(lemma: string): Set<Person> {
  const out = new Set<Person>();
  const table = conjugate(lemma, 'present');
  if (!table) return out;
  const l = lemma.trim().toLowerCase();
  const reflexive = l.endsWith('se');
  const inf = reflexive ? l.slice(0, -2) : l;
  const type = inf.slice(-2);
  if (type !== 'ar' && type !== 'er' && type !== 'ir') return out;
  const stem = inf.slice(0, -2);
  for (const p of ORDER) {
    const actual = table[p];
    if (!actual) continue;
    const regular = (reflexive ? REFLEXIVE_PRONOUN[p] + ' ' : '') + stem + PRESENT[type][p];
    if (actual !== regular) out.add(p);
  }
  return out;
}

/** A present-tense table follows a finished verb card, once per verb per session.
 *  `drilledIds` holds `lemma|tense` ids already drilled this session. */
export function shouldInsertWordDrill(pos: string, lemma: string, drilledIds: ReadonlySet<string>): boolean {
  if (pos !== 'verb' || drilledIds.has(stateId(lemma, 'present'))) return false;
  return conjugate(lemma, 'present') !== null;
}
