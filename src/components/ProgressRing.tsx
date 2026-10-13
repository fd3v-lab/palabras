interface ProgressRingProps {
  value: number;
  total: number;
  size?: number;
  label?: string;
}

export function ProgressRing({ value, total, size = 120, label }: ProgressRingProps) {
  const pct = total > 0 ? Math.min(1, value / total) : 0;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * pct;

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <strong style={{ fontSize: '1.4rem' }}>{value}</strong>
        <span className="text-muted" style={{ fontSize: '0.8rem' }}>
          / {total}
        </span>
        {label && (
          <span className="text-muted" style={{ fontSize: '0.7rem' }}>
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
