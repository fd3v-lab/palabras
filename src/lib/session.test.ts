import { describe, expect, it } from 'vitest';
import {
  buildWordQueue,
  completeIntro,
  computeStreak,
  countDueBy,
  endOfTodayMs,
  initWordSession,
  isSessionDone,
  peekCard,
  selectNewWords,
  selectReviewWords,
  submitQuizAnswer,
  submitWordAnswer,
  type WordContent,
} from './session';
import { createWordState, type WordState } from './srs';

const NOW = 1_700_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

function stateMap(states: WordState[]): Map<number, WordState> {
  return new Map(states.map((s) => [s.id, s]));
}

describe('selectNewWords', () => {
  it('picks the next N not-yet-introduced words in learn order', () => {
    const words: WordContent[] = [
      { id: 3, order: 3 },
      { id: 1, order: 1 },
      { id: 2, order: 2 },
      { id: 4, order: 4 },
    ];
    const states = stateMap([{ ...createWordState(1, NOW), introduced: true }]);
    const picked = selectNewWords(words, states, 2);
    expect(picked).toEqual([2, 3]);
  });

  it('breaks order ties by id', () => {
    const words: WordContent[] = [
      { id: 20, order: 5 },
      { id: 10, order: 5 },
    ];
    const picked = selectNewWords(words, new Map(), 2);
    expect(picked).toEqual([10, 20]);
  });
});

describe('selectReviewWords', () => {
  it('returns nothing when no word is introduced yet', () => {
    const states = stateMap([createWordState(1, NOW)]);
    expect(selectReviewWords(states, 20, NOW)).toEqual([]);
  });

  it('prioritizes the most overdue due words first', () => {
    const a = { ...createWordState(1, NOW), introduced: true, due: NOW - 5000 };
    const b = { ...createWordState(2, NOW), introduced: true, due: NOW - 50000 };
    const c = { ...createWordState(3, NOW), introduced: true, due: NOW + 100000 };
    const picked = selectReviewWords(stateMap([a, b, c]), 2, NOW);
    expect(picked).toEqual([2, 1]);
  });

  it('fills remaining slots with the lowest-interval words not seen today', () => {
    const due = { ...createWordState(1, NOW), introduced: true, due: NOW - 1000, interval: 5 };
    const lowInterval = { ...createWordState(2, NOW), introduced: true, due: NOW + 99999, interval: 1, lastSeen: 0 };
    const highInterval = { ...createWordState(3, NOW), introduced: true, due: NOW + 99999, interval: 10, lastSeen: 0 };
    const seenToday = { ...createWordState(4, NOW), introduced: true, due: NOW + 99999, interval: 0.5, lastSeen: NOW };
    const picked = selectReviewWords(stateMap([due, lowInterval, highInterval, seenToday]), 3, NOW);
    expect(picked).toEqual([1, 2, 3]);
  });

  it('excludes ids in excludeIds (e.g. words introduced this session)', () => {
    const a = { ...createWordState(1, NOW), introduced: true, due: NOW - 5000 };
    const b = { ...createWordState(2, NOW), introduced: true, due: NOW - 1000 };
    const picked = selectReviewWords(stateMap([a, b]), 20, NOW, new Set([1]));
    expect(picked).toEqual([2]);
  });
});

describe('buildWordQueue', () => {
  it('places each new word intro 2-4 cards before its quiz', () => {
    // Force the new word's intro to land first (plenty of trailing review
    // cards so the gap is never clamped by the end of the queue).
    let calls = 0;
    const rand = () => {
      calls++;
      return calls === 1 ? 0 : 0.99;
    };
    const queue = buildWordQueue([101], [201, 202, 203, 204, 205, 206], rand);
    const introIndex = queue.findIndex((c) => c.type === 'intro' && c.wordId === 101);
    const quizIndex = queue.findIndex((c) => c.type === 'quiz' && c.wordId === 101);
    expect(introIndex).toBe(0);
    expect(quizIndex).toBeGreaterThan(introIndex);
    expect(quizIndex - introIndex).toBeGreaterThanOrEqual(2);
    expect(quizIndex - introIndex).toBeLessThanOrEqual(4);
  });

  it('includes every review word as a quiz card and every new word as intro+quiz', () => {
    const queue = buildWordQueue([1, 2], [10, 20, 30], Math.random);
    const reviewQuizzes = queue.filter((c) => c.type === 'quiz' && !c.isNew);
    const newIntros = queue.filter((c) => c.type === 'intro');
    const newQuizzes = queue.filter((c) => c.type === 'quiz' && c.isNew);
    expect(reviewQuizzes.map((c) => c.wordId).sort()).toEqual([10, 20, 30]);
    expect(newIntros.map((c) => c.wordId).sort()).toEqual([1, 2]);
    expect(newQuizzes.map((c) => c.wordId).sort()).toEqual([1, 2]);
  });

  it('does not put all new words in one contiguous block when reviews exist', () => {
    // With many reviews and few new words, a naive concat would put both new
    // intros at the very front; interleaving should not do that.
    const queue = buildWordQueue([1, 2], [10, 20, 30, 40, 50, 60], () => 0.5);
    const firstTwoAreBothNew = queue[0]?.wordId && queue[1]?.wordId && [1, 2].includes(queue[0].wordId) && [1, 2].includes(queue[1].wordId);
    expect(firstTwoAreBothNew).toBeFalsy();
  });

  it('keeps every new word\'s quiz 2-4 cards after ITS OWN intro, for every new word', () => {
    // 10 new words mixed with plenty of reviews (so there's always enough
    // trailing room) — exercise a spread of rand() outputs across the run.
    const newIds = Array.from({ length: 10 }, (_, i) => 1000 + i);
    const reviewIds = Array.from({ length: 30 }, (_, i) => 2000 + i);
    let calls = 0;
    const rand = () => {
      calls++;
      return (calls * 0.37) % 1;
    };
    const queue = buildWordQueue(newIds, reviewIds, rand);

    for (const wordId of newIds) {
      const introIndex = queue.findIndex((c) => c.type === 'intro' && c.wordId === wordId);
      const quizIndex = queue.findIndex((c) => c.type === 'quiz' && c.isNew && c.wordId === wordId);
      expect(introIndex).toBeGreaterThanOrEqual(0);
      expect(quizIndex).toBeGreaterThan(introIndex);
      const gap = quizIndex - introIndex;
      expect(gap).toBeGreaterThanOrEqual(2);
      expect(gap).toBeLessThanOrEqual(4);
    }
  });

  it('keeps new words and reviews disjoint even if the caller passes an overlapping id', () => {
    // wordId 5 appears in both lists (e.g. a stale review pool); it must only
    // ever be queued once, via the "new" path.
    const queue = buildWordQueue([5, 6], [5, 7, 8], () => 0.5);
    const entriesForFive = queue.filter((c) => c.wordId === 5);
    expect(entriesForFive.length).toBe(2); // one intro + one quiz, not two quizzes
    expect(entriesForFive.some((c) => c.type === 'intro')).toBe(true);
    expect(entriesForFive.filter((c) => c.type === 'quiz').length).toBe(1);
    expect(entriesForFive.every((c) => c.isNew)).toBe(true);
  });

  it('produces unique word ids in the queue (apart from a card and its own requeue)', () => {
    const newIds = [1, 2, 3];
    const reviewIds = [10, 11, 12, 13];
    const queue = buildWordQueue(newIds, reviewIds, () => 0.5);
    // Count occurrences per (type, wordId) pair — each should appear exactly once.
    const seen = new Set<string>();
    for (const card of queue) {
      const key = `${card.type}:${card.wordId}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});

describe('submitWordAnswer / re-queue', () => {
  it('re-queues an again card 3-5 positions later', () => {
    const queue = buildWordQueue([], [1, 2, 3, 4, 5, 6, 7], () => 0.5);
    const next = submitWordAnswer(queue, 'again', () => 0.99);
    const newPos = next.findIndex((c) => c.wordId === 1);
    // 0-indexed position among the remaining cards: 3rd-5th upcoming card.
    expect(newPos).toBeGreaterThanOrEqual(2);
    expect(newPos).toBeLessThanOrEqual(4);
  });

  it('removes the card entirely on a non-again grade', () => {
    const queue = buildWordQueue([], [1, 2, 3], () => 0.5);
    const next = submitWordAnswer(queue, 'good');
    expect(next.find((c) => c.wordId === 1)).toBeUndefined();
    expect(next.length).toBe(2);
  });
});

describe('word session state machine', () => {
  it('only the first attempt applies SRS; requeued attempts do not', () => {
    let session = initWordSession([], [1], () => 0.5);
    expect(peekCard(session)?.wordId).toBe(1);

    const first = submitQuizAnswer(session, 'again', () => 0.99);
    expect(first.applySrs).toBe(true);
    session = first.state;
    expect(isSessionDone(session)).toBe(false); // re-queued (only card, so it stays at the front)
    expect(peekCard(session)?.wordId).toBe(1);

    const second = submitQuizAnswer(session, 'good', () => 0.5);
    expect(second.applySrs).toBe(false);
  });

  it('marks a word introduced once its intro card is completed', () => {
    let session = initWordSession([42], [], () => 0.5);
    expect(session.introducedIds.has(42)).toBe(false);
    session = completeIntro(session);
    expect(session.introducedIds.has(42)).toBe(true);
  });
});

describe('countDueBy', () => {
  it('counts introduced words due by the cutoff', () => {
    const states = stateMap([
      { ...createWordState(1, NOW), introduced: true, due: NOW + DAY / 2 },
      { ...createWordState(2, NOW), introduced: true, due: NOW + 2 * DAY },
      { ...createWordState(3, NOW), introduced: false, due: NOW },
    ]);
    expect(countDueBy(states, NOW + DAY)).toBe(1);
  });
});

describe('endOfTodayMs', () => {
  it('returns local 23:59:59.999 for the given moment, same calendar day', () => {
    const noon = new Date(2024, 2, 15, 12, 0, 0, 0).getTime();
    const end = endOfTodayMs(noon);
    const endDate = new Date(end);
    expect(endDate.getFullYear()).toBe(2024);
    expect(endDate.getMonth()).toBe(2);
    expect(endDate.getDate()).toBe(15);
    expect(endDate.getHours()).toBe(23);
    expect(endDate.getMinutes()).toBe(59);
  });

  it('is used with countDueBy to count "due today" as due by local midnight, not just due<=now', () => {
    const noon = new Date(2024, 2, 15, 12, 0, 0, 0).getTime();
    const laterToday = new Date(2024, 2, 15, 20, 0, 0, 0).getTime();
    const states = stateMap([{ ...createWordState(1, noon), introduced: true, due: laterToday }]);
    expect(countDueBy(states, noon)).toBe(0); // not due by a plain "now" cutoff
    expect(countDueBy(states, endOfTodayMs(noon))).toBe(1); // but is due before midnight
  });
});

describe('computeStreak', () => {
  it('is 0 when there is no session today or yesterday', () => {
    expect(computeStreak([NOW - 5 * DAY], NOW)).toBe(0);
  });

  it('counts consecutive days ending today', () => {
    const dates = [NOW, NOW - DAY, NOW - 2 * DAY];
    expect(computeStreak(dates, NOW)).toBe(3);
  });

  it('still counts a streak that ended yesterday', () => {
    const dates = [NOW - DAY, NOW - 2 * DAY];
    expect(computeStreak(dates, NOW)).toBe(2);
  });
});
