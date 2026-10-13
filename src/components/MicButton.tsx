import { useCallback, useEffect, useRef, useState } from 'react';
import { describeMicError, loadWhisper, startRecording, transcribeAudio, type Recording } from '../lib/stt';
import { normalizeSpoken } from '../lib/spoken';

type MicState = 'idle' | 'starting' | 'listening' | 'loading' | 'transcribing';

interface MicButtonProps {
  disabled?: boolean;
  /** Receives the normalised transcript. */
  onTranscript: (text: string) => void;
}

export function MicButton({ disabled, onTranscript }: MicButtonProps) {
  const [state, setState] = useState<MicState>('idle');
  const [pct, setPct] = useState(0);
  const [error, setError] = useState('');
  const recRef = useRef<Recording | null>(null);
  const stateRef = useRef<MicState>('idle');
  const mountedRef = useRef(true);
  const cbRef = useRef(onTranscript);
  cbRef.current = onTranscript;

  const set = (s: MicState) => {
    stateRef.current = s;
    if (mountedRef.current) setState(s);
  };

  const finish = useCallback(async () => {
    const rec = recRef.current;
    if (!rec) return;
    recRef.current = null;
    set('transcribing');
    try {
      const audio = await rec.stop();
      if (audio.length < 1600) throw new Error('Nothing recorded.');
      if (mountedRef.current) setPct(0);
      const text = await transcribeAudio(audio, (p) => {
        if (mountedRef.current) setPct(Math.round(p));
      });
      if (mountedRef.current && text) cbRef.current(normalizeSpoken(text));
      else if (mountedRef.current) setError("Didn't catch that.");
    } catch (e) {
      if (mountedRef.current) setError(describeMicError(e));
    } finally {
      set('idle');
    }
  }, []);

  const begin = useCallback(async () => {
    setError('');
    set('starting');
    try {
      const rec = await startRecording();
      recRef.current = rec;
      set('listening');
      void rec.ended.then(() => {
        if (stateRef.current === 'listening') void finish();
      });
      // Warm up the model while the user speaks (first use downloads it).
      void loadWhisper((p) => {
        if (mountedRef.current) setPct(Math.round(p));
      }).catch(() => {});
    } catch (e) {
      setError(describeMicError(e));
      set('idle');
    }
  }, [finish]);

  const toggle = useCallback(() => {
    if (stateRef.current === 'idle') void begin();
    else if (stateRef.current === 'listening') void finish();
  }, [begin, finish]);

  useEffect(() => {
    mountedRef.current = true;
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        if (!disabled) toggle();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => {
      mountedRef.current = false;
      window.removeEventListener('keydown', onKey);
      if (recRef.current) {
        void recRef.current.stop();
        recRef.current = null;
      }
    };
  }, [disabled, toggle]);

  const label =
    state === 'listening'
      ? 'Listening… (press to stop)'
      : state === 'starting'
        ? 'Starting…'
        : state === 'transcribing'
          ? pct > 0 && pct < 100
            ? `Loading model ${pct}%`
            : 'Transcribing…'
          : 'Speak your answer (Ctrl+M)';

  return (
    <div className="stack" style={{ gap: '0.25rem', alignItems: 'flex-end' }}>
      <button
        type="button"
        className={`btn ${state === 'listening' ? 'btn-primary' : 'btn-ghost'}`}
        onClick={toggle}
        disabled={disabled || state === 'starting' || state === 'transcribing'}
        aria-label={label}
        title={label}
        style={{ fontSize: '1.4rem', padding: '0.6rem 0.8rem' }}
      >
        {state === 'listening' ? '⏹' : '🎤'}
      </button>
      {(state === 'listening' || state === 'transcribing' || state === 'starting') && (
        <span className="text-muted" style={{ fontSize: '0.8rem' }} role="status">
          {label}
        </span>
      )}
      {error && (
        <span style={{ fontSize: '0.8rem', color: 'var(--bad)', maxWidth: 220, textAlign: 'right' }} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
