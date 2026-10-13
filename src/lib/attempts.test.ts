import { describe, expect, it } from 'vitest';
import { evaluateAttempt, wordHint, sentenceHintDiff, clampMaxTries } from './attempts';
import { gradeWord } from './grade';

const wrong = gradeWord('xyz', 'la casa');

describe('evaluateAttempt', () => {
  it('correct on try 1 is good', () => {
    const s = evaluateAttempt(gradeWord('la casa', 'la casa'), 0, 3);
    expect(s).toMatchObject({ kind: 'finished', grade: 'good', tries: 1 });
  });
  it('correct on try 2 or 3 is hard', () => {
    expect(evaluateAttempt(gradeWord('la casa', 'la casa'), 1, 3)).toMatchObject({ kind: 'finished', grade: 'hard' });
    expect(evaluateAttempt(gradeWord('la casa', 'la casa'), 2, 3)).toMatchObject({ kind: 'finished', grade: 'hard' });
  });
  it('accent counts as correct immediately', () => {
    const r = gradeWord('el cafe', 'el café');
    expect(r.outcome).toBe('accent');
    expect(evaluateAttempt(r, 0, 3)).toMatchObject({ kind: 'finished', grade: 'good', revealed: false });
  });
  it('1st miss retries with nudge, no answer leak', () => {
    const s = evaluateAttempt(gradeWord('casa', 'la casa'), 0, 3, { canonical: 'la casa' });
    expect(s).toMatchObject({ kind: 'retry', triesLeft: 2, nudge: 'Include the article' });
    expect(JSON.stringify(s)).not.toContain('la casa');
  });
  it('nudges for gender and typo', () => {
    expect(evaluateAttempt(gradeWord('el casa', 'la casa'), 0, 3)).toMatchObject({ nudge: 'Check the gender' });
    expect(evaluateAttempt(gradeWord('la casz', 'la casa'), 0, 3)).toMatchObject({ nudge: 'Almost — check spelling' });
  });
  it('2nd miss gives a hint', () => {
    const s = evaluateAttempt(wrong, 1, 3, { canonical: 'la casa' });
    expect(s).toMatchObject({ kind: 'retry', triesLeft: 1, hint: 'l_ c___' });
  });
  it('3rd miss reveals and grades again', () => {
    const s = evaluateAttempt(gradeWord('casa', 'la casa'), 2, 3);
    expect(s).toMatchObject({ kind: 'finished', grade: 'again', revealed: true });
  });
  it('maxTries 1 reveals at once', () => {
    expect(evaluateAttempt(wrong, 0, 1)).toMatchObject({ kind: 'finished', grade: 'again', revealed: true });
  });
  it('sentence hint marks words without revealing', () => {
    const d = sentenceHintDiff('yo tengo gato', 'yo tengo un gato');
    expect(d.map((t) => t.kind)).toEqual(['ok', 'ok', 'missing', 'ok']);
    expect(d.some((t) => t.text === 'un')).toBe(false);
    const s = evaluateAttempt(wrong, 1, 3, { isSentence: true, input: 'yo tengo gato', canonical: 'yo tengo un gato' });
    expect(s).toMatchObject({ kind: 'retry' });
    expect((s as { hintDiff?: unknown }).hintDiff).toBeTruthy();
  });
  it('wordHint and clamp', () => {
    expect(wordHint('la casa')).toBe('l_ c___');
    expect(clampMaxTries(9)).toBe(5);
    expect(clampMaxTries(0)).toBe(1);
  });
});
