import { describe, expect, it } from 'vitest';
import { normalizeSpoken, numberToSpanish } from './spoken';
import { gradeWord } from './grade';
import { Endpointer, resample, rms } from './audio';

describe('normalizeSpoken', () => {
  it('lowercases and strips punctuation', () => {
    expect(normalizeSpoken('¡Hola, Buenos Días!')).toBe('hola buenos días');
  });
  it('maps digits to Spanish words', () => {
    expect(normalizeSpoken('Tengo 3 gatos.')).toBe('tengo tres gatos');
    expect(normalizeSpoken('Tengo 20 años')).toBe('tengo veinte años');
    expect(normalizeSpoken('Tiene 45 años')).toBe('tiene cuarenta y cinco años');
    expect(numberToSpanish(0)).toBe('cero');
    expect(numberToSpanish(21)).toBe('veintiuno');
    expect(numberToSpanish(90)).toBe('noventa');
    expect(numberToSpanish(100)).toBeNull();
  });
  it('accent differences still count as correct', () => {
    expect(gradeWord(normalizeSpoken('Cafe.'), 'el café', ['café']).outcome).toBe('accent');
    expect(gradeWord(normalizeSpoken('El café.'), 'el café').outcome).toBe('correct');
  });
});

describe('audio helpers', () => {
  it('resamples 48k to 16k', () => {
    const out = resample(new Float32Array(4800).fill(0.5), 48000);
    expect(out.length).toBe(1600);
    expect(out[10]).toBeCloseTo(0.5);
  });
  it('rms', () => {
    expect(rms(new Float32Array([1, -1, 1, -1]))).toBeCloseTo(1);
  });
  it('endpointer stops after silence following speech, or at max', () => {
    const e = new Endpointer({ silenceMs: 1000, maxMs: 8000, noSpeechMs: 5000, threshold: 0.01 });
    expect(e.update(0.1, 500)).toBe(false);
    expect(e.update(0, 500)).toBe(false);
    expect(e.update(0, 500)).toBe(true);
    const f = new Endpointer({ silenceMs: 1000, maxMs: 2000, noSpeechMs: 5000, threshold: 0.01 });
    f.update(0.1, 1000);
    expect(f.update(0.1, 1000)).toBe(true);
  });
});
