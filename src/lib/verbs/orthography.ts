/** Spanish spelling helpers: syllable nuclei, stress, accents and clitic attachment. */

const VOWELS = 'aeiouáéíóúü';
const STRONG = 'aeoáéó';
const ACCENTED = 'áéíóú';
const ADD_ACCENT: Record<string, string> = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú' };

export const isVowel = (ch: string | undefined): boolean => !!ch && VOWELS.includes(ch);

interface Nucleus {
  start: number;
  end: number; // exclusive
}

/** Vowel groups that form one syllable nucleus (diphthongs / triphthongs count once). */
export function nuclei(word: string): Nucleus[] {
  const out: Nucleus[] = [];
  let prev = '';
  for (let i = 0; i < word.length; i++) {
    const ch = word[i];
    // silent u in que/qui/gue/gui
    const silentU =
      ch === 'u' && (word[i - 1] === 'q' || word[i - 1] === 'g') && 'eiéí'.includes(word[i + 1] ?? '-');
    if (!isVowel(ch) || silentU) {
      prev = '';
      continue;
    }
    const last = out[out.length - 1];
    const joins =
      prev !== '' &&
      last &&
      last.end === i &&
      !(STRONG.includes(prev) && STRONG.includes(ch)) &&
      !(ACCENTED.includes(prev) && !STRONG.includes(prev)) &&
      !(ACCENTED.includes(ch) && !STRONG.includes(ch));
    if (joins) last.end = i + 1;
    else out.push({ start: i, end: i + 1 });
    prev = ch;
  }
  return out;
}

function stressedVowelIndex(word: string, n: Nucleus): number {
  const seg = word.slice(n.start, n.end);
  for (let k = 0; k < seg.length; k++) if (ACCENTED.includes(seg[k])) return n.start + k;
  for (let k = 0; k < seg.length; k++) if (STRONG.includes(seg[k])) return n.start + k;
  return n.start + seg.length - 1;
}

/** Index of the nucleus that carries the stress. */
export function stressNucleus(word: string): number {
  const ns = nuclei(word);
  if (ns.length === 0) return -1;
  for (let k = 0; k < ns.length; k++) {
    if ([...word.slice(ns[k].start, ns[k].end)].some((c) => ACCENTED.includes(c))) return k;
  }
  const lastCh = word[word.length - 1];
  const penult = isVowel(lastCh) || lastCh === 'n' || lastCh === 's';
  return penult ? Math.max(0, ns.length - 2) : ns.length - 1;
}

function putAccent(word: string, nucleusIdx: number): string {
  const ns = nuclei(word);
  const n = ns[nucleusIdx];
  if (!n) return word;
  const idx = stressedVowelIndex(word, n);
  const ch = word[idx];
  if (ACCENTED.includes(ch) || !ADD_ACCENT[ch]) return word;
  return word.slice(0, idx) + ADD_ACCENT[ch] + word.slice(idx + 1);
}

/** Add a written accent on the last syllable (used when a compound's stress stays on a monosyllabic base). */
export function accentLast(word: string): string {
  const ns = nuclei(word);
  return putAccent(word, ns.length - 1);
}

/** Attach enclitic pronouns ("muda" + "te" -> "múdate", "di" + "melo" -> "dímelo"). */
export function attach(word: string, clitics: string): string {
  const stressIdx = stressNucleus(word);
  const joined = word + clitics;
  const total = nuclei(joined).length;
  if (stressIdx >= 0 && total - stressIdx >= 3) return putAccent(joined, stressIdx);
  return joined;
}

/** Lower-case and remove accents (keeps ñ and ü distinct). */
export function plain(s: string): string {
  return s
    .toLowerCase()
    .replace(/ñ/g, '\E000')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\E000/g, 'ñ');
}

/** Remove a written accent from the stressed vowel (used for comparisons). */
export const removeAccents = plain;

const CLITIC_ONE = ['me', 'te', 'se', 'nos', 'os', 'lo', 'la', 'los', 'las', 'le', 'les'];

/** Candidate base forms of a verb surface with enclitic pronouns removed (including the surface itself). */
export function stripClitics(surface: string): string[] {
  const s = plain(surface);
  const out = new Set<string>([s]);
  const firstLayer: string[] = [];
  for (const c of CLITIC_ONE) {
    if (s.length > c.length + 1 && s.endsWith(c)) firstLayer.push(s.slice(0, -c.length));
  }
  for (const f of firstLayer) {
    out.add(f);
    for (const c of CLITIC_ONE) {
      if (f.length > c.length + 1 && f.endsWith(c)) out.add(f.slice(0, -c.length));
    }
  }
  for (const f of [...out]) {
    out.add(f + 's'); // hagámoslo / mudémonos: -mos loses its s
    out.add(f + 'd'); // levantaos / sentaos: -d dropped
  }
  return [...out];
}
