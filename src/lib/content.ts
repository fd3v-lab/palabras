import wordsJson from '../data/words.json';
import sentencesJson from '../data/sentences.json';
import type { SentenceContent } from './sentences';

export interface WordContent {
  id: number;
  lemma: string;
  es: string;
  accept: string[];
  en: string;
  hint: string;
  pos: string;
  gender?: 'm' | 'f' | 'mf';
  example: { es: string; en: string };
  order: number;
}

export const words: WordContent[] = wordsJson as WordContent[];
export const sentences: SentenceContent[] = sentencesJson as SentenceContent[];

export const wordsById = new Map<number, WordContent>(words.map((w) => [w.id, w]));
export const sentencesById = new Map<string, SentenceContent>(sentences.map((s) => [s.id, s]));

export const wordsInOrder = [...words].sort((a, b) => a.order - b.order || a.id - b.id);

/** True when the word's canonical `es` starts with el/la/los/las (per spec: month
 *  names and other nouns without an article are excluded from the noun reminder
 *  and article grading). */
export function isArticledNoun(word: WordContent): boolean {
  const norm = word.es.trim().toLowerCase();
  return ['el ', 'la ', 'los ', 'las '].some((art) => norm.startsWith(art));
}
