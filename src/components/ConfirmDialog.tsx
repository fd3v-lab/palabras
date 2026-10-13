interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Small in-app confirmation dialog — replaces native window.confirm(). */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
        zIndex: 100,
      }}
    >
      <div className="card stack" style={{ maxWidth: 360, width: '100%' }}>
        {title && <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{title}</h2>}
        <div>{message}</div>
        <div className="row">
          <button className="btn btn-block" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            className="btn btn-block"
            style={danger ? { background: 'var(--bad)', color: '#fff' } : { background: 'var(--accent)', color: 'var(--accent-text)' }}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
