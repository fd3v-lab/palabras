import { describe, expect, it } from 'vitest';
import { damerauLevenshtein, diffWords, gradeSentence, gradeWord, normalize, stripAccents } from './grade';

describe('normalize', () => {
  it('trims, lowercases, collapses whitespace and strips punctuation', () => {
    expect(normalize('  ¿Cómo   estás?! ')).toBe('cómo estás');
    expect(normalize('Hola, mundo.')).toBe('hola mundo');
  });
});

describe('stripAccents', () => {
  it('removes vowel accents but keeps ñ distinct from n', () => {
    expect(stripAccents('á é í ó ú ü')).toBe('a e i o u u');
    expect(stripAccents('año')).toBe('año');
    expect(stripAccents('año') === 'ano').toBe(false);
  });
});

describe('damerauLevenshtein', () => {
  it('is 0 for identical strings', () => {
    expect(damerauLevenshtein('casa', 'casa')).toBe(0);
  });
  it('counts a single substitution as 1', () => {
    expect(damerauLevenshtein('casa', 'casp')).toBe(1);
  });
  it('counts a transposition as 1', () => {
    expect(damerauLevenshtein('casa', 'csaa')).toBe(1);
  });
  it('counts an insertion as 1', () => {
    expect(damerauLevenshtein('casa', 'casas')).toBe(1);
  });
});

describe('gradeWord', () => {
  it('grades an exact match as correct/good', () => {
    const r = gradeWord('la casa', 'la casa', []);
    expect(r.outcome).toBe('correct');
    expect(r.grade).toBe('good');
  });

  it('is case and whitespace insensitive for exact matches', () => {
    const r = gradeWord('  LA   CASA  ', 'la casa', []);
    expect(r.outcome).toBe('correct');
  });

  it('accepts a synonym from the accept list as correct', () => {
    const r = gradeWord('el ordenador', 'la computadora', ['el ordenador']);
    expect(r.outcome).toBe('correct');
  });

  it('grades an accent-only mismatch as accent/good', () => {
    const r = gradeWord('camion', 'camión', []);
    expect(r.outcome).toBe('accent');
    expect(r.grade).toBe('good');
  });

  it('does not conflate ñ with n for the accent outcome', () => {
    const r = gradeWord('ano', 'año', []);
    expect(r.outcome).not.toBe('accent');
  });

  it('detects a missing article as article-missing/hard', () => {
    const r = gradeWord('casa', 'la casa', []);
    expect(r.outcome).toBe('article-missing');
    expect(r.grade).toBe('hard');
    expect(r.note).toContain('la casa');
  });

  it('detects the wrong article as article-wrong/again', () => {
    const r = gradeWord('el casa', 'la casa', []);
    expect(r.outcome).toBe('article-wrong');
    expect(r.grade).toBe('again');
    expect(r.note).toMatch(/feminine/);
  });

  it('does not apply article logic to non-noun / non-articled canonical answers', () => {
    const r = gradeWord('come', 'comer', []);
    expect(r.outcome).not.toBe('article-missing');
    expect(r.outcome).not.toBe('article-wrong');
  });

  it('detects a 1-edit typo for words >= 4 chars as typo/hard', () => {
    const r = gradeWord('grasias', 'gracias', []);
    expect(r.outcome).toBe('typo');
    expect(r.grade).toBe('hard');
  });

  it('does not apply the typo outcome to short (<4 char) words', () => {
    // "si" vs "sí" is an accent case, not typo; use a genuinely different short pair
    const r = gradeWord('vet', 'ver', []);
    expect(r.outcome).toBe('wrong');
  });

  it('grades everything else as wrong/again', () => {
    const r = gradeWord('perro', 'gato', []);
    expect(r.outcome).toBe('wrong');
    expect(r.grade).toBe('again');
  });
});

describe('gradeSentence', () => {
  it('grades an exact canonical match as correct', () => {
    const r = gradeSentence('Tengo dos hermanos.', 'Tengo dos hermanos.', []);
    expect(r.outcome).toBe('correct');
  });

  it('accepts an alt translation as correct', () => {
    const r = gradeSentence('Yo tengo dos hermanos.', 'Tengo dos hermanos.', ['Yo tengo dos hermanos.']);
    expect(r.outcome).toBe('correct');
  });

  it('grades an accent-only mismatch as accent', () => {
    const r = gradeSentence('El esta bien.', 'El está bien.', []);
    expect(r.outcome).toBe('accent');
  });

  it('grades a small typo within the distance budget as typo/hard', () => {
    const r = gradeSentence('Tengo dos hermano.', 'Tengo dos hermanos.', []);
    expect(r.outcome).toBe('typo');
    expect(r.grade).toBe('hard');
  });

  it('grades a very different sentence as wrong', () => {
    const r = gradeSentence('No sé nada de esto hoy.', 'Tengo dos hermanos.', []);
    expect(r.outcome).toBe('wrong');
  });

  it('returns a word-level diff', () => {
    const r = gradeSentence('Tengo tres hermanos.', 'Tengo dos hermanos.', []);
    expect(r.diff).toBeDefined();
  });
});

describe('diffWords', () => {
  it('marks matching words ok and mismatches as extra/missing', () => {
    const diff = diffWords('tengo tres hermanos', 'tengo dos hermanos');
    expect(diff.find((d) => d.text === 'tengo')?.kind).toBe('ok');
    expect(diff.some((d) => d.kind === 'extra' && d.text === 'tres')).toBe(true);
    expect(diff.some((d) => d.kind === 'missing' && d.text === 'dos')).toBe(true);
    expect(diff.find((d) => d.text === 'hermanos')?.kind).toBe('ok');
  });
});
