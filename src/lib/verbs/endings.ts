import type { FullTable } from './types.ts';

export type VerbType = 'ar' | 'er' | 'ir';

const t = (a: string, b: string, c: string, d: string, e: string, f: string): FullTable => ({
  yo: a, tu: b, el: c, nosotros: d, vosotros: e, ellos: f,
});

export const PRESENT: Record<VerbType, FullTable> = {
  ar: t('o', 'as', 'a', 'amos', 'áis', 'an'),
  er: t('o', 'es', 'e', 'emos', 'éis', 'en'),
  ir: t('o', 'es', 'e', 'imos', 'ís', 'en'),
};

export const PRETERITE: Record<VerbType, FullTable> = {
  ar: t('é', 'aste', 'ó', 'amos', 'asteis', 'aron'),
  er: t('í', 'iste', 'ió', 'imos', 'isteis', 'ieron'),
  ir: t('í', 'iste', 'ió', 'imos', 'isteis', 'ieron'),
};

/** Endings of the strong (irregular-stem) preterite. */
export const STRONG_PRETERITE: FullTable = t('e', 'iste', 'o', 'imos', 'isteis', 'ieron');

export const IMPERFECT: Record<VerbType, FullTable> = {
  ar: t('aba', 'abas', 'aba', 'ábamos', 'abais', 'aban'),
  er: t('ía', 'ías', 'ía', 'íamos', 'íais', 'ían'),
  ir: t('ía', 'ías', 'ía', 'íamos', 'íais', 'ían'),
};

export const FUTURE: FullTable = t('é', 'ás', 'á', 'emos', 'éis', 'án');
export const CONDITIONAL: FullTable = t('ía', 'ías', 'ía', 'íamos', 'íais', 'ían');

export const SUBJUNCTIVE: Record<VerbType, FullTable> = {
  ar: t('e', 'es', 'e', 'emos', 'éis', 'en'),
  er: t('a', 'as', 'a', 'amos', 'áis', 'an'),
  ir: t('a', 'as', 'a', 'amos', 'áis', 'an'),
};

/** Present tense of haber, used for the perfect. */
export const HABER_PRESENT: FullTable = t('he', 'has', 'ha', 'hemos', 'habéis', 'han');
/** Present tense of ir, used for the near future. */
export const IR_PRESENT: FullTable = t('voy', 'vas', 'va', 'vamos', 'vais', 'van');
export const REFLEXIVE_PRONOUN: FullTable = t('me', 'te', 'se', 'nos', 'os', 'se');
