// Simplified SM-2 spaced repetition. Pure functions, no I/O.
import type { Grade } from './grade';

export interface WordState {
  id: number;
  introduced: boolean;
  reps: number;
  lapses: number;
  ease: number;
  interval: number; // days
  due: number; // ms timestamp
  lastSeen: number; // ms timestamp
  history: Grade[]; // last 10 grades, most recent last
  userAccepted: string[]; // answers accepted via "I was right" override
}

export const STARTING_EASE = 2.5;
export const MIN_EASE = 1.3;
export const MASTERED_INTERVAL_DAYS = 21;
export const AGAIN_DUE_MS = 10 * 60 * 1000;
export const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const HISTORY_LIMIT = 10;

export function createWordState(id: number, now: number = Date.now()): WordState {
  return {
    id,
    introduced: false,
    reps: 0,
    lapses: 0,
    ease: STARTING_EASE,
    interval: 0,
    due: now,
    lastSeen: 0,
    history: [],
    userAccepted: [],
  };
}

/** Deterministic-friendly fuzz; pass `rand` in tests to control it. Range: -10%..+10%. */
export function fuzz(intervalDays: number, rand: () => number = Math.random): number {
  if (intervalDays < 3) return intervalDays;
  const factor = 1 + (rand() * 2 - 1) * 0.1;
  return intervalDays * factor;
}

export interface ApplyGradeOptions {
  now?: number;
  rand?: () => number;
}

export function applyGrade(state: WordState, grade: Grade, options: ApplyGradeOptions = {}): WordState {
  const now = options.now ?? Date.now();
  const rand = options.rand ?? Math.random;

  const next: WordState = {
    ...state,
    reps: state.reps + 1,
    lastSeen: now,
    history: [...state.history, grade].slice(-HISTORY_LIMIT),
  };

  if (grade === 'again') {
    next.lapses = state.lapses + 1;
    next.interval = 0;
    next.ease = Math.max(MIN_EASE, state.ease - 0.2);
    next.due = now + AGAIN_DUE_MS;
    return next;
  }

  if (grade === 'hard') {
    const rawInterval = Math.max(1, state.interval * 1.2);
    next.ease = Math.max(MIN_EASE, state.ease - 0.15);
    next.interval = rawInterval;
    next.due = now + fuzz(rawInterval, rand) * MS_PER_DAY;
    return next;
  }

  // good
  let rawInterval: number;
  if (state.interval === 0) rawInterval = 1;
  else if (state.interval === 1) rawInterval = 3;
  else rawInterval = Math.round(state.interval * state.ease);
  next.ease = state.ease;
  next.interval = rawInterval;
  next.due = now + fuzz(rawInterval, rand) * MS_PER_DAY;
  return next;
}

export function isKnown(state: WordState): boolean {
  return state.introduced;
}

export function isMastered(state: WordState): boolean {
  return state.interval >= MASTERED_INTERVAL_DAYS;
}

export function markIntroduced(state: WordState, now: number = Date.now()): WordState {
  return { ...state, introduced: true, lastSeen: now };
}
