import type { GradeResult } from '../lib/grade';

interface FeedbackBannerProps {
  result: GradeResult;
  onOverride?: () => void;
  showOverride?: boolean;
}

function classFor(result: GradeResult): string {
  if (result.grade === 'good') return 'feedback-good';
  if (result.grade === 'hard') return 'feedback-hard';
  return 'feedback-bad';
}

function headline(result: GradeResult): string {
  switch (result.outcome) {
    case 'correct':
      return 'Correct!';
    case 'accent':
      return 'Correct (watch the accent)';
    case 'article-missing':
      return 'Almost — missing article';
    case 'article-wrong':
      return 'Wrong gender';
    case 'typo':
      return 'Small typo';
    default:
      return 'Not quite';
  }
}

export function FeedbackBanner({ result, onOverride, showOverride }: FeedbackBannerProps) {
  return (
    <div className={`feedback-banner ${classFor(result)}`}>
      <div>{headline(result)}</div>
      {result.note && <div style={{ fontWeight: 400, marginTop: '0.25rem' }}>{result.note}</div>}
      {result.outcome !== 'correct' && result.matched && (
        <div style={{ fontWeight: 400, marginTop: '0.25rem' }}>Answer: {result.matched}</div>
      )}
      {showOverride && onOverride && (
        <button type="button" className="btn btn-ghost" style={{ marginTop: '0.6rem' }} onClick={onOverride}>
          I was right
        </button>
      )}
    </div>
  );
}
