import { useEffect, useMemo, useState } from 'react';
import { words, type WordContent } from '../lib/content';
import { getAllWordStates } from '../lib/db';
import { isMastered } from '../lib/srs';
import type { WordState } from '../lib/srs';
import { speak } from '../lib/speech';

type Status = 'not-started' | 'learning' | 'mastered';

function statusFor(state: WordState | undefined): Status {
  if (!state?.introduced) return 'not-started';
  if (isMastered(state)) return 'mastered';
  return 'learning';
}

function isDue(state: WordState | undefined, now: number): boolean {
  return !!state?.introduced && state.due <= now;
}

const STATUS_LABEL: Record<Status, string> = {
  'not-started': 'Not started',
  learning: 'Learning',
  mastered: 'Mastered',
};

interface WordsProps {
  onBack: () => void;
}

export function Words({ onBack }: WordsProps) {
  const [states, setStates] = useState<Map<number, WordState>>(new Map());
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<WordContent | null>(null);

  useEffect(() => {
    getAllWordStates().then(setStates);
  }, []);

  const now = Date.now();
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return words;
    return words.filter((w) => w.es.toLowerCase().includes(q) || w.en.toLowerCase().includes(q));
  }, [query]);

  if (selected) {
    const state = states.get(selected.id);
    return (
      <div className="stack" style={{ padding: '1.25rem', maxWidth: 480, margin: '0 auto', width: '100%' }}>
        <button className="btn btn-ghost" onClick={() => setSelected(null)}>
          ← Back to list
        </button>
        <div className="card stack">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0 }}>{selected.es}</h2>
            <button className="btn btn-ghost" onClick={() => speak(selected.es, { explicit: true })} aria-label="Play pronunciation">
              🔊
            </button>
          </div>
          <div>{selected.en}</div>
          {selected.gender && <div className="text-muted">gender: {selected.gender}</div>}
          <div className="text-muted row" style={{ gap: '0.4rem' }}>
            <span>{STATUS_LABEL[statusFor(state)]}</span>
            {isDue(state, now) && <span className="feedback-hard feedback-banner" style={{ padding: '0.15rem 0.5rem', fontSize: '0.75rem' }}>Due</span>}
          </div>
          <div className="card" style={{ background: 'var(--surface-2)' }}>
            <div>{selected.example.es}</div>
            <div className="text-muted">{selected.example.en}</div>
          </div>
          {state && (
            <div className="text-muted" style={{ fontSize: '0.85rem' }}>
              <div>reps: {state.reps}, lapses: {state.lapses}</div>
              <div>ease: {state.ease.toFixed(2)}, interval: {state.interval.toFixed(1)}d</div>
              <div>due: {state.due ? new Date(state.due).toLocaleString() : '—'}</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="stack" style={{ padding: '1.25rem', maxWidth: 480, margin: '0 auto', width: '100%' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button className="btn btn-ghost" onClick={onBack}>
          ← Home
        </button>
        <h1 style={{ fontSize: '1.3rem', margin: 0 }}>Words</h1>
        <div style={{ width: 48 }} />
      </div>
      <input
        type="text"
        placeholder="Search…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{
          padding: '0.7rem 1rem',
          borderRadius: 12,
          border: '1px solid var(--border)',
          background: 'var(--surface)',
          color: 'var(--text)',
          fontSize: '1rem',
        }}
      />
      <div className="stack" style={{ gap: '0.5rem' }}>
        {filtered.map((w) => {
          const state = states.get(w.id);
          const status = statusFor(state);
          const due = isDue(state, now);
          return (
            <button
              key={w.id}
              className="card row"
              style={{ justifyContent: 'space-between', textAlign: 'left', width: '100%', border: 'none' }}
              onClick={() => setSelected(w)}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{w.es}</div>
                <div className="text-muted">{w.en}</div>
              </div>
              <span className="row" style={{ gap: '0.4rem' }}>
                <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                  {STATUS_LABEL[status]}
                </span>
                {due && (
                  <span className="feedback-hard feedback-banner" style={{ padding: '0.1rem 0.45rem', fontSize: '0.7rem' }}>
                    Due
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
