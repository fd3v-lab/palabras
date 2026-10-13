import { describe, expect, it } from 'vitest';
import {
  computeUnlockedStage,
  isEligible,
  scoreSentence,
  selectSentences,
  type SentenceContent,
  type SentenceState,
} from './sentences';
import { createWordState, type WordState } from './srs';

const NOW = 1_700_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

function sentence(overrides: Partial<SentenceContent> = {}): SentenceContent {
  return {
    id: 's1',
    en: 'I have two brothers.',
    es: 'Tengo dos hermanos.',
    alt: [],
    stage: 1,
    grammar: 'present',
    tokens: [
      { t: 'Tengo', id: 1, gloss: 'I have' },
      { t: 'dos', id: 2, gloss: 'two' },
      { t: 'hermanos', id: 3, gloss: 'brothers' },
    ],
    ...overrides,
  };
}

function states(list: WordState[]): Map<number, WordState> {
  return new Map(list.map((s) => [s.id, s]));
}

const introduced = (id: number): WordState => ({ ...createWordState(id, NOW), introduced: true });

describe('isEligible', () => {
  it('is eligible when all tokens are known', () => {
    const s = sentence();
    const ws = states([introduced(1), introduced(2), introduced(3)]);
    expect(isEligible(s, ws, new Set())).toBe(true);
  });

  it('counts a new-today word as known', () => {
    const s = sentence();
    const ws = states([introduced(1), introduced(3)]);
    expect(isEligible(s, ws, new Set([2]))).toBe(true);
  });

  it('treats a null-id proper name as known', () => {
    const s = sentence({ tokens: [{ t: 'Ana', id: null, gloss: 'Ana' }, { t: 'dos', id: 2, gloss: 'two' }] });
    const ws = states([introduced(2)]);
    expect(isEligible(s, ws, new Set())).toBe(true);
  });

  it('is eligible with up to 2 unknown tokens', () => {
    const s = sentence();
    const ws = states([introduced(1)]); // 2 and 3 unknown
    expect(isEligible(s, ws, new Set())).toBe(true);
  });

  it('is not eligible with more than 2 unknown tokens', () => {
    const s = sentence({
      tokens: [
        { t: 'a', id: 1, gloss: 'a' },
        { t: 'b', id: 2, gloss: 'b' },
        { t: 'c', id: 3, gloss: 'c' },
        { t: 'd', id: 4, gloss: 'd' },
      ],
    });
    const ws = states([]); // all 4 unknown
    expect(isEligible(s, ws, new Set())).toBe(false);
  });
});

describe('scoreSentence', () => {
  it('rewards new-today tokens and penalizes unknown ones', () => {
    const s = sentence();
    const ws = states([introduced(1), introduced(3)]);
    const score = scoreSentence(s, ws, undefined, new Set([2]), { now: NOW, rand: () => 0 });
    // token 1 known interval 0 -> +1 (interval<7); token 2 new-today -> +3; token 3 known -> +1
    expect(score).toBeCloseTo(5);
  });

  it('penalizes unknown tokens that are neither introduced nor new-today', () => {
    const s = sentence();
    const ws = states([introduced(1), introduced(3)]);
    const score = scoreSentence(s, ws, undefined, new Set(), { now: NOW, rand: () => 0 });
    // token 2 unknown -> -2; tokens 1,3 known interval 0<7 -> +1 each
    expect(score).toBeCloseTo(0);
  });

  it('penalizes a sentence seen within the last 5 days', () => {
    const s = sentence();
    const ws = states([introduced(1), introduced(2), introduced(3)]);
    const recentState: SentenceState = { id: 's1', seen: 1, correct: 0, lastSeen: NOW - DAY, userAccepted: [] };
    const score = scoreSentence(s, ws, recentState, new Set(), { now: NOW, rand: () => 0 });
    expect(score).toBeLessThan(0);
  });

  it('penalizes by how many times it was already answered correctly', () => {
    const s = sentence();
    const ws = states([introduced(1), introduced(2), introduced(3)]);
    const st: SentenceState = { id: 's1', seen: 3, correct: 3, lastSeen: 0, userAccepted: [] };
    const score = scoreSentence(s, ws, st, new Set(), { now: NOW, rand: () => 0 });
    expect(score).toBeCloseTo(3 - 3);
  });
});

describe('computeUnlockedStage', () => {
  it('unlocks the lowest stage with fewer than 15 correct answers', () => {
    const sentences: SentenceContent[] = [
      sentence({ id: 'a', stage: 1 }),
      sentence({ id: 'b', stage: 1 }),
      sentence({ id: 'c', stage: 2 }),
    ];
    const sentStates = new Map<string, SentenceState>([
      ['a', { id: 'a', seen: 1, correct: 1, lastSeen: 0, userAccepted: [] }],
    ]);
    expect(computeUnlockedStage(sentences, sentStates)).toBe(1);
  });

  it('advances once the current stage reaches 15 correct', () => {
    const sentences: SentenceContent[] = Array.from({ length: 16 }, (_, i) => sentence({ id: `s${i}`, stage: 1 }));
    sentences.push(sentence({ id: 'stage2', stage: 2 }));
    const sentStates = new Map<string, SentenceState>(
      sentences.slice(0, 15).map((s) => [s.id, { id: s.id, seen: 1, correct: 1, lastSeen: 0, userAccepted: [] }]),
    );
    expect(computeUnlockedStage(sentences, sentStates)).toBe(2);
  });
});

describe('selectSentences', () => {
  it('excludes sentences from stages above unlockedStage + 1', () => {
    const s1 = sentence({ id: 's1', stage: 1 });
    const s3 = sentence({ id: 's3', stage: 3 });
    const ws = states([introduced(1), introduced(2), introduced(3)]);
    const picked = selectSentences([s1, s3], ws, new Map(), new Set(), 5, { now: NOW, rand: () => 0.1 });
    expect(picked.map((s) => s.id)).toContain('s1');
    expect(picked.map((s) => s.id)).not.toContain('s3');
  });

  it('prefers distinct grammar across the picks when possible', () => {
    const ws = states([introduced(1), introduced(2), introduced(3)]);
    const a = sentence({ id: 'a', grammar: 'present' });
    const b = sentence({ id: 'b', grammar: 'present' });
    const c = sentence({ id: 'c', grammar: 'preterite' });
    const picked = selectSentences([a, b, c], ws, new Map(), new Set(), 2, { now: NOW, rand: () => 0.1 });
    const grammars = new Set(picked.map((s) => s.grammar));
    expect(grammars.size).toBe(2);
  });
});
