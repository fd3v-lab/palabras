const KEYS = ['á', 'é', 'í', 'ó', 'ú', 'ñ', 'ü', '¿', '¡'];

interface AccentKeyRowProps {
  onInsert: (char: string) => void;
}

export function AccentKeyRow({ onInsert }: AccentKeyRowProps) {
  return (
    <div
      className="row"
      style={{ flexWrap: 'wrap', gap: '0.4rem', justifyContent: 'center' }}
      role="toolbar"
      aria-label="Accent characters"
    >
      {KEYS.map((k) => (
        <button
          key={k}
          type="button"
          className="btn"
          style={{ padding: '0.5rem 0.7rem', minWidth: 40, minHeight: 40, fontSize: '1.1rem' }}
          // mousedown (not click) so the text input never loses focus
          onMouseDown={(e) => {
            e.preventDefault();
            onInsert(k);
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            onInsert(k);
          }}
        >
          {k}
        </button>
      ))}
    </div>
  );
}
