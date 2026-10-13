import { useEffect, useState } from 'react';
import { ProgressRing } from '../components/ProgressRing';
import { words } from '../lib/content';
import { getAllWordStates, getSessionDates } from '../lib/db';
import { isMastered } from '../lib/srs';
import { computeStreak, countDueBy, endOfTodayMs } from '../lib/session';

interface HomeStats {
  introduced: number;
  mastered: number;
  dueToday: number;
  streak: number;
}

interface HomeProps {
  onStartSession: () => void;
  onExtraReviews: () => void;
  onOpenWords: () => void;
  onOpenSettings: () => void;
}

export function Home({ onStartSession, onExtraReviews, onOpenWords, onOpenSettings }: HomeProps) {
  const [stats, setStats] = useState<HomeStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [stateMap, sessionDates] = await Promise.all([getAllWordStates(), getSessionDates()]);
      if (cancelled) return;
      const now = Date.now();
      let introduced = 0;
      let mastered = 0;
      for (const s of stateMap.values()) {
        if (s.introduced) introduced++;
        if (isMastered(s)) mastered++;
      }
      setStats({
        introduced,
        mastered,
        dueToday: countDueBy(stateMap, endOfTodayMs(now)),
        streak: computeStreak(sessionDates, now),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="stack" style={{ padding: '1.25rem', maxWidth: 480, margin: '0 auto', width: '100%' }}>
      <header className="row" style={{ justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '1.6rem', margin: 0 }}>Palabras</h1>
        <button className="btn btn-ghost" onClick={onOpenSettings} aria-label="Settings">
          ⚙️
        </button>
      </header>

      <div className="card row" style={{ justifyContent: 'space-around' }}>
        <ProgressRing value={stats?.introduced ?? 0} total={words.length} label="learned" />
        <div className="stack" style={{ gap: '0.5rem', alignItems: 'flex-start' }}>
          <div>
            <strong style={{ fontSize: '1.4rem' }}>{stats?.mastered ?? 0}</strong>
            <div className="text-muted">mastered</div>
          </div>
          <div>
            <strong style={{ fontSize: '1.4rem' }}>{stats?.dueToday ?? 0}</strong>
            <div className="text-muted">due today</div>
          </div>
          <div>
            <strong style={{ fontSize: '1.4rem' }}>{stats?.streak ?? 0}🔥</strong>
            <div className="text-muted">day streak</div>
          </div>
        </div>
      </div>

      <button className="btn btn-primary btn-block" style={{ fontSize: '1.2rem', padding: '1.1rem' }} onClick={onStartSession}>
        Start session
      </button>
      <button className="btn btn-block" onClick={onExtraReviews}>
        Extra reviews
      </button>
      <button className="btn btn-ghost btn-block" onClick={onOpenWords}>
        Browse words
      </button>
    </div>
  );
}
