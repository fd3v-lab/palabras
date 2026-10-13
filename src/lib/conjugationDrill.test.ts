import { describe, expect, it } from 'vitest';
import { buildRows, checkRow, checkRows, shouldDrill, updateState, stateId, irregularPresentPersons, shouldInsertWordDrill } from './conjugationDrill';

describe('buildRows', () => {
  it('builds 5 rows without vosotros, 6 with', () => {
    expect(buildRows('tener', 'present', false)!.map((r) => r.person)).toEqual(['yo', 'tu', 'el', 'nosotros', 'ellos']);
    const six = buildRows('tener', 'present', true)!;
    expect(six).toHaveLength(6);
    expect(six[0].answer).toBe('tengo');
    expect(six[4].person).toBe('vosotros');
  });
  it('works for all non-imperative tenses', () => {
    for (const t of ['present', 'preterite', 'imperfect', 'future', 'conditional', 'subjunctive', 'perfect', 'near-future'] as const) {
      expect(buildRows('hablar', t, true)).toHaveLength(6);
    }
  });
  it('imperative has no yo and its own labels', () => {
    const rows = buildRows('hablar', 'imperative', true)!;
    expect(rows.map((r) => r.person)).toEqual(['tu', 'el', 'nosotros', 'vosotros', 'ellos']);
    expect(rows[0].label).toBe('you (tú)');
    expect(rows[0].answer).toBe('habla');
    expect(buildRows('hablar', 'imperative', false)).toHaveLength(4);
  });
  it('perfect and near-future are full forms', () => {
    expect(buildRows('tener', 'perfect', false)![0].answer).toBe('he tenido');
    expect(buildRows('tener', 'near-future', false)![0].answer).toBe('voy a tener');
  });
  it('null for unknown verb', () => {
    expect(buildRows('mesa', 'present', false)).toBeNull();
  });
});

describe('checkRow', () => {
  it('exact, accent-only and wrong', () => {
    expect(checkRow('tengo', 'tengo')).toEqual({ status: 'correct', ok: true });
    expect(checkRow('habló', 'habló').ok).toBe(true);
    expect(checkRow('hablo', 'habló')).toEqual({ status: 'accent', ok: true });
    expect(checkRow('hable', 'hablo').ok).toBe(false);
    expect(checkRow('', 'hablo').ok).toBe(false);
  });
  it('checkRows maps rows', () => {
    const rows = buildRows('tener', 'perfect', false)!;
    const res = checkRows(rows, ['he tenido', 'has tenido', 'x', '', 'han tenido']);
    expect(res.map((r) => r.ok)).toEqual([true, true, false, false, true]);
  });
});

describe('shouldDrill / updateState', () => {
  const st = (perfect: number) => ({ id: 'a|present', seen: 3, perfect, lastSeen: 0, lastScore: 1 });
  it('skip rule', () => {
    expect(shouldDrill('always', st(5))).toBe(true);
    expect(shouldDrill('off', undefined)).toBe(false);
    expect(shouldDrill('new', undefined)).toBe(true);
    expect(shouldDrill('new', st(1))).toBe(true);
    expect(shouldDrill('new', st(2))).toBe(false);
  });
  it('updateState counts perfect only for all-correct', () => {
    const id = stateId('tener', 'present');
    expect(id).toBe('tener|present');
    const a = updateState(undefined, id, 5, 5, 10);
    expect(a).toMatchObject({ seen: 1, perfect: 1, lastScore: 1 });
    const b = updateState(a, id, 3, 5, 20);
    expect(b).toMatchObject({ seen: 2, perfect: 1, lastScore: 0.6 });
  });
});

describe('irregularPresentPersons', () => {
  it('flags irregular forms of tener', () => {
    expect([...irregularPresentPersons('tener')].sort()).toEqual(['ellos', 'el', 'tu', 'yo'].sort());
  });
  it('flags nothing for regular hablar', () => {
    expect(irregularPresentPersons('hablar').size).toBe(0);
  });
  it('handles reflexive and unknown verbs', () => {
    expect(irregularPresentPersons('lavarse').size).toBe(0);
    expect(irregularPresentPersons('zzz').size).toBe(0);
  });
});

describe('shouldInsertWordDrill', () => {
  it('only for verbs with a table, once per lemma|present', () => {
    expect(shouldInsertWordDrill('verb', 'tener', new Set())).toBe(true);
    expect(shouldInsertWordDrill('verb', 'tener', new Set(['tener|present']))).toBe(false);
    expect(shouldInsertWordDrill('verb', 'tener', new Set(['tener|preterite']))).toBe(true);
    expect(shouldInsertWordDrill('noun', 'tener', new Set())).toBe(false);
    expect(shouldInsertWordDrill('verb', 'zzz', new Set())).toBe(false);
  });
});
