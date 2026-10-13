import { describe, expect, it } from 'vitest';
import {
  MASTERED_INTERVAL_DAYS,
  MIN_EASE,
  STARTING_EASE,
  applyGrade,
  createWordState,
  fuzz,
  isKnown,
  isMastered,
  markIntroduced,
} from './srs';

const NOW = 1_700_000_000_000;

describe('createWordState', () => {
  it('starts fresh: not introduced, ease 2.5, interval 0', () => {
    const s = createWordState(1, NOW);
    expect(s.introduced).toBe(false);
    expect(s.ease).toBe(STARTING_EASE);
    expect(s.interval).toBe(0);
    expect(s.reps).toBe(0);
    expect(s.lapses).toBe(0);
    expect(s.history).toEqual([]);
  });
});

describe('applyGrade — again', () => {
  it('increments lapses, resets interval to 0, drops ease by 0.2, due in 10 minutes', () => {
    const s = createWordState(1, NOW);
    const next = applyGrade(s, 'again', { now: NOW });
    expect(next.lapses).toBe(1);
    expect(next.interval).toBe(0);
    expect(next.ease).toBeCloseTo(STARTING_EASE - 0.2);
    expect(next.due).toBe(NOW + 10 * 60 * 1000);
  });

  it('never drops ease below the minimum', () => {
    let s = createWordState(1, NOW);
    for (let i = 0; i < 20; i++) {
      s = applyGrade(s, 'again', { now: NOW });
    }
    expect(s.ease).toBeGreaterThanOrEqual(MIN_EASE);
  });
});

describe('applyGrade — hard', () => {
  it('grows interval by 1.2x (min 1) and drops ease by 0.15', () => {
    const s = { ...createWordState(1, NOW), interval: 5 };
    const next = applyGrade(s, 'hard', { now: NOW, rand: () => 0.5 });
    expect(next.interval).toBeCloseTo(6);
    expect(next.ease).toBeCloseTo(STARTING_EASE - 0.15);
  });

  it('floors interval at 1 day when starting from 0', () => {
    const s = createWordState(1, NOW);
    const next = applyGrade(s, 'hard', { now: NOW, rand: () => 0.5 });
    expect(next.interval).toBeGreaterThanOrEqual(1);
  });
});

describe('applyGrade — good', () => {
  it('goes 0 -> 1 -> 3 -> round(interval*ease)', () => {
    let s = createWordState(1, NOW);
    s = applyGrade(s, 'good', { now: NOW, rand: () => 0.5 });
    expect(s.interval).toBe(1);

    s = applyGrade(s, 'good', { now: NOW, rand: () => 0.5 });
    expect(s.interval).toBe(3);

    s = applyGrade(s, 'good', { now: NOW, rand: () => 0.5 });
    expect(s.interval).toBe(Math.round(3 * s.ease));
  });

  it('leaves ease unchanged', () => {
    const s = createWordState(1, NOW);
    const next = applyGrade(s, 'good', { now: NOW });
    expect(next.ease).toBe(s.ease);
  });

  it('a new word answered correctly on its first quiz gets interval 1', () => {
    const s = createWordState(1, NOW);
    const next = applyGrade(s, 'good', { now: NOW });
    expect(next.interval).toBe(1);
  });
});

describe('fuzz', () => {
  it('leaves intervals under 3 days unchanged', () => {
    expect(fuzz(1, () => 0)).toBe(1);
    expect(fuzz(2.9, () => 1)).toBe(2.9);
  });

  it('applies up to +-10% fuzz for intervals >= 3 days', () => {
    expect(fuzz(10, () => 0)).toBeCloseTo(9);
    expect(fuzz(10, () => 1)).toBeCloseTo(11);
    expect(fuzz(10, () => 0.5)).toBeCloseTo(10);
  });
});

describe('history', () => {
  it('keeps only the last 10 grades', () => {
    let s = createWordState(1, NOW);
    for (let i = 0; i < 15; i++) {
      s = applyGrade(s, 'good', { now: NOW });
    }
    expect(s.history.length).toBe(10);
  });
});

describe('isKnown / isMastered', () => {
  it('a word is known once introduced', () => {
    const s = markIntroduced(createWordState(1, NOW), NOW);
    expect(isKnown(s)).toBe(true);
  });

  it('a word is mastered once interval >= 21', () => {
    const s = { ...createWordState(1, NOW), interval: MASTERED_INTERVAL_DAYS };
    expect(isMastered(s)).toBe(true);
    const s2 = { ...createWordState(1, NOW), interval: MASTERED_INTERVAL_DAYS - 1 };
    expect(isMastered(s2)).toBe(false);
  });
});
