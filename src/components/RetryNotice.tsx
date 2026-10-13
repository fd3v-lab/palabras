import type { AttemptStep } from '../lib/attempts';
import { DiffLine } from './DiffLine';

export type RetryInfo = Extract<AttemptStep, { kind: 'retry' }>;

export function RetryNotice({ info }: { info: RetryInfo }) {
  return (
    <div className="feedback-banner feedback-hard" role="status">
      <div>Not quite — try again ({info.triesLeft} left)</div>
      {info.nudge && <div style={{ fontWeight: 400, marginTop: '0.25rem' }}>{info.nudge}</div>}
      {info.hint && (
        <div style={{ fontWeight: 400, marginTop: '0.25rem' }}>
          Hint: <code style={{ letterSpacing: '0.08em' }}>{info.hint}</code>
        </div>
      )}
      {info.hintDiff && (
        <div style={{ marginTop: '0.25rem' }}>
          <DiffLine diff={info.hintDiff} />
        </div>
      )}
    </div>
  );
}
