import { COMPOUNDS } from './compounds.ts';
import {
  CONDITIONAL,
  FUTURE,
  IMPERFECT,
  PRESENT,
  PRETERITE,
  STRONG_PRETERITE,
  SUBJUNCTIVE,
  type VerbType,
} from './endings.ts';
import { IRREGULAR_CORE } from './irregular-core.ts';
import { IRREGULAR_EXTRA } from './irregular-extra.ts';
import { IRREGULAR_STEMS } from './irregular-stems.ts';
import { STEM_CLASSES } from './classes.ts';
import { accentLast, isVowel, nuclei } from './orthography.ts';
import { PERSONS, type FullTable, type Irregular, type Person, type StemClass, type Table } from './types.ts';

/** All simple (non-compound-tense) forms of one non-reflexive verb. */
export interface Core {
  inf: string;
  pres: FullTable;
  pret: FullTable;
  imperf: FullTable;
  fut: FullTable;
  cond: FullTable;
  subj: FullTable;
  imper: Table;
  part: string;
  ger: string;
  only?: Person[];
}

const CLASS_BY_VERB = new Map<string, StemClass>();
for (const [cls, list] of Object.entries(STEM_CLASSES)) for (const v of list) CLASS_BY_VERB.set(v, cls as StemClass);

const IRR: Record<string, Irregular> = { ...IRREGULAR_CORE, ...IRREGULAR_STEMS, ...IRREGULAR_EXTRA };

function replaceLast(stem: string, from: string, to: string): string {
  const i = stem.lastIndexOf(from);
  if (i < 0) return stem;
  return stem.slice(0, i) + to + stem.slice(i + from.length);
}

function change(stem: string, cls: StemClass): string {
  switch (cls) {
    case 'e>ie':
      return replaceLast(stem, 'e', 'ie');
    case 'e>i':
      return replaceLast(stem, 'e', 'i');
    case 'o>ue':
      return stem.lastIndexOf('o') === 0 ? 'hu' + stem.replace('o', 'e') : replaceLast(stem, 'o', 'ue');
    case 'u>ue':
      return replaceLast(stem, 'u', 'ue');
    case 'i>ie':
      return replaceLast(stem, 'i', 'ie');
    case 'iar':
    case 'uar': {
      const i = stem.length - 1;
      return stem.slice(0, i) + (cls === 'iar' ? 'í' : 'ú');
    }
  }
}

/** The -ir change that also hits the preterite 3rd person, gerund and subjunctive nosotros (e>i, o>u). */
function shift(stem: string, cls: StemClass | undefined): string {
  if (cls === 'e>ie' || cls === 'e>i') return replaceLast(stem, 'e', 'i');
  if (cls === 'o>ue') return replaceLast(stem, 'o', 'u');
  return stem;
}

function typeOf(inf: string): VerbType {
  if (inf.endsWith('ar')) return 'ar';
  if (inf.endsWith('er')) return 'er';
  return 'ir';
}

/** Join stem and ending, applying the spelling rules (-car/-gar/-zar, -ger/-gir, -cer/-cir, -uir, -guir). */
function join(stem: string, ending: string, inf: string): string {
  const type = typeOf(inf);
  const c = ending[0];
  if (type === 'ar' && (c === 'e' || c === 'é')) {
    if (stem.endsWith('c')) stem = stem.slice(0, -1) + 'qu';
    else if (stem.endsWith('gu') && inf.endsWith('guar')) stem = stem.slice(0, -1) + 'ü';
    else if (stem.endsWith('g')) stem += 'u';
    else if (stem.endsWith('z')) stem = stem.slice(0, -1) + 'c';
  } else if (isUir(inf) && 'aeoáéó'.includes(c)) {
    stem += 'y';
  } else if (type !== 'ar' && 'aoáó'.includes(c)) {
    if (inf.endsWith('guir') && stem.endsWith('gu')) stem = stem.slice(0, -1);
    else if (inf.endsWith('quir') && stem.endsWith('qu')) stem = stem.slice(0, -2) + 'c';
    else if (stem.endsWith('g')) stem = stem.slice(0, -1) + 'j';
    else if (stem.endsWith('c')) {
      const before = stem[stem.length - 2];
      stem = stem.slice(0, -1) + (isVowel(before) ? 'zc' : 'z');
    }
  }
  return stem + ending;
}

function isUir(inf: string): boolean {
  return inf.endsWith('uir') && !inf.endsWith('guir') && !inf.endsWith('quir');
}

/** Stems ending in a/e/o (leer, caer, oír) or -uir take y between vowels. */
function yStem(stem: string, inf: string): boolean {
  return 'aeo'.includes(stem[stem.length - 1] ?? '-') || isUir(inf);
}

/** Apply the i -> y / i dropped changes for -ió, -ieron, -iendo. */
function iFix(stem: string, ending: string, inf: string): string {
  if (/^i(ó|eron|endo|era|ese)/.test(ending)) {
    if (yStem(stem, inf)) return stem + 'y' + ending.slice(1);
    if (stem.endsWith('ñ') || stem.endsWith('ll')) return stem + ending.slice(1);
  }
  return stem + ending;
}

function per<T>(fn: (p: Person) => T): Record<Person, T> {
  return Object.fromEntries(PERSONS.map((p) => [p, fn(p)])) as Record<Person, T>;
}

const STRONG_PERSONS: Person[] = ['yo', 'tu', 'el', 'ellos'];

function buildRegular(inf: string): Core {
  const irr: Irregular = IRR[inf] ?? {};
  const cls = irr.cls ?? CLASS_BY_VERB.get(inf);
  const type = typeOf(inf);
  const stem = inf.slice(0, -2);
  const strongStem = cls ? change(stem, cls) : stem;
  const shiftedStem = type === 'ir' ? shift(stem, cls) : stem;
  const stemFor = (p: Person) => (STRONG_PERSONS.includes(p) ? strongStem : stem);

  // present
  const pres = per((p) => join(stemFor(p), PRESENT[type][p], inf));
  Object.assign(pres, irr.pres);

  // preterite
  let pret: FullTable;
  if (irr.pretStem) {
    pret = per((p) => {
      if (p === 'ellos' && irr.pretJ) return irr.pretStem + 'eron';
      return irr.pretStem + STRONG_PRETERITE[p];
    });
  } else {
    pret = per((p) => {
      const s = p === 'el' || p === 'ellos' ? shiftedStem : stem;
      const ending = PRETERITE[type][p];
      let e = ending;
      if (type !== 'ar' && 'aeo'.includes(stem[stem.length - 1] ?? '-') && ['tu', 'nosotros', 'vosotros'].includes(p)) {
        e = ending.replace(/^i/, 'í'); // leíste, leímos, oísteis
      }
      return type === 'ar' ? join(s, e, inf) : iFix(s, e, inf);
    });
  }
  Object.assign(pret, irr.pret);

  // imperfect
  const imperf = per((p) => stem + IMPERFECT[type][p]);
  Object.assign(imperf, irr.imperf);

  // future & conditional
  const futStem = irr.futStem ?? inf.replace(/ír$/, 'ir');
  const fut = per((p) => futStem + FUTURE[p]);
  const cond = per((p) => futStem + CONDITIONAL[p]);

  // present subjunctive
  const subjStemFromYo = irr.subjStem ?? (irr.pres?.yo ? irr.pres.yo.slice(0, -1) : undefined);
  const subj = per((p) => {
    if (subjStemFromYo) return subjStemFromYo + SUBJUNCTIVE[type][p];
    const s = STRONG_PERSONS.includes(p) ? strongStem : shiftedStem;
    return join(s, SUBJUNCTIVE[type][p], inf);
  });
  Object.assign(subj, irr.subj);

  // participle / gerund
  const part =
    irr.part ?? stem + (type === 'ar' ? 'ado' : 'aeo'.includes(stem[stem.length - 1] ?? '-') ? 'ído' : 'ido');
  const ger = irr.ger ?? (type === 'ar' ? stem + 'ando' : iFix(shiftedStem, 'iendo', inf));

  // imperative (affirmative)
  const imper: Table = {
    tu: pres.el,
    el: subj.el,
    nosotros: subj.nosotros,
    vosotros: inf.slice(0, -1) + 'd',
    ellos: subj.ellos,
  };
  Object.assign(imper, irr.imper);

  const core: Core = { inf, pres, pret, imperf, fut, cond, subj, imper, part, ger };
  if (irr.only) core.only = irr.only;
  return core;
}

/** prefix + base form; a monosyllabic base keeps its stress, so it needs a written accent (supón, prevé). */
function prefixed(prefix: string, base: string): string {
  const joined = prefix + base;
  const mono = nuclei(base).length === 1 && !/[áéíóú]/.test(base);
  if (!mono) return joined;
  const last = joined[joined.length - 1];
  const defaultPenult = isVowel(last) || last === 'n' || last === 's';
  return defaultPenult ? accentLast(joined) : joined;
}

const cache = new Map<string, Core | null>();

export function coreOf(inf: string): Core | null {
  const hit = cache.get(inf);
  if (hit !== undefined) return hit;
  let core: Core | null = null;
  const comp = COMPOUNDS[inf];
  if (comp) {
    const base = coreOf(comp.base);
    if (base) {
      const px = (t: FullTable): FullTable => per((p) => prefixed(comp.prefix, t[p]));
      core = {
        inf,
        pres: px(base.pres),
        pret: px(base.pret),
        imperf: px(base.imperf),
        fut: per((p) => comp.prefix + base.fut[p]),
        cond: per((p) => comp.prefix + base.cond[p]),
        subj: px(base.subj),
        imper: Object.fromEntries(
          (Object.entries(base.imper) as [Person, string][]).map(([p, v]) => [
            p,
            p === 'vosotros' ? inf.slice(0, -1) + 'd' : prefixed(comp.prefix, v),
          ]),
        ) as Table,
        part: comp.prefix + base.part,
        ger: prefixed(comp.prefix, base.ger),
      };
    }
  } else if (/(ar|er|ir|ír)$/.test(inf)) {
    core = buildRegular(inf);
  }
  cache.set(inf, core);
  return core;
}
