import type { Irregular, Table } from './types.ts';

const tbl = (yo: string, tu: string, el: string, nosotros: string, vosotros: string, ellos: string): Table => ({
  yo, tu, el, nosotros, vosotros, ellos,
});

/** Accent-shifting verbs (prohibir: prohíbo). */
export const IRREGULAR_EXTRA: Record<string, Irregular> = {
  prohibir: {
    pres: { yo: 'prohíbo', tu: 'prohíbes', el: 'prohíbe', ellos: 'prohíben' },
    subj: tbl('prohíba', 'prohíbas', 'prohíba', 'prohibamos', 'prohibáis', 'prohíban'),
  },
  reunir: {
    pres: { yo: 'reúno', tu: 'reúnes', el: 'reúne', ellos: 'reúnen' },
    subj: tbl('reúna', 'reúnas', 'reúna', 'reunamos', 'reunáis', 'reúnan'),
  },
};
