interface ChipProps {
  label: string;
  revealed?: string;
  isNew?: boolean;
  muted?: boolean;
  onTap?: () => void;
}

export function Chip({ label, revealed, isNew, muted, onTap }: ChipProps) {
  return (
    <button
      type="button"
      className="btn"
      onClick={onTap}
      style={{
        padding: '0.5rem 0.8rem',
        minHeight: 40,
        fontSize: '0.9rem',
        fontWeight: 500,
        background: isNew ? 'var(--chip-new-bg)' : 'var(--chip-bg)',
        opacity: muted && !revealed ? 0.65 : 1,
        border: isNew ? '1px solid var(--accent)' : '1px solid var(--border)',
      }}
    >
      {revealed ?? label}
    </button>
  );
}
