import { useEffect, useRef, useState } from 'react';
import { AccentKeyRow } from './AccentKeyRow';
import { evaluateAttempt, wordHint } from '../lib/attempts';
import { TENSE_INFO, checkRows, type DrillRow } from '../lib/conjugationDrill';
import type { Person, Tense } from '../lib/conjugate';
import { speak } from '../lib/speech';

interface Props {
  lemma: string;
  en: string;
  tense: Tense;
  rows: DrillRow[];
  /** Row the upcoming sentence uses; marked only after the table is finished. */
  targetPerson?: Person;
  maxTries: number;
  onFinished: (firstTryCorrect: number, total: number) => void;
  onContinue: () => void;
}

export function ConjugationCard({ lemma, en, tense, rows, targetPerson, maxTries, onFinished, onContinue }: Props) {
  const info = TENSE_INFO[tense];
  const n = rows.length;
  const [inputs, setInputs] = useState<string[]>(() => rows.map(() => ''));
  const [locked, setLocked] = useState<boolean[]>(() => rows.map(() => false));
  const [wrong, setWrong] = useState<boolean[]>(() => rows.map(() => false));
  const [misses, setMisses] = useState(0);
  const [showHints, setShowHints] = useState(false);
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);
  const [focusSignal, setFocusSignal] = useState<{ idx: number } | null>({ idx: 0 });
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const focusedRef = useRef(0);
  const firstTryRef = useRef<number | null>(null);

  useEffect(() => {
    if (focusSignal) refs.current[focusSignal.idx]?.focus();
  }, [focusSignal]);

  function finish(firstTry: number) {
    setDone(true);
    setMessage('');
    onFinished(firstTry, n);
  }

  function check() {
    if (done) return;
    const checks = checkRows(rows, inputs);
    if (firstTryRef.current === null) firstTryRef.current = checks.filter((c) => c.ok).length;
    const allOk = checks.every((c) => c.ok);
    const step = evaluateAttempt(
      allOk ? { outcome: 'correct', grade: 'good' } : { outcome: 'wrong', grade: 'again' },
      misses,
      maxTries,
      { canonical: 'x' },
    );
    // Correct (or accent-only) rows get the proper accented form and lock.
    const nextInputs = inputs.map((v, i) => (checks[i].ok ? rows[i].answer : v));
    if (step.kind === 'finished') {
      setInputs(step.revealed ? rows.map((r) => r.answer) : nextInputs);
      setLocked(rows.map(() => true));
      setWrong(checks.map((c) => !c.ok));
      finish(firstTryRef.current);
      return;
    }
    const wrongCount = checks.filter((c) => !c.ok).length;
    setInputs(nextInputs);
    setLocked(checks.map((c) => c.ok));
    setWrong(checks.map((c) => !c.ok));
    setMisses(step.misses);
    if (step.hint !== undefined) setShowHints(true);
    setMessage(`${wrongCount} row${wrongCount === 1 ? '' : 's'} to fix — try again (${step.triesLeft} left)`);
    setFocusSignal({ idx: checks.findIndex((c) => !c.ok) });
  }

  function showTable() {
    if (done) return;
    setInputs(rows.map((r) => r.answer));
    setLocked(rows.map(() => true));
    setWrong(rows.map(() => false));
    finish(firstTryRef.current ?? 0);
  }

  function onRowEnter(i: number) {
    for (let j = i + 1; j < n; j++) {
      if (!locked[j]) {
        refs.current[j]?.focus();
        return;
      }
    }
    check();
  }

  function insertAccent(ch: string) {
    const i = focusedRef.current;
    const el = refs.current[i];
    if (!el || locked[i]) return;
    const start = el.selectionStart ?? inputs[i].length;
    const end = el.selectionEnd ?? inputs[i].length;
    setInputs((arr) => arr.map((v, k) => (k === i ? v.slice(0, start) + ch + v.slice(end) : v)));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + ch.length, start + ch.length);
    });
  }

  useEffect(() => {
    if (!done) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Enter' && !e.repeat) onContinue();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [done, onContinue]);

  return (
    <div className="card stack" data-testid="conjugation-card">
      <div className="text-muted">Conjugation</div>
      <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>
        {lemma} ({en}) · {info.label}
      </div>
      <div className="text-muted">{info.tip}</div>
      {info.hint && <div className="text-muted" style={{ fontSize: '0.85rem' }}>{info.hint}</div>}

      <div className="stack" style={{ gap: '0.5rem' }}>
        {rows.map((row, i) => {
          const isWrong = wrong[i];
          const isOk = locked[i] && !isWrong;
          const border = isWrong ? 'var(--bad)' : isOk ? 'var(--good)' : 'var(--border)';
          return (
            <div key={row.person} className="row" style={{ gap: '0.5rem', alignItems: 'center' }}>
              <label htmlFor={`conj-${row.person}`} style={{ flex: '1 1 40%', fontSize: '0.9rem' }}>
                {row.label}
              </label>
              <div style={{ flex: '1 1 50%', minWidth: 0 }}>
                <input
                  id={`conj-${row.person}`}
                  ref={(el) => {
                    refs.current[i] = el;
                  }}
                  type="text"
                  value={inputs[i]}
                  readOnly={locked[i]}
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  lang="es"
                  autoComplete="off"
                  onFocus={() => {
                    focusedRef.current = i;
                  }}
                  onChange={(e) => {
                    const v = e.target.value;
                    setInputs((arr) => arr.map((x, k) => (k === i ? v : x)));
                    setWrong((arr) => arr.map((x, k) => (k === i ? false : x)));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!done) onRowEnter(i);
                    }
                  }}
                  style={{
                    fontSize: '1.1rem',
                    padding: '0.5rem 0.7rem',
                    borderRadius: 10,
                    border: `2px solid ${border}`,
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    width: '100%',
                  }}
                />
                {showHints && isWrong && !done && (
                  <div className="text-muted" style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>
                    {wordHint(row.answer)}
                  </div>
                )}
              </div>
              {done && (
                <button className="btn btn-ghost" aria-label={`Listen to ${row.answer}`} onClick={() => void speak(row.answer, { explicit: true })}>
                  🔊
                </button>
              )}
              {done && targetPerson === row.person && (
                <span className="text-muted" style={{ fontSize: '0.75rem' }} title="used in the next sentence">
                  ◀ next sentence
                </span>
              )}
            </div>
          );
        })}
      </div>

      {!done && <AccentKeyRow onInsert={insertAccent} />}
      {message && !done && <div role="status" style={{ color: 'var(--bad)' }}>{message}</div>}
      {done && targetPerson && (
        <div className="text-muted" style={{ fontSize: '0.85rem' }}>
          ◀ marks the form used in the next sentence
        </div>
      )}

      <div className="row">
        {!done && (
          <button className="btn btn-ghost" onClick={showTable}>
            Show table
          </button>
        )}
        <button className="btn btn-primary btn-block" onClick={done ? onContinue : check}>
          {done ? 'Continue' : 'Check'}
        </button>
      </div>
    </div>
  );
}
