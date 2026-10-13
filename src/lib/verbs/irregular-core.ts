import type { Irregular, Table } from './types.ts';

const tbl = (yo: string, tu: string, el: string, nosotros: string, vosotros: string, ellos: string): Table => ({
  yo, tu, el, nosotros, vosotros, ellos,
});

/** The most irregular verbs: ser, estar, ir, haber, dar, ver, saber, caber, andar, reír, oír. */
export const IRREGULAR_CORE: Record<string, Irregular> = {
  ser: {
    pres: tbl('soy', 'eres', 'es', 'somos', 'sois', 'son'),
    subj: tbl('sea', 'seas', 'sea', 'seamos', 'seáis', 'sean'),
    pret: tbl('fui', 'fuiste', 'fue', 'fuimos', 'fuisteis', 'fueron'),
    imperf: tbl('era', 'eras', 'era', 'éramos', 'erais', 'eran'),
    ger: 'siendo',
    part: 'sido',
    imper: { tu: 'sé' },
  },
  estar: {
    pres: { yo: 'estoy', tu: 'estás', el: 'está', ellos: 'están' },
    subj: tbl('esté', 'estés', 'esté', 'estemos', 'estéis', 'estén'),
    pretStem: 'estuv',
    imper: { tu: 'está' },
  },
  ir: {
    pres: tbl('voy', 'vas', 'va', 'vamos', 'vais', 'van'),
    subj: tbl('vaya', 'vayas', 'vaya', 'vayamos', 'vayáis', 'vayan'),
    pret: tbl('fui', 'fuiste', 'fue', 'fuimos', 'fuisteis', 'fueron'),
    imperf: tbl('iba', 'ibas', 'iba', 'íbamos', 'ibais', 'iban'),
    ger: 'yendo',
    part: 'ido',
    imper: { tu: 've', nosotros: 'vamos', vosotros: 'id' },
  },
  haber: {
    pres: tbl('he', 'has', 'ha', 'hemos', 'habéis', 'han'),
    subj: tbl('haya', 'hayas', 'haya', 'hayamos', 'hayáis', 'hayan'),
    pretStem: 'hub',
    futStem: 'habr',
    imper: { tu: 'he' },
  },
  dar: {
    pres: { yo: 'doy', tu: 'das', el: 'da', nosotros: 'damos', vosotros: 'dais', ellos: 'dan' },
    subj: tbl('dé', 'des', 'dé', 'demos', 'deis', 'den'),
    pret: tbl('di', 'diste', 'dio', 'dimos', 'disteis', 'dieron'),
    imper: { tu: 'da' },
  },
  ver: {
    pres: tbl('veo', 'ves', 've', 'vemos', 'veis', 'ven'),
    subjStem: 've',
    pret: tbl('vi', 'viste', 'vio', 'vimos', 'visteis', 'vieron'),
    imperf: tbl('veía', 'veías', 'veía', 'veíamos', 'veíais', 'veían'),
    part: 'visto',
    imper: { tu: 've' },
  },
  saber: {
    pres: { yo: 'sé' },
    subj: tbl('sepa', 'sepas', 'sepa', 'sepamos', 'sepáis', 'sepan'),
    pretStem: 'sup',
    futStem: 'sabr',
  },
  caber: {
    pres: { yo: 'quepo' },
    subjStem: 'quep',
    pretStem: 'cup',
    futStem: 'cabr',
  },
  andar: {
    pretStem: 'anduv',
  },
  reír: {
    pres: tbl('río', 'ríes', 'ríe', 'reímos', 'reís', 'ríen'),
    subj: tbl('ría', 'rías', 'ría', 'riamos', 'riáis', 'rían'),
    pret: tbl('reí', 'reíste', 'rió', 'reímos', 'reísteis', 'rieron'),
    ger: 'riendo',
    part: 'reído',
    imper: { tu: 'ríe' },
  },
  oír: {
    pres: tbl('oigo', 'oyes', 'oye', 'oímos', 'oís', 'oyen'),
    subjStem: 'oig',
    imper: { tu: 'oye' },
  },
};
