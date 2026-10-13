import { useEffect, useRef, useState } from 'react';
import { getSettings, saveSettings, exportProgress, importProgress, resetProgress, type Settings as SettingsData, type VoicePref, type SpeechEngine } from '../lib/db';
import { PIPER_VOICES, downloadVoice, speak } from '../lib/speech';
import type { DrillMode } from '../lib/conjugationDrill';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface SettingsProps {
  onBack: () => void;
}

/** Parses a number input, clamping to [min, max] and falling back to the
 *  previous value for empty/invalid input (e.g. a momentarily-cleared field). */
function clampNumber(raw: string, min: number, max: number, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function Settings({ onBack }: SettingsProps) {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [message, setMessage] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmImportFile, setConfirmImportFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadPct, setDownloadPct] = useState(0);
  const [voiceMsg, setVoiceMsg] = useState('');

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  if (!settings) return null;

  async function update(patch: Partial<SettingsData>) {
    const next = await saveSettings(patch);
    setSettings(next);
  }

  async function downloadNow() {
    if (!settings) return;
    setDownloading(true);
    setDownloadPct(0);
    setVoiceMsg('');
    try {
      await downloadVoice(settings.piperVoice, (f) => setDownloadPct(Math.round(f * 100)));
      setVoiceMsg('Voice downloaded and cached for offline use.');
    } catch (e) {
      setVoiceMsg('Download failed: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setDownloading(false);
    }
  }

  async function handleExport() {
    const data = await exportProgress();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `palabras-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function runImport(file: File) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await importProgress(data);
      setMessage('Progress imported.');
      getSettings().then(setSettings);
    } catch {
      setMessage('Could not read that file.');
    }
  }

  async function runReset() {
    await resetProgress();
    setMessage('Progress reset.');
    getSettings().then(setSettings);
  }

  return (
    <div className="stack" style={{ padding: '1.25rem', maxWidth: 480, margin: '0 auto', width: '100%' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button className="btn btn-ghost" onClick={onBack}>
          ← Home
        </button>
        <h1 style={{ fontSize: '1.3rem', margin: 0 }}>Settings</h1>
        <div style={{ width: 48 }} />
      </div>

      <section className="card stack">
        <h2 style={{ fontSize: '1.05rem', margin: 0 }}>Session size</h2>
        <label className="row" style={{ justifyContent: 'space-between' }}>
          New words per session
          <input
            type="number"
            min={1}
            max={50}
            value={settings.newPerSession}
            onChange={(e) => update({ newPerSession: clampNumber(e.target.value, 1, 50, settings.newPerSession) })}
            style={{ width: 70 }}
          />
        </label>
        <label className="row" style={{ justifyContent: 'space-between' }}>
          Reviews per session
          <input
            type="number"
            min={0}
            max={100}
            value={settings.reviewsPerSession}
            onChange={(e) => update({ reviewsPerSession: clampNumber(e.target.value, 0, 100, settings.reviewsPerSession) })}
            style={{ width: 70 }}
          />
        </label>
        <label className="row" style={{ justifyContent: 'space-between' }}>
          Sentences per session
          <input
            type="number"
            min={0}
            max={20}
            value={settings.sentencesPerSession}
            onChange={(e) => update({ sentencesPerSession: clampNumber(e.target.value, 0, 20, settings.sentencesPerSession) })}
            style={{ width: 70 }}
          />
        </label>
      </section>

      <section className="card stack">
        <h2 style={{ fontSize: '1.05rem', margin: 0 }}>Answering</h2>
        <label className="row" style={{ justifyContent: 'space-between' }}>
          Tries before revealing the answer
          <input
            type="number"
            min={1}
            max={5}
            value={settings.maxTries}
            onChange={(e) => update({ maxTries: clampNumber(e.target.value, 1, 5, settings.maxTries) })}
            style={{ width: 70 }}
          />
        </label>
      </section>

      <section className="card stack">
        <h2 style={{ fontSize: '1.05rem', margin: 0 }}>Conjugation</h2>
        <label className="row" style={{ justifyContent: 'space-between' }}>
          Conjugation drill before sentences
          <select value={settings.conjugationDrill} onChange={(e) => update({ conjugationDrill: e.target.value as DrillMode })}>
            <option value="always">Always</option>
            <option value="new">Only new verb+tense combos</option>
            <option value="off">Off</option>
          </select>
        </label>
        <label className="row" style={{ justifyContent: 'space-between' }}>
          Include vosotros
          <input type="checkbox" checked={settings.includeVosotros} onChange={(e) => update({ includeVosotros: e.target.checked })} />
        </label>
      </section>

      <section className="card stack">
        <h2 style={{ fontSize: '1.05rem', margin: 0 }}>Speech</h2>
        <label className="row" style={{ justifyContent: 'space-between' }}>
          Auto-speak Spanish answers
          <input type="checkbox" checked={settings.speechOn} onChange={(e) => update({ speechOn: e.target.checked })} />
        </label>
        <label className="row" style={{ justifyContent: 'space-between' }}>
          Speech engine
          <select value={settings.speechEngine} onChange={(e) => update({ speechEngine: e.target.value as SpeechEngine })}>
            <option value="neural">Neural (Piper)</option>
            <option value="browser">Browser</option>
          </select>
        </label>
        {settings.speechEngine === 'neural' ? (
          <>
            <label className="row" style={{ justifyContent: 'space-between' }}>
              Voice
              <select value={settings.piperVoice} onChange={(e) => update({ piperVoice: e.target.value })}>
                {PIPER_VOICES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn btn-block" onClick={downloadNow} disabled={downloading}>
              {downloading ? 'Downloading…' : 'Download voice now'}
            </button>
            {downloading && <progress value={downloadPct} max={100} style={{ width: '100%' }} />}
            {voiceMsg && <div className="text-muted">{voiceMsg}</div>}
          </>
        ) : (
          <label className="row" style={{ justifyContent: 'space-between' }}>
            Browser voice
            <select value={settings.voicePref} onChange={(e) => update({ voicePref: e.target.value as VoicePref })}>
              <option value="auto">Auto</option>
              <option value="es-ES">es-ES</option>
              <option value="es-MX">es-MX</option>
            </select>
          </label>
        )}
        <button className="btn btn-block" onClick={() => speak('Hola, ¿cómo estás? Me llamo Palabras.', { explicit: true })}>
          🔊 Test voice
        </button>
      </section>

      <section className="card stack">
        <h2 style={{ fontSize: '1.05rem', margin: 0 }}>Microphone</h2>
        <label className="row" style={{ justifyContent: 'space-between' }}>
          Show microphone button
          <input type="checkbox" checked={settings.showMic} onChange={(e) => update({ showMic: e.target.checked })} />
        </label>
        <label className="row" style={{ justifyContent: 'space-between' }}>
          Auto-check after speaking
          <input
            type="checkbox"
            checked={settings.autoCheckSpoken}
            onChange={(e) => update({ autoCheckSpoken: e.target.checked })}
          />
        </label>
        <div className="text-muted" style={{ fontSize: '0.85rem' }}>
          Speech recognition runs on-device (Whisper). The model (~80 MB) downloads the first time you use the microphone.
        </div>
      </section>

      <section className="card stack">
        <h2 style={{ fontSize: '1.05rem', margin: 0 }}>Data</h2>
        <button className="btn btn-block" onClick={handleExport}>
          Export progress
        </button>
        <button className="btn btn-block" onClick={() => fileInput.current?.click()}>
          Import progress
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) setConfirmImportFile(file);
            e.target.value = '';
          }}
        />
        <button className="btn btn-block" style={{ color: 'var(--bad)' }} onClick={() => setConfirmReset(true)}>
          Reset progress
        </button>
        {message && <div className="text-muted">{message}</div>}
      </section>

      <ConfirmDialog
        open={confirmReset}
        title="Reset progress?"
        message="This clears all word and sentence progress. This cannot be undone."
        confirmLabel="Reset"
        danger
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          setConfirmReset(false);
          runReset();
        }}
      />

      <ConfirmDialog
        open={confirmImportFile !== null}
        title="Import progress?"
        message="This replaces all current word and sentence progress with the imported file's contents."
        confirmLabel="Import"
        danger
        onCancel={() => setConfirmImportFile(null)}
        onConfirm={() => {
          const file = confirmImportFile;
          setConfirmImportFile(null);
          if (file) runImport(file);
        }}
      />
    </div>
  );
}
