export type Person = 'yo' | 'tu' | 'el' | 'nosotros' | 'vosotros' | 'ellos';
export type Table = Partial<Record<Person, string>>;
export type FullTable = Record<Person, string>;

export const PERSONS: readonly Person[] = ['yo', 'tu', 'el', 'nosotros', 'vosotros', 'ellos'];

/** Stem-change class. 'iar'/'uar' mark verbs whose weak vowel carries a written accent (envío, actúo). */
export type StemClass = 'e>ie' | 'e>i' | 'o>ue' | 'u>ue' | 'i>ie' | 'iar' | 'uar';

/**
 * Overrides layered on top of the class-driven engine. Everything is optional;
 * only what differs from the regular pattern needs to be listed.
 */
export interface Irregular {
  /** Stem-change class applied before the overrides. */
  cls?: StemClass;
  /** Present-tense overrides (e.g. yo: 'tengo'). */
  pres?: Table;
  /** Stem used for every person of the present subjunctive (usually the yo form minus -o). */
  subjStem?: string;
  /** Full or partial present subjunctive overrides. */
  subj?: Table;
  /** Complete or partial preterite overrides. */
  pret?: Table;
  /** Strong preterite stem (tuv-, hic-, ...): endings e, iste, o, imos, isteis, ieron. */
  pretStem?: string;
  /** Strong preterite stem ending in j: 3rd plural is -eron (dijeron). */
  pretJ?: boolean;
  /** Imperfect overrides. */
  imperf?: Table;
  /** Stem shared by future and conditional (tendr-). */
  futStem?: string;
  part?: string;
  ger?: string;
  /** Affirmative imperative overrides (tu, el, nosotros, vosotros, ellos). */
  imper?: Table;
  /** Only these persons exist (impersonal weather verbs). */
  only?: Person[];
}

export interface Compound {
  base: string;
  prefix: string;
}
