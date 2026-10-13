import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { conjugate, findSentenceVerb, gerund, participle, verbKind, type Person, type Tense } from './conjugate.ts';

type Case = [lemma: string, tense: Tense, person: Person, form: string];

const cases: Case[] = [
  // regular
  ['hablar', 'present', 'yo', 'hablo'],
  ['hablar', 'present', 'vosotros', 'habláis'],
  ['comer', 'preterite', 'ellos', 'comieron'],
  ['vivir', 'imperfect', 'nosotros', 'vivíamos'],
  ['hablar', 'imperfect', 'nosotros', 'hablábamos'],
  ['trabajar', 'future', 'tu', 'trabajarás'],
  ['comer', 'conditional', 'yo', 'comería'],
  ['hablar', 'subjunctive', 'tu', 'hables'],
  ['comer', 'subjunctive', 'el', 'coma'],
  ['hablar', 'perfect', 'yo', 'he hablado'],
  ['hablar', 'near-future', 'nosotros', 'vamos a hablar'],
  // stem changes
  ['pensar', 'present', 'el', 'piensa'],
  ['pensar', 'present', 'nosotros', 'pensamos'],
  ['empezar', 'preterite', 'yo', 'empecé'],
  ['empezar', 'subjunctive', 'yo', 'empiece'],
  ['volver', 'present', 'yo', 'vuelvo'],
  ['dormir', 'present', 'tu', 'duermes'],
  ['dormir', 'preterite', 'ellos', 'durmieron'],
  ['dormir', 'subjunctive', 'nosotros', 'durmamos'],
  ['pedir', 'present', 'yo', 'pido'],
  ['pedir', 'preterite', 'el', 'pidió'],
  ['pedir', 'subjunctive', 'nosotros', 'pidamos'],
  ['sentir', 'preterite', 'ellos', 'sintieron'],
  ['jugar', 'present', 'yo', 'juego'],
  ['jugar', 'preterite', 'yo', 'jugué'],
  ['jugar', 'subjunctive', 'nosotros', 'juguemos'],
  ['adquirir', 'present', 'yo', 'adquiero'],
  ['oler', 'present', 'yo', 'huelo'],
  ['seguir', 'present', 'yo', 'sigo'],
  ['seguir', 'preterite', 'el', 'siguió'],
  // orthography
  ['buscar', 'preterite', 'yo', 'busqué'],
  ['pagar', 'preterite', 'yo', 'pagué'],
  ['cruzar', 'preterite', 'yo', 'crucé'],
  ['coger', 'present', 'yo', 'cojo'],
  ['dirigir', 'subjunctive', 'yo', 'dirija'],
  ['conocer', 'present', 'yo', 'conozco'],
  ['conocer', 'subjunctive', 'nosotros', 'conozcamos'],
  ['construir', 'present', 'tu', 'construyes'],
  ['construir', 'preterite', 'el', 'construyó'],
  ['leer', 'preterite', 'ellos', 'leyeron'],
  ['leer', 'preterite', 'tu', 'leíste'],
  ['creer', 'preterite', 'el', 'creyó'],
  ['reír', 'present', 'yo', 'río'],
  ['reír', 'preterite', 'ellos', 'rieron'],
  ['enviar', 'present', 'yo', 'envío'],
  ['enviar', 'present', 'nosotros', 'enviamos'],
  ['continuar', 'present', 'yo', 'continúo'],
  ['elegir', 'present', 'yo', 'elijo'],
  // irregulars
  ['ser', 'present', 'yo', 'soy'],
  ['ser', 'preterite', 'yo', 'fui'],
  ['ir', 'preterite', 'el', 'fue'],
  ['ir', 'subjunctive', 'el', 'vaya'],
  ['ir', 'subjunctive', 'nosotros', 'vayamos'],
  ['ser', 'imperfect', 'nosotros', 'éramos'],
  ['ir', 'imperfect', 'yo', 'iba'],
  ['ver', 'imperfect', 'yo', 'veía'],
  ['dar', 'subjunctive', 'el', 'dé'],
  ['dar', 'preterite', 'yo', 'di'],
  ['saber', 'present', 'yo', 'sé'],
  ['saber', 'subjunctive', 'yo', 'sepa'],
  ['caber', 'present', 'yo', 'quepo'],
  ['estar', 'present', 'tu', 'estás'],
  ['estar', 'preterite', 'yo', 'estuve'],
  ['haber', 'present', 'ellos', 'han'],
  ['tener', 'present', 'yo', 'tengo'],
  ['tener', 'present', 'tu', 'tienes'],
  ['tener', 'preterite', 'el', 'tuvo'],
  ['tener', 'perfect', 'yo', 'he tenido'],
  ['tener', 'near-future', 'yo', 'voy a tener'],
  ['venir', 'present', 'ellos', 'vienen'],
  ['hacer', 'present', 'yo', 'hago'],
  ['hacer', 'preterite', 'el', 'hizo'],
  ['hacer', 'subjunctive', 'tu', 'hagas'],
  ['decir', 'future', 'yo', 'diré'],
  ['decir', 'preterite', 'ellos', 'dijeron'],
  ['decir', 'present', 'tu', 'dices'],
  ['poder', 'present', 'yo', 'puedo'],
  ['poner', 'conditional', 'yo', 'pondría'],
  ['querer', 'future', 'yo', 'querré'],
  ['salir', 'future', 'tu', 'saldrás'],
  ['valer', 'present', 'yo', 'valgo'],
  ['traer', 'preterite', 'ellos', 'trajeron'],
  ['traer', 'present', 'yo', 'traigo'],
  ['oír', 'present', 'yo', 'oigo'],
  ['oír', 'present', 'tu', 'oyes'],
  ['oír', 'preterite', 'el', 'oyó'],
  ['caer', 'present', 'yo', 'caigo'],
  ['caer', 'preterite', 'ellos', 'cayeron'],
  ['conducir', 'preterite', 'ellos', 'condujeron'],
  ['conducir', 'present', 'yo', 'conduzco'],
  ['producir', 'subjunctive', 'yo', 'produzca'],
  ['andar', 'preterite', 'yo', 'anduve'],
  // compounds
  ['mantener', 'present', 'tu', 'mantienes'],
  ['mantener', 'preterite', 'yo', 'mantuve'],
  ['suponer', 'present', 'yo', 'supongo'],
  ['componer', 'future', 'yo', 'compondré'],
  ['deshacer', 'preterite', 'el', 'deshizo'],
  ['devolver', 'present', 'yo', 'devuelvo'],
  ['devolver', 'perfect', 'yo', 'he devuelto'],
  // reflexive
  ['mudarse', 'present', 'yo', 'me mudo'],
  ['mudarse', 'present', 'nosotros', 'nos mudamos'],
  ['mudarse', 'perfect', 'yo', 'me he mudado'],
  ['mudarse', 'near-future', 'tu', 'te vas a mudar'],
  ['mudarse', 'imperative', 'tu', 'múdate'],
  ['mudarse', 'imperative', 'el', 'múdese'],
  ['mudarse', 'imperative', 'nosotros', 'mudémonos'],
  ['mudarse', 'imperative', 'vosotros', 'mudaos'],
  // imperatives
  ['tener', 'imperative', 'tu', 'ten'],
  ['poner', 'imperative', 'tu', 'pon'],
  ['hacer', 'imperative', 'tu', 'haz'],
  ['decir', 'imperative', 'tu', 'di'],
  ['salir', 'imperative', 'tu', 'sal'],
  ['venir', 'imperative', 'tu', 'ven'],
  ['ir', 'imperative', 'tu', 've'],
  ['ser', 'imperative', 'tu', 'sé'],
  ['hablar', 'imperative', 'tu', 'habla'],
  ['hablar', 'imperative', 'el', 'hable'],
  ['hablar', 'imperative', 'vosotros', 'hablad'],
  ['comer', 'imperative', 'ellos', 'coman'],
  ['pedir', 'imperative', 'nosotros', 'pidamos'],
  ['mantener', 'imperative', 'tu', 'mantén'],
  ['suponer', 'imperative', 'tu', 'supón'],
];

describe('conjugate', () => {
  it.each(cases)('%s %s %s = %s', (lemma, tense, person, form) => {
    expect(conjugate(lemma, tense)?.[person]).toBe(form);
  });

  it('returns null for unknown lemmas', () => {
    expect(conjugate('casa', 'present')).toBeNull();
    expect(conjugate('xyzar', 'present')).toBeNull();
  });

  it('imperative has no yo form', () => {
    expect(conjugate('hablar', 'imperative')?.yo).toBeUndefined();
  });

  it('participles', () => {
    const want: Record<string, string> = {
      hacer: 'hecho', decir: 'dicho', ver: 'visto', escribir: 'escrito', poner: 'puesto', volver: 'vuelto',
      abrir: 'abierto', morir: 'muerto', romper: 'roto', cubrir: 'cubierto', descubrir: 'descubierto',
      resolver: 'resuelto', devolver: 'devuelto', leer: 'leído', ser: 'sido', hablar: 'hablado', vivir: 'vivido',
      mudarse: 'mudado', componer: 'compuesto', suponer: 'supuesto',
    };
    for (const [lemma, p] of Object.entries(want)) expect(participle(lemma), lemma).toBe(p);
  });

  it('gerunds', () => {
    expect(gerund('hablar')).toBe('hablando');
    expect(gerund('dormir')).toBe('durmiendo');
    expect(gerund('pedir')).toBe('pidiendo');
    expect(gerund('leer')).toBe('leyendo');
    expect(gerund('ir')).toBe('yendo');
    expect(gerund('decir')).toBe('diciendo');
    expect(gerund('reír')).toBe('riendo');
  });

  it('classifies every verb in lemmas.json', () => {
    const lemmas = JSON.parse(readFileSync(new URL('../../content/lemmas.json', import.meta.url), 'utf8')) as {
      lemma: string;
      pos: string;
    }[];
    const verbs = lemmas.filter((l) => l.pos === 'verb').map((l) => l.lemma);
    expect(verbs.length).toBeGreaterThan(200);
    expect(verbs.filter((v) => !verbKind(v))).toEqual([]);
    for (const v of verbs) {
      for (const t of ['present', 'preterite', 'imperfect', 'future', 'conditional', 'subjunctive'] as Tense[]) {
        const table = conjugate(v, t);
        expect(table, `${v} ${t}`).not.toBeNull();
        for (const f of Object.values(table ?? {})) expect(f).toMatch(/^[\p{L} ]+$/u);
      }
    }
  });
});

describe('findSentenceVerb', () => {
  const lemmas: Record<number, string> = { 1: 'haber', 2: 'tener', 3: 'ir', 4: 'comprar', 5: 'abrir', 6: 'mudar' };
  const lemmaOf = (id: number) => lemmas[id];
  const tok = (t: string, id: number) => ({ t, id });

  it('finds the participle lemma for the perfect', () => {
    const r = findSentenceVerb({ grammar: 'perfect', tokens: [tok('He', 1), tok('tenido', 2)] }, lemmaOf);
    expect(r).toEqual({ lemma: 'tener', tense: 'perfect', person: 'yo', tokenIndex: 1 });
  });

  it('finds the infinitive for the near future', () => {
    const r = findSentenceVerb(
      { grammar: 'near-future', tokens: [tok('Voy', 3), tok('a', 99), tok('comprarlo', 4)] },
      lemmaOf,
    );
    expect(r).toMatchObject({ lemma: 'comprar', tense: 'near-future', person: 'yo', tokenIndex: 2 });
  });

  it('finds imperatives with clitics and negative commands', () => {
    const a = findSentenceVerb({ grammar: 'imperative', tokens: [tok('Ábrelo', 5)] }, lemmaOf);
    expect(a).toMatchObject({ lemma: 'abrir', tense: 'imperative', person: 'tu' });
    const b = findSentenceVerb({ grammar: 'imperative', tokens: [tok('No', 99), tok('abras', 5)] }, lemmaOf);
    expect(b).toMatchObject({ lemma: 'abrir', person: 'tu' });
  });

  it('uses the preceding pronoun to disambiguate', () => {
    const r = findSentenceVerb({ grammar: 'imperfect', tokens: [tok('Ella', 98), tok('tenía', 2)] }, lemmaOf);
    expect(r?.person).toBe('el');
  });

  it('matches reflexive present forms and returns null otherwise', () => {
    const r = findSentenceVerb({ grammar: 'present', tokens: [tok('Me', 97), tok('mudo', 6)] }, lemmaOf);
    expect(r).toMatchObject({ lemma: 'mudar', person: 'yo', tokenIndex: 1 });
    expect(findSentenceVerb({ grammar: 'present', tokens: [tok('Adiós', 96)] }, lemmaOf)).toBeNull();
  });
});
