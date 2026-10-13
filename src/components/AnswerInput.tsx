import { useEffect, useRef } from 'react';
import { AccentKeyRow } from './AccentKeyRow';
import { MicButton } from './MicButton';

interface AnswerInputProps {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Increment to focus the input and select its text. */
  selectSignal?: number;
  /** When set, a microphone button is shown and transcripts are passed here. */
  onSpoken?: (text: string) => void;
}

export function AnswerInput({ value, onChange, disabled, placeholder, selectSignal, onSpoken }: AnswerInputProps) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!disabled) ref.current?.focus();
  }, [disabled]);

  useEffect(() => {
    if (!selectSignal) return;
    ref.current?.focus();
    ref.current?.select();
  }, [selectSignal]);

  function insertAtCursor(char: string) {
    const el = ref.current;
    if (!el) {
      onChange(value + char);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + char + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + char.length, start + char.length);
    });
  }

  return (
    <div className="stack" style={{ gap: '0.6rem' }}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
      <input
        ref={ref}
        type="text"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        lang="es"
        autoComplete="off"
        style={{
          fontSize: '1.3rem',
          padding: '0.9rem 1rem',
          borderRadius: 12,
          border: '1px solid var(--border)',
          background: 'var(--surface)',
          color: 'var(--text)',
          width: '100%',
          flex: 1,
          minWidth: 0,
        }}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            // Prevent any default (form submit / newline). The actual
            // submit/continue action is handled by a single centralized
            // Enter listener in the parent Session component, so the same
            // keypress never triggers two actions.
            e.preventDefault();
          }
        }}
      />
      {onSpoken && <MicButton disabled={disabled} onTranscript={onSpoken} />}
      </div>
      <AccentKeyRow onInsert={insertAtCursor} />
    </div>
  );
}
