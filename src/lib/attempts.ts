// Pure multi-try attempt logic. No side effects.
import { diffWords, type DiffToken, type Grade, type GradeResult } from './grade';

export const DEFAULT_MAX_TRIES = 3;

export type AttemptStep =
  | {
      kind: 'retry';
      /** Misses so far, including this one. */
      misses: number;
      triesLeft: number;
      /** Specific nudge (shown after the 1st miss, if any). */
      nudge?: string;
      /** Hint (shown from the 2nd miss on). */
      hint?: string;
      hintDiff?: DiffToken[];
    }
  | {
      kind: 'finished';
      grade: Grade;
      /** Number of attempts used (1-based). */
      tries: number;
      /** True when the answer was not found and is revealed. */
      revealed: boolean;
      result: GradeResult;
    };

export function clampMaxTries(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_MAX_TRIES;
  return Math.min(5, Math.max(1, Math.round(n)));
}

/** Nudge text that does not leak the answer. */
export function nudgeFor(result: GradeResult): string | undefined {
  switch (result.outcome) {
    case 'article-missing':
      return 'Include the article';
    case 'article-wrong':
      return 'Check the gender';
    case 'typo':
      return 'Almost — check spelling';
    default:
      return undefined;
  }
}

/** `la casa` -> `l_ c___` (first letter of each word, length pattern). */
export function wordHint(canonical: string): string {
  return canonical
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0] + '_'.repeat(Math.max(0, w.length - 1)))
    .join(' ');
}

/** Word-level markers of the typed words; correct words are never revealed
 *  (missing words are shown as `___`). */
export function sentenceHintDiff(input: string, matched: string): DiffToken[] {
  return diffWords(input, matched).map((t) =>
    t.kind === 'missing' ? { kind: 'missing' as const, text: '___' } : t,
  );
}

/**
 * Decide what happens after an attempt.
 * `missesBefore` = number of wrong attempts already made on this card.
 */
export function evaluateAttempt(
  result: GradeResult,
  missesBefore: number,
  maxTries: number,
  opts: { isSentence?: boolean; canonical?: string; input?: string } = {},
): AttemptStep {
  const max = clampMaxTries(maxTries);
  const tries = missesBefore + 1;

  if (result.outcome === 'correct' || result.outcome === 'accent') {
    return { kind: 'finished', grade: tries === 1 ? 'good' : 'hard', tries, revealed: false, result };
  }

  const misses = missesBefore + 1;
  if (misses >= max) {
    return { kind: 'finished', grade: 'again', tries, revealed: true, result: { ...result, grade: 'again' } };
  }

  const step: AttemptStep = { kind: 'retry', misses, triesLeft: max - misses };
  if (misses === 1) step.nudge = nudgeFor(result);
  if (misses >= 2) {
    const nudge = nudgeFor(result);
    if (nudge) step.nudge = nudge;
    if (opts.isSentence) {
      step.hintDiff = sentenceHintDiff(opts.input ?? '', result.matched ?? opts.canonical ?? '');
    } else {
      step.hint = wordHint(opts.canonical ?? result.matched ?? '');
    }
  }
  return step;
}

/** Grade for an immediate reveal ("Don't know"). */
export function dontKnowResult(canonical: string): GradeResult {
  return { outcome: 'wrong', grade: 'again', matched: canonical };
}
