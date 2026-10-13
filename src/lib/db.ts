import Dexie, { type Table } from 'dexie';
import type { WordState } from './srs';
import type { SentenceState } from './sentences';
import type { ConjugationState, DrillMode } from './conjugationDrill';
import { DEFAULT_SETTINGS, type SessionSettings } from './session';

export type VoicePref = 'es-ES' | 'es-MX' | 'auto';

export type SpeechEngine = 'neural' | 'browser';

export interface Settings {
  id: 'settings';
  newPerSession: number;
  reviewsPerSession: number;
  sentencesPerSession: number;
  speechOn: boolean;
  voicePref: VoicePref;
  maxTries: number;
  speechEngine: SpeechEngine;
  piperVoice: string;
  showMic: boolean;
  autoCheckSpoken: boolean;
  conjugationDrill: DrillMode;
  includeVosotros: boolean;
}

export interface SessionLogEntry {
  id?: number;
  completedAt: number; // ms timestamp
  newWords: number;
  correct: number;
  total: number;
}

export const DEFAULT_APP_SETTINGS: Settings = {
  id: 'settings',
  ...DEFAULT_SETTINGS,
  speechOn: true,
  voicePref: 'auto',
  maxTries: 3,
  speechEngine: 'neural',
  piperVoice: 'es_ES-davefx-medium',
  showMic: true,
  autoCheckSpoken: true,
  conjugationDrill: 'always',
  includeVosotros: false,
};

export class PalabrasDB extends Dexie {
  wordStates!: Table<WordState, number>;
  sentenceStates!: Table<SentenceState, string>;
  settings!: Table<Settings, string>;
  sessionLog!: Table<SessionLogEntry, number>;
  conjugationStates!: Table<ConjugationState, string>;

  constructor() {
    super('palabras');
    this.version(1).stores({
      wordStates: 'id, due, introduced',
      sentenceStates: 'id',
      settings: 'id',
      sessionLog: '++id, completedAt',
    });
    // v2: adds conjugationStates; existing tables and data are kept as-is.
    this.version(2).stores({
      wordStates: 'id, due, introduced',
      sentenceStates: 'id',
      settings: 'id',
      sessionLog: '++id, completedAt',
      conjugationStates: 'id',
    });
  }
}

export const db = new PalabrasDB();

export async function getSettings(): Promise<Settings> {
  const existing = await db.settings.get('settings');
  if (existing) return { ...DEFAULT_APP_SETTINGS, ...existing };
  await db.settings.put(DEFAULT_APP_SETTINGS);
  return DEFAULT_APP_SETTINGS;
}

export async function saveSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<Settings> {
  const current = await getSettings();
  const next: Settings = { ...current, ...patch };
  await db.settings.put(next);
  return next;
}

export async function getSessionSettings(): Promise<SessionSettings> {
  const s = await getSettings();
  return {
    newPerSession: s.newPerSession,
    reviewsPerSession: s.reviewsPerSession,
    sentencesPerSession: s.sentencesPerSession,
  };
}

export async function getAllWordStates(): Promise<Map<number, WordState>> {
  const all = await db.wordStates.toArray();
  return new Map(all.map((s) => [s.id, s]));
}

export async function getAllSentenceStates(): Promise<Map<string, SentenceState>> {
  const all = await db.sentenceStates.toArray();
  return new Map(all.map((s) => [s.id, s]));
}

export async function saveWordState(state: WordState): Promise<void> {
  await db.wordStates.put(state);
}

export async function getAllConjugationStates(): Promise<Map<string, ConjugationState>> {
  const all = await db.conjugationStates.toArray();
  return new Map(all.map((s) => [s.id, s]));
}

export async function saveConjugationState(state: ConjugationState): Promise<void> {
  await db.conjugationStates.put(state);
}

export async function saveSentenceState(state: SentenceState): Promise<void> {
  await db.sentenceStates.put(state);
}

export async function logSession(entry: Omit<SessionLogEntry, 'id'>): Promise<void> {
  await db.sessionLog.add(entry);
}

export async function getSessionDates(): Promise<number[]> {
  const all = await db.sessionLog.toArray();
  return all.map((e) => e.completedAt);
}

export interface ExportedProgress {
  version: 1;
  exportedAt: number;
  wordStates: WordState[];
  sentenceStates: SentenceState[];
  settings: Settings;
  sessionLog: SessionLogEntry[];
  conjugationStates?: ConjugationState[];
}

export async function exportProgress(): Promise<ExportedProgress> {
  const [wordStates, sentenceStates, settings, sessionLog, conjugationStates] = await Promise.all([
    db.wordStates.toArray(),
    db.sentenceStates.toArray(),
    getSettings(),
    db.sessionLog.toArray(),
    db.conjugationStates.toArray(),
  ]);
  return { version: 1, exportedAt: Date.now(), wordStates, sentenceStates, settings, sessionLog, conjugationStates };
}

export async function importProgress(data: ExportedProgress): Promise<void> {
  await db.transaction('rw', db.wordStates, db.sentenceStates, db.settings, db.sessionLog, db.conjugationStates, async () => {
    await db.wordStates.clear();
    await db.sentenceStates.clear();
    await db.sessionLog.clear();
    await db.conjugationStates.clear();
    if (data.wordStates?.length) await db.wordStates.bulkPut(data.wordStates);
    if (data.sentenceStates?.length) await db.sentenceStates.bulkPut(data.sentenceStates);
    if (data.sessionLog?.length) await db.sessionLog.bulkAdd(data.sessionLog.map(({ id, ...rest }) => rest));
    if (data.conjugationStates?.length) await db.conjugationStates.bulkPut(data.conjugationStates);
    if (data.settings) await db.settings.put(data.settings);
  });
}

export async function resetProgress(): Promise<void> {
  await db.transaction('rw', db.wordStates, db.sentenceStates, db.settings, db.sessionLog, db.conjugationStates, async () => {
    await db.wordStates.clear();
    await db.sentenceStates.clear();
    await db.sessionLog.clear();
    await db.conjugationStates.clear();
    await db.settings.clear();
  });
}
