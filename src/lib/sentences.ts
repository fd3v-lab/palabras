// Sentence eligibility, scoring and selection. Pure functions, no I/O.
import type { WordState } from './srs';

export interface SentenceToken {
  t: string;
  id: number | null;
  gloss: string;
  form?: string;
}

export interface SentenceContent {
  id: string;
  en: string;
  es: string;
  alt: string[];
  stage: number;
  grammar: string;
  tokens: SentenceToken[];
}

export interface SentenceState {
  id: string;
  seen: number;
  correct: number;
  lastSeen: number; // ms timestamp, 0 = never
  userAccepted: string[];
}

export const MASTERY_THRESHOLD_PER_STAGE = 15;
export const RECENTLY_SEEN_DAYS = 5;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function createSentenceState(id: string): SentenceState {
  return { id, seen: 0, correct: 0, lastSeen: 0, userAccepted: [] };
}

function isTokenKnown(token: SentenceToken, wordStates: Map<number, WordState>, todayNewIds: Set<number>): boolean {
  if (token.id === null) return true; // proper names count as known
  if (todayNewIds.has(token.id)) return true;
  const st = wordStates.get(token.id);
  return st?.introduced === true;
}

export function isEligible(
  sentence: SentenceContent,
  wordStates: Map<number, WordState>,
  todayNewIds: Set<number>,
): boolean {
  let unknownCount = 0;
  for (const tok of sentence.tokens) {
    const known = isTokenKnown(tok, wordStates, todayNewIds);
    if (!known) {
      unknownCount++;
    }
  }
  if (unknownCount > 2) return false;
  return true;
}

/** Lowest stage with fewer than MASTERY_THRESHOLD_PER_STAGE sentences answered correctly. */
export function computeUnlockedStage(
  allSentences: SentenceContent[],
  sentenceStates: Map<string, SentenceState>,
): number {
  const stages = [...new Set(allSentences.map((s) => s.stage))].sort((a, b) => a - b);
  if (stages.length === 0) return 1;

  const correctByStage = new Map<number, number>();
  for (const s of allSentences) {
    const st = sentenceStates.get(s.id);
    if (st && st.correct > 0) {
      correctByStage.set(s.stage, (correctByStage.get(s.stage) ?? 0) + 1);
    }
  }

  for (const stage of stages) {
    const correct = correctByStage.get(stage) ?? 0;
    if (correct < MASTERY_THRESHOLD_PER_STAGE) return stage;
  }
  return stages[stages.length - 1];
}

export interface ScoreOptions {
  now?: number;
  rand?: () => number;
}

export function scoreSentence(
  sentence: SentenceContent,
  wordStates: Map<number, WordState>,
  sentenceState: SentenceState | undefined,
  todayNewIds: Set<number>,
  options: ScoreOptions = {},
): number {
  const now = options.now ?? Date.now();
  const rand = options.rand ?? Math.random;

  let score = 0;
  for (const tok of sentence.tokens) {
    if (tok.id === null) continue;
    if (todayNewIds.has(tok.id)) {
      score += 3;
      continue;
    }
    const st = wordStates.get(tok.id);
    if (!st?.introduced) {
      score -= 2;
      continue;
    }
    if (st.interval < 7) {
      score += 1;
    }
  }

  if (sentenceState) {
    if (sentenceState.lastSeen > 0 && now - sentenceState.lastSeen < RECENTLY_SEEN_DAYS * MS_PER_DAY) {
      score -= 10;
    }
    score -= sentenceState.correct;
  }

  score += rand() * 0.5;
  return score;
}

export interface SelectSentencesOptions {
  now?: number;
  rand?: () => number;
}

export function selectSentences(
  allSentences: SentenceContent[],
  wordStates: Map<number, WordState>,
  sentenceStates: Map<string, SentenceState>,
  todayNewIds: Set<number>,
  count: number,
  options: SelectSentencesOptions = {},
): SentenceContent[] {
  const unlockedStage = computeUnlockedStage(allSentences, sentenceStates);

  const candidates = allSentences.filter((s) => {
    if (s.stage > unlockedStage + 1) return false;
    return isEligible(s, wordStates, todayNewIds);
  });

  // Prefer stages <= unlockedStage over the one bonus stage above it, but both
  // are eligible; scoring naturally favors easier / more relevant sentences.
  const scored = candidates.map((s) => ({
    sentence: s,
    score: scoreSentence(s, wordStates, sentenceStates.get(s.id), todayNewIds, options),
    inUnlocked: s.stage <= unlockedStage,
  }));

  scored.sort((a, b) => {
    if (a.inUnlocked !== b.inUnlocked) return a.inUnlocked ? -1 : 1;
    return b.score - a.score;
  });

  const picked: SentenceContent[] = [];
  const usedGrammar = new Set<string>();

  // First pass: distinct grammar where possible.
  for (const c of scored) {
    if (picked.length >= count) break;
    if (!usedGrammar.has(c.sentence.grammar)) {
      picked.push(c.sentence);
      usedGrammar.add(c.sentence.grammar);
    }
  }

  // Second pass: fill remaining slots regardless of grammar repetition.
  if (picked.length < count) {
    for (const c of scored) {
      if (picked.length >= count) break;
      if (!picked.includes(c.sentence)) {
        picked.push(c.sentence);
      }
    }
  }

  return picked;
}
