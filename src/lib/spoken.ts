// Normalisation of speech-to-text transcripts before they go into the answer box.
import { normalize } from './grade';

const UNITS = [
  'cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez',
  'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte',
];
const TENS: Record<number, string> = {
  30: 'treinta', 40: 'cuarenta', 50: 'cincuenta', 60: 'sesenta', 70: 'setenta', 80: 'ochenta', 90: 'noventa',
};
const TWENTIES = [
  'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco',
  'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve',
];

/** Spanish words for 0-99, or null when out of range. */
export function numberToSpanish(n: number): string | null {
  if (!Number.isInteger(n) || n < 0 || n > 99) return null;
  if (n <= 20) return UNITS[n];
  if (n < 30) return TWENTIES[n - 20];
  const ten = Math.floor(n / 10) * 10;
  const unit = n % 10;
  return unit === 0 ? TENS[ten] : `${TENS[ten]} y ${UNITS[unit]}`;
}

/** Lowercase, strip punctuation and spell out small digit numbers. */
export function normalizeSpoken(raw: string): string {
  const spelled = raw.replace(/\d+/g, (m) => numberToSpanish(Number(m)) ?? m);
  return normalize(spelled);
}
