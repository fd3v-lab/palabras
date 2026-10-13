// Session builder: mixes new + review word cards, handles re-queueing of
// failed cards and tracks which attempt is the "first" (SRS-affecting) one.
// Pure functions/state only — no storage, no DOM.
import type { Grade } from './grade';
import type { WordState } from './srs';

export interface SessionSettings {
  newPerSession: number;
  reviewsPerSession: number;
  sentencesPerSession: number;
}

export const DEFAULT_SETTINGS: SessionSettings = {
  newPerSession: 10,
  reviewsPerSession: 20,
  sentencesPerSession: 3,
};

export interface WordContent {
  id: number;
  order: number;
}

export type CardType = 'intro' | 'quiz';

export interface WordCard {
  type: CardType;
  wordId: number;
  isNew: boolean;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function isSameDay(aMs: number, bMs: number): boolean {
  if (!aMs) return false;
  const a = new Date(aMs);
  const b = new Date(bMs);
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// ---- word/review selection ----

export function selectNewWords(
  words: WordContent[],
  wordStates: Map<number, WordState>,
  newPerSession: number,
): number[] {
  const sorted = [...words].sort((a, b) => a.order - b.order || a.id - b.id);
  const result: number[] = [];
  for (const w of sorted) {
    const st = wordStates.get(w.id);
    if (!st?.introduced) {
      result.push(w.id);
      if (result.length >= newPerSession) break;
    }
  }
  return result;
}

export function selectReviewWords(
  wordStates: Map<number, WordState>,
  reviewsPerSession: number,
  now: number = Date.now(),
  excludeIds: ReadonlySet<number> = new Set(),
): number[] {
  const introduced = [...wordStates.values()].filter((s) => s.introduced && !excludeIds.has(s.id));
  if (introduced.length === 0) return [];

  const due = introduced.filter((s) => s.due <= now).sort((a, b) => a.due - b.due);
  const result = due.slice(0, reviewsPerSession).map((s) => s.id);

  if (result.length < reviewsPerSession) {
    const already = new Set(result);
    const notSeenToday = introduced
      .filter((s) => !already.has(s.id) && !isSameDay(s.lastSeen, now))
      .sort((a, b) => a.interval - b.interval);
    for (const s of notSeenToday) {
      if (result.length >= reviewsPerSession) break;
      result.push(s.id);
    }
  }

  return result;
}

// ---- queue construction ----

function interleaveTags(newCount: number, reviewCount: number, rand: () => number): ('new' | 'review')[] {
  const tags: ('new' | 'review')[] = [];
  let newLeft = newCount;
  let reviewLeft = reviewCount;
  while (newLeft > 0 || reviewLeft > 0) {
    const remaining = newLeft + reviewLeft;
    const pickNew = newLeft > 0 && (reviewLeft === 0 || rand() < newLeft / remaining);
    if (pickNew) {
      tags.push('new');
      newLeft--;
    } else {
      tags.push('review');
      reviewLeft--;
    }
  }
  return tags;
}

/** Builds the initial word-phase card queue: intros + review quizzes interleaved,
 *  with each new word's quiz card appearing 2-4 cards after ITS OWN intro.
 *  New words and reviews are kept disjoint even if the caller's lists overlap.
 *
 *  Built as a single forward scan: each intro schedules its own quiz for a
 *  fixed future queue length (`dueAtLength`), decided once and never revised.
 *  This avoids the two-pass splice approach's failure modes — an offset that
 *  grows with each intro, or a later insertion retroactively shifting an
 *  earlier one's already-placed quiz out of its 2-4 window. */
export function buildWordQueue(
  newWordIds: number[],
  reviewWordIds: number[],
  rand: () => number = Math.random,
): WordCard[] {
  const newSet = new Set(newWordIds);
  const dedupedReviewIds = reviewWordIds.filter((id) => !newSet.has(id));
  const tags = interleaveTags(newWordIds.length, dedupedReviewIds.length, rand);

  const queue: WordCard[] = [];
  let ni = 0;
  let ri = 0;
  const pending: { wordId: number; dueAtLength: number }[] = [];

  function flushDue() {
    // Emit any pending quizzes whose scheduled length has been reached.
    for (let i = 0; i < pending.length; ) {
      if (queue.length >= pending[i].dueAtLength) {
        const { wordId } = pending.splice(i, 1)[0];
        queue.push({ type: 'quiz', wordId, isNew: true });
        i = 0; // an emission may have just satisfied another pending entry
      } else {
        i++;
      }
    }
  }

  for (const tag of tags) {
    if (tag === 'new') {
      const wordId = newWordIds[ni++];
      queue.push({ type: 'intro', wordId, isNew: true });
      const gap = 2 + Math.floor(rand() * 3); // 2..4
      pending.push({ wordId, dueAtLength: queue.length - 1 + gap });
    } else {
      const wordId = dedupedReviewIds[ri++];
      queue.push({ type: 'quiz', wordId, isNew: false });
    }
    flushDue();
  }

  // Not enough trailing cards remained for these (rare tail edge case) —
  // append them in the order they were scheduled.
  for (const { wordId } of pending) {
    queue.push({ type: 'quiz', wordId, isNew: true });
  }

  return queue;
}

/** Re-queues a card that was graded `again` 3-5 positions later; otherwise
 *  removes it from the front of the queue. */
export function submitWordAnswer(queue: WordCard[], grade: Grade, rand: () => number = Math.random): WordCard[] {
  const [current, ...rest] = queue;
  if (!current) return queue;
  if (grade === 'again') {
    const gap = 2 + Math.floor(rand() * 3); // 3rd-5th upcoming card (0-indexed 2..4)
    const insertPos = Math.min(rest.length, gap);
    const newQueue = [...rest];
    newQueue.splice(insertPos, 0, { ...current });
    return newQueue;
  }
  return rest;
}

// ---- session state wrapper ----

export interface WordSessionState {
  queue: WordCard[];
  firstAttempted: Set<number>;
  introducedIds: Set<number>;
}

export function initWordSession(
  newWordIds: number[],
  reviewWordIds: number[],
  rand: () => number = Math.random,
): WordSessionState {
  return {
    queue: buildWordQueue(newWordIds, reviewWordIds, rand),
    firstAttempted: new Set(),
    introducedIds: new Set(),
  };
}

export function peekCard(state: WordSessionState): WordCard | null {
  return state.queue[0] ?? null;
}

export function isSessionDone(state: WordSessionState): boolean {
  return state.queue.length === 0;
}

/** Call when the learner presses "Got it" on an intro card. */
export function completeIntro(state: WordSessionState): WordSessionState {
  const [current, ...rest] = state.queue;
  if (!current || current.type !== 'intro') return state;
  const introducedIds = new Set(state.introducedIds);
  introducedIds.add(current.wordId);
  return { ...state, queue: rest, introducedIds };
}

export interface SubmitQuizResult {
  state: WordSessionState;
  /** True if this is the first attempt this session for this word — the
   *  caller should apply the SRS grade only when this is true. */
  applySrs: boolean;
}

export function submitQuizAnswer(
  state: WordSessionState,
  grade: Grade,
  rand: () => number = Math.random,
): SubmitQuizResult {
  const current = state.queue[0];
  if (!current || current.type !== 'quiz') {
    throw new Error('submitQuizAnswer called without a quiz card at the front of the queue');
  }
  const applySrs = !state.firstAttempted.has(current.wordId);
  const firstAttempted = new Set(state.firstAttempted);
  if (applySrs) firstAttempted.add(current.wordId);
  const queue = submitWordAnswer(state.queue, grade, rand);
  return { state: { ...state, queue, firstAttempted }, applySrs };
}

// ---- stats helpers ----

export function countDueBy(wordStates: Map<number, WordState>, cutoff: number): number {
  let n = 0;
  for (const s of wordStates.values()) {
    if (s.introduced && s.due <= cutoff) n++;
  }
  return n;
}

/** ms timestamp of local end-of-day (23:59:59.999) for the given moment. */
export function endOfTodayMs(now: number = Date.now()): number {
  const d = new Date(now);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Streak of consecutive days (ending today or yesterday) with a completed session. */
export function computeStreak(sessionDates: number[], now: number = Date.now()): number {
  const daySet = new Set(sessionDates.map(dayKey));
  let cursor = now;
  if (!daySet.has(dayKey(cursor))) {
    cursor -= MS_PER_DAY;
    if (!daySet.has(dayKey(cursor))) return 0;
  }
  let streak = 0;
  while (daySet.has(dayKey(cursor))) {
    streak++;
    cursor -= MS_PER_DAY;
  }
  return streak;
}
