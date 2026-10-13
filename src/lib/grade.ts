// Pure answer-checking logic. No side effects, no DOM, no storage.

export type Grade = 'again' | 'hard' | 'good';

export type Outcome = 'correct' | 'accent' | 'article-missing' | 'article-wrong' | 'typo' | 'wrong';

export type DiffTokenKind = 'ok' | 'wrong' | 'missing' | 'extra';

export interface DiffToken {
  kind: DiffTokenKind;
  text: string;
}

export interface GradeResult {
  outcome: Outcome;
  grade: Grade;
  note?: string;
  /** The accepted answer that the input was compared against / matched. */
  matched?: string;
  diff?: DiffToken[];
}

const ARTICLES = ['el', 'la', 'los', 'las'];
const STRIP_CHARS = /[¿¡?!.,;:"']/g;

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(STRIP_CHARS, '')
    .trim()
    .replace(/\s+/g, ' ');
}

const ACCENT_MAP: Record<string, string> = {
  á: 'a',
  é: 'e',
  í: 'i',
  ó: 'o',
  ú: 'u',
  ü: 'u',
};

export function stripAccents(s: string): string {
  return s.replace(/[áéíóúü]/g, (c) => ACCENT_MAP[c] ?? c);
}

function withoutAccents(s: string): string {
  return stripAccents(s);
}

/** Damerau-Levenshtein edit distance (transpositions count as 1 edit). */
export function damerauLevenshtein(a: string, b: string): number {
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;

  const d: number[][] = Array.from({ length: al + 1 }, () => new Array(bl + 1).fill(0));
  for (let i = 0; i <= al; i++) d[i][0] = i;
  for (let j = 0; j <= bl; j++) d[0][j] = j;

  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + cost);
      }
    }
  }
  return d[al][bl];
}

function startsWithArticle(canonical: string): string | null {
  const norm = normalize(canonical);
  for (const art of ARTICLES) {
    if (norm.startsWith(art + ' ')) return art;
  }
  return null;
}

function stripArticle(s: string, article: string): string {
  return s.slice(article.length + 1);
}

/** Word-level diff between the typed answer and the closest accepted answer. */
export function diffWords(input: string, target: string): DiffToken[] {
  const a = normalize(input).split(' ').filter(Boolean);
  const b = normalize(target).split(' ').filter(Boolean);

  // Simple LCS-based alignment.
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const result: DiffToken[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      result.push({ kind: 'ok', text: b[j] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      result.push({ kind: 'extra', text: a[i] });
      i++;
    } else {
      result.push({ kind: 'missing', text: b[j] });
      j++;
    }
  }
  while (i < n) {
    result.push({ kind: 'extra', text: a[i] });
    i++;
  }
  while (j < m) {
    result.push({ kind: 'missing', text: b[j] });
    j++;
  }
  return result;
}

function closest(input: string, candidates: string[]): { candidate: string; distance: number } {
  let best = candidates[0];
  let bestDist = Infinity;
  const normInput = normalize(input);
  for (const c of candidates) {
    const dist = damerauLevenshtein(normInput, normalize(c));
    if (dist < bestDist) {
      bestDist = dist;
      best = c;
    }
  }
  return { candidate: best, distance: bestDist };
}

export interface GradeWordOptions {
  isSentence?: boolean;
}

/**
 * Grade a single-word (vocab) answer.
 * `canonical` is the `es` field, `accepted` is `accept` plus any `userAccepted`.
 * `isNoun` should be true only when the canonical answer's `es` starts with
 * el/la/los/las (per spec, month names etc. have no article and are excluded).
 */
export function gradeWord(input: string, canonical: string, accepted: string[] = []): GradeResult {
  const allAccepted = [canonical, ...accepted];
  const normInput = normalize(input);

  // exact match against any accepted answer
  for (const cand of allAccepted) {
    if (normInput === normalize(cand)) {
      return { outcome: 'correct', grade: 'good', matched: cand };
    }
  }

  // accent-insensitive match
  for (const cand of allAccepted) {
    if (withoutAccents(normInput) === withoutAccents(normalize(cand))) {
      return { outcome: 'accent', grade: 'good', matched: cand, note: 'Accent: ' + cand };
    }
  }

  // article handling (only relevant when canonical is a noun with an article)
  const article = startsWithArticle(canonical);
  if (article) {
    const bareNoun = stripArticle(normalize(canonical), article);
    if (normInput === bareNoun || withoutAccents(normInput) === withoutAccents(bareNoun)) {
      return {
        outcome: 'article-missing',
        grade: 'hard',
        matched: canonical,
        note: `Include the article: ${canonical}`,
      };
    }
    // wrong article: input starts with a different article followed by the bare noun
    for (const wrongArt of ARTICLES) {
      if (wrongArt === article) continue;
      if (normInput === `${wrongArt} ${bareNoun}` || withoutAccents(normInput) === withoutAccents(`${wrongArt} ${bareNoun}`)) {
        const genderWord = article === 'la' || article === 'las' ? 'feminine' : 'masculine';
        return {
          outcome: 'article-wrong',
          grade: 'again',
          matched: canonical,
          note: `Gender: ${canonical} (${genderWord})`,
        };
      }
    }
  }

  // typo: Damerau-Levenshtein distance 1, only for words >= 4 chars
  const { candidate, distance } = closest(input, allAccepted);
  const candLen = normalize(candidate).replace(/\s+/g, '').length;
  if (distance === 1 && candLen >= 4) {
    return { outcome: 'typo', grade: 'hard', matched: candidate, note: `Typo: ${candidate}` };
  }

  return { outcome: 'wrong', grade: 'again', matched: allAccepted[0] };
}

/**
 * Grade a full-sentence answer. `canonical` is `es`, `accepted` is `alt` plus
 * any `userAccepted`.
 */
export function gradeSentence(input: string, canonical: string, accepted: string[] = []): GradeResult {
  const allAccepted = [canonical, ...accepted];
  const normInput = normalize(input);

  for (const cand of allAccepted) {
    if (normInput === normalize(cand)) {
      return { outcome: 'correct', grade: 'good', matched: cand, diff: diffWords(input, cand) };
    }
  }

  for (const cand of allAccepted) {
    if (withoutAccents(normInput) === withoutAccents(normalize(cand))) {
      return {
        outcome: 'accent',
        grade: 'good',
        matched: cand,
        note: 'Accent: ' + cand,
        diff: diffWords(input, cand),
      };
    }
  }

  const { candidate, distance } = closest(input, allAccepted);
  const len = normalize(candidate).length;
  const maxDist = Math.max(1, Math.floor(len / 15));
  if (distance <= maxDist) {
    return {
      outcome: 'typo',
      grade: 'hard',
      matched: candidate,
      note: `Typo: ${candidate}`,
      diff: diffWords(input, candidate),
    };
  }

  return {
    outcome: 'wrong',
    grade: 'again',
    matched: candidate,
    diff: diffWords(input, candidate),
  };
}

/** True when the canonical `es` answer names a noun that must carry an article. */
export function isArticledNoun(canonicalEs: string): boolean {
  return startsWithArticle(canonicalEs) !== null;
}
