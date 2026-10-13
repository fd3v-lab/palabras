import type { DiffToken } from '../lib/grade';

const COLORS: Record<DiffToken['kind'], string> = {
  ok: 'var(--good)',
  wrong: 'var(--bad)',
  missing: 'var(--hard)',
  extra: 'var(--bad)',
};

export function DiffLine({ diff }: { diff: DiffToken[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
      {diff.map((tok, i) => (
        <span
          key={i}
          style={{
            color: COLORS[tok.kind],
            textDecoration: tok.kind === 'extra' ? 'line-through' : 'none',
          }}
        >
          {tok.kind === 'missing' ? `(${tok.text})` : tok.text}
        </span>
      ))}
    </div>
  );
}
