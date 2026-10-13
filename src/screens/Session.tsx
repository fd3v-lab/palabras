import { useEffect, useMemo, useRef, useState } from 'react';
import { AnswerInput } from '../components/AnswerInput';
import { FeedbackBanner } from '../components/FeedbackBanner';
import { DiffLine } from '../components/DiffLine';
import { Chip } from '../components/Chip';
import { ProgressBar } from '../components/ProgressBar';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { RetryNotice, type RetryInfo } from '../components/RetryNotice';
import { evaluateAttempt, dontKnowResult, DEFAULT_MAX_TRIES } from '../lib/attempts';
import { wordsById, wordsInOrder, sentences, isArticledNoun, type WordContent } from '../lib/content';
import type { SentenceContent } from '../lib/sentences';
import {
  getAllWordStates,
  getAllSentenceStates,
  getSessionSettings,
  getSettings,
  saveWordState,
  saveSentenceState,
  logSession,
  getSessionDates,
  getAllConjugationStates,
  saveConjugationState,
} from '../lib/db';
import { applyGrade, createWordState, isMastered, type WordState } from '../lib/srs';
import { createSentenceState, selectSentences, type SentenceState } from '../lib/sentences';
import { gradeSentence, gradeWord, type GradeResult } from '../lib/grade';
import {
  selectNewWords,
  selectReviewWords,
  initWordSession,
  completeIntro,
  submitQuizAnswer,
  peekCard,
  isSessionDone,
  computeStreak,
  countDueBy,
  type WordSessionState,
} from '../lib/session';
import { speak } from '../lib/speech';
import { ConjugationCard } from '../components/ConjugationCard';
import { buildRows, shouldDrill, shouldInsertWordDrill, irregularPresentPersons, stateId, updateState, type ConjugationState, type DrillMode, type DrillRow } from '../lib/conjugationDrill';
import { findSentenceVerb } from '../lib/conjugate';

type Mode = 'full' | 'extra';
type Phase = 'loading' | 'words' | 'sentences' | 'summary';

interface SessionProps {
  mode: Mode;
  onExit: () => void;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function Session({ mode, onExit }: SessionProps) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [confirmQuit, setConfirmQuit] = useState(false);

  const wordStatesRef = useRef<Map<number, WordState>>(new Map());
  const sentenceStatesRef = useRef<Map<string, SentenceState>>(new Map());
  const settingsRef = useRef({ newPerSession: 10, reviewsPerSession: 20, sentencesPerSession: 3 });
  const masteredBeforeRef = useRef(0);
  const maxTriesRef = useRef(DEFAULT_MAX_TRIES);
  const conjStatesRef = useRef<Map<string, ConjugationState>>(new Map());
  const drillModeRef = useRef<DrillMode>('always');
  const vosotrosRef = useRef(false);
  const conjStatsRef = useRef({ perfect: 0, total: 0 });
  // Sentence index whose conjugation drill has been completed/skipped.
  const [drillDoneIdx, setDrillDoneIdx] = useState(-1);
  // Present-tense table shown right after a finished verb card (word phase).
  const [extraDrill, setExtraDrill] = useState<{ lemma: string; en: string; rows: DrillRow[] } | null>(null);
  const drilledRef = useRef<Set<string>>(new Set());
  const speechOnRef = useRef(true);
  const [micOn, setMicOn] = useState(true);
  const autoCheckRef = useRef(true);
  function autoSpeak(text: string | undefined) {
    if (text && speechOnRef.current) void speak(text);
  }
  const [misses, setMisses] = useState(0);
  const [retry, setRetry] = useState<RetryInfo | null>(null);
  const [selectSignal, setSelectSignal] = useState(0);

  const [wordSession, setWordSession] = useState<WordSessionState | null>(null);
  const totalWordCardsRef = useRef(0);
  const wordCardsDoneRef = useRef(0);
  // The queue advance computed at "Check" time, committed only on "Continue"
  // (so the on-screen card doesn't change while feedback for it is showing).
  const pendingSessionRef = useRef<WordSessionState | null>(null);
  const [cardUid, setCardUid] = useState(0);
  // Every fire-and-forget DB write issued during the session; awaited before
  // navigating away so Home's next stats fetch never races them.
  const pendingWritesRef = useRef<Promise<unknown>[]>([]);
  function trackWrite(p: Promise<unknown>) {
    pendingWritesRef.current.push(p);
  }

  const [sentenceQueue, setSentenceQueue] = useState<SentenceContent[]>([]);
  const [sentenceIndex, setSentenceIndex] = useState(0);

  const statsRef = useRef({ correctFirstAttempts: 0, totalFirstAttempts: 0 });

  // quiz card local state
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState<GradeResult | null>(null);

  // sentence local state
  const [sentenceInput, setSentenceInput] = useState('');
  const [sentenceFeedback, setSentenceFeedback] = useState<GradeResult | null>(null);
  const [hintsUsed, setHintsUsed] = useState<Set<number>>(new Set());
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [answerRevealed, setAnswerRevealed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [stateMap, sentStateMap, settings, appSettings, conjMap] = await Promise.all([
        getAllWordStates(),
        getAllSentenceStates(),
        getSessionSettings(),
        getSettings(),
        getAllConjugationStates(),
      ]);
      if (cancelled) return;
      maxTriesRef.current = appSettings.maxTries;
      conjStatesRef.current = conjMap;
      drillModeRef.current = appSettings.conjugationDrill;
      vosotrosRef.current = appSettings.includeVosotros;
      speechOnRef.current = appSettings.speechOn;
      autoCheckRef.current = appSettings.autoCheckSpoken;
      setMicOn(appSettings.showMic);
      wordStatesRef.current = stateMap;
      sentenceStatesRef.current = sentStateMap;
      settingsRef.current = settings;

      let mastered = 0;
      for (const s of stateMap.values()) if (isMastered(s)) mastered++;
      masteredBeforeRef.current = mastered;

      const now = Date.now();
      const newIds = mode === 'extra' ? [] : selectNewWords(wordsInOrder, stateMap, settings.newPerSession);
      const reviewIds = selectReviewWords(stateMap, settings.reviewsPerSession, now, new Set(newIds));

      for (const id of [...newIds, ...reviewIds]) {
        if (!stateMap.has(id)) stateMap.set(id, createWordState(id, now));
      }

      const session = initWordSession(newIds, reviewIds);
      totalWordCardsRef.current = session.queue.length;
      setWordSession(session);
      setPhase('words');
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // ---- word phase ----

  const currentCard = wordSession ? peekCard(wordSession) : null;
  const currentWord: WordContent | null = currentCard ? (wordsById.get(currentCard.wordId) ?? null) : null;

  function handleGotIt() {
    if (!wordSession || !currentCard) return;
    const now = Date.now();
    const st = wordStatesRef.current.get(currentCard.wordId);
    if (st) {
      const updated = { ...st, introduced: true, lastSeen: now };
      wordStatesRef.current.set(currentCard.wordId, updated);
      trackWrite(saveWordState(updated));
    }
    wordCardsDoneRef.current++;
    setCardUid((n) => n + 1);
    const next = completeIntro(wordSession);
    setWordSession(next);
    if (isSessionDone(next)) finishWordPhase();
  }

  /** "Check": grade the answer and show feedback, but keep the same card on
   *  screen — the queue is only advanced once "Continue" is pressed. */
  function handleQuizCheck(text: string = input) {
    if (!wordSession || !currentCard || !currentWord || feedback) return;
    const now = Date.now();
    const st = wordStatesRef.current.get(currentCard.wordId) ?? createWordState(currentCard.wordId, now);
    const accepted = [...currentWord.accept, ...st.userAccepted];
    const raw = gradeWord(text, currentWord.es, accepted);
    const step = evaluateAttempt(raw, misses, maxTriesRef.current, { canonical: currentWord.es });
    if (step.kind === 'retry') {
      setMisses(step.misses);
      setRetry(step);
      setSelectSignal((n) => n + 1);
      return;
    }
    gradeAndStage({ ...step.result, grade: step.grade }, st, currentCard.wordId, now);
  }

  function handleSpokenWord(text: string) {
    setInput(text);
    if (autoCheckRef.current && text.trim()) handleQuizCheck(text);
    else setSelectSignal((n) => n + 1);
  }

  function handleDontKnow() {
    if (!wordSession || !currentCard || !currentWord || feedback) return;
    const now = Date.now();
    const st = wordStatesRef.current.get(currentCard.wordId) ?? createWordState(currentCard.wordId, now);
    const result = dontKnowResult(currentWord.es);
    gradeAndStage(result, st, currentCard.wordId, now);
  }

  function gradeAndStage(result: GradeResult, st: WordState, wordId: number, now: number) {
    if (!wordSession) return;
    const { state: nextSession, applySrs } = submitQuizAnswer(wordSession, result.grade);
    // Stage the queue advance; don't commit it until "Continue".
    pendingSessionRef.current = nextSession;

    if (applySrs) {
      statsRef.current.totalFirstAttempts++;
      if (result.grade === 'good') statsRef.current.correctFirstAttempts++;
      const updated = applyGrade(st, result.grade, { now });
      wordStatesRef.current.set(wordId, updated);
      trackWrite(saveWordState(updated));
    }

    setFeedback(result);
    setRetry(null);
    autoSpeak(currentWord?.es);
  }

  /** "Continue": commit the previously staged queue advance and move on. */
  function handleQuizContinue() {
    if (!feedback) return;
    const next = pendingSessionRef.current;
    pendingSessionRef.current = null;
    setWordSession(next);
    setInput('');
    setFeedback(null);
    setRetry(null);
    setMisses(0);
    wordCardsDoneRef.current++;
    setCardUid((n) => n + 1);
    const w = currentWord;
    if (w && shouldInsertWordDrill(w.pos, w.lemma, drilledRef.current)) {
      const rows = buildRows(w.lemma, 'present', vosotrosRef.current);
      if (rows) {
        drilledRef.current.add(stateId(w.lemma, 'present'));
        totalWordCardsRef.current++;
        setExtraDrill({ lemma: w.lemma, en: w.en.split(/[,;]/)[0].trim(), rows });
        return;
      }
    }
    if (next && isSessionDone(next)) {
      finishWordPhase();
    }
  }

  function handleExtraDrillFinished(firstTry: number, total: number) {
    if (!extraDrill) return;
    const id = stateId(extraDrill.lemma, 'present');
    const updated = updateState(conjStatesRef.current.get(id), id, firstTry, total, Date.now());
    conjStatesRef.current.set(id, updated);
    trackWrite(saveConjugationState(updated));
    conjStatsRef.current.total++;
    if (firstTry === total) conjStatsRef.current.perfect++;
  }

  function handleExtraDrillContinue() {
    setExtraDrill(null);
    wordCardsDoneRef.current++;
    setCardUid((n) => n + 1);
    if (wordSession && isSessionDone(wordSession)) finishWordPhase();
  }

  function handleQuizSubmit() {
    if (feedback) {
      handleQuizContinue();
    } else {
      handleQuizCheck();
    }
  }

  function handleOverride() {
    if (!currentCard || !currentWord || !feedback || !wordSession) return;
    const now = Date.now();
    const st = wordStatesRef.current.get(currentCard.wordId);
    if (st) {
      const withAccepted = { ...st, userAccepted: [...st.userAccepted, input] };
      const updated = applyGrade(withAccepted, 'good', { now });
      wordStatesRef.current.set(currentCard.wordId, updated);
      trackWrite(saveWordState(updated));
    }
    // Recompute the staged queue advance as "good" (from the still-uncommitted
    // wordSession) so the card no longer re-queues after being marked correct.
    const { state: nextSession } = submitQuizAnswer(wordSession, 'good');
    pendingSessionRef.current = nextSession;
    setFeedback({ ...feedback, outcome: 'correct', grade: 'good', note: undefined });
  }

  function finishWordPhase() {
    const settings = settingsRef.current;
    const now = Date.now();
    if (mode === 'extra' || settings.sentencesPerSession === 0) {
      setPhase('summary');
      finishSession();
      return;
    }
    const todayNewIds = new Set(wordSession?.introducedIds ?? []);
    const picked = selectSentences(
      sentences,
      wordStatesRef.current,
      sentenceStatesRef.current,
      todayNewIds,
      settings.sentencesPerSession,
      { now },
    );
    setSentenceQueue(picked);
    setSentenceIndex(0);
    if (picked.length === 0) {
      setPhase('summary');
      finishSession();
    } else {
      setPhase('sentences');
    }
  }

  // ---- sentence phase ----

  const currentSentence = sentenceQueue[sentenceIndex] ?? null;

  const activeDrill = useMemo(() => {
    if (phase !== 'sentences' || !currentSentence || drillDoneIdx === sentenceIndex) return null;
    const found = findSentenceVerb(
      { grammar: currentSentence.grammar, tokens: currentSentence.tokens as { t: string; id: number }[] },
      (id) => wordsById.get(id)?.lemma,
    );
    if (!found) return null;
    if (drilledRef.current.has(stateId(found.lemma, found.tense))) return null;
    if (!shouldDrill(drillModeRef.current, conjStatesRef.current.get(stateId(found.lemma, found.tense)))) return null;
    const rows = buildRows(found.lemma, found.tense, vosotrosRef.current);
    if (!rows) return null;
    const word = [...wordsById.values()].find((w) => w.lemma === found.lemma);
    const en = (word?.en ?? '').split(/[,;]/)[0].trim();
    return { found, rows, en };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, sentenceIndex, drillDoneIdx, currentSentence]);

  function handleDrillFinished(firstTry: number, total: number) {
    if (!activeDrill) return;
    const id = stateId(activeDrill.found.lemma, activeDrill.found.tense);
    const updated = updateState(conjStatesRef.current.get(id), id, firstTry, total, Date.now());
    conjStatesRef.current.set(id, updated);
    trackWrite(saveConjugationState(updated));
    conjStatsRef.current.total++;
    if (firstTry === total) conjStatsRef.current.perfect++;
    drilledRef.current.add(id);
  }

  function tapChip(tokenKey: string, tokenId: number | null, countsAsHint: boolean) {
    setRevealed((r) => ({ ...r, [tokenKey]: true }));
    if (tokenId !== null && countsAsHint) {
      setHintsUsed((prev) => {
        const next = new Set(prev);
        next.add(tokenId);
        return next;
      });
    }
  }

  function handleSpokenSentence(text: string) {
    setSentenceInput(text);
    if (autoCheckRef.current && text.trim()) handleSentenceSubmit(text);
    else setSelectSignal((n) => n + 1);
  }

  function handleSentenceSubmit(text: string = sentenceInput) {
    if (!currentSentence) return;
    if (sentenceFeedback) {
      nextSentence();
      return;
    }
    const now = Date.now();
    const st = sentenceStatesRef.current.get(currentSentence.id) ?? createSentenceState(currentSentence.id);
    const accepted = [...currentSentence.alt, ...st.userAccepted];
    const raw = gradeSentence(text, currentSentence.es, accepted);
    const step = evaluateAttempt(raw, misses, maxTriesRef.current, {
      isSentence: true,
      canonical: currentSentence.es,
      input: text,
    });
    if (step.kind === 'retry') {
      setMisses(step.misses);
      setRetry(step);
      setSelectSignal((n) => n + 1);
      return;
    }
    const result: GradeResult = { ...step.result, grade: step.grade };

    applySentenceSideEffects(currentSentence, result, now);

    const updatedState: SentenceState = {
      ...st,
      seen: st.seen + 1,
      correct: st.correct + (result.grade === 'good' ? 1 : 0),
      lastSeen: now,
    };
    sentenceStatesRef.current.set(currentSentence.id, updatedState);
    trackWrite(saveSentenceState(updatedState));

    setSentenceFeedback(result);
    setAnswerRevealed(true);
    setRetry(null);
    autoSpeak(currentSentence.es);
  }

  function applySentenceSideEffects(sentence: SentenceContent, result: GradeResult, now: number) {
    const noHints = hintsUsed.size === 0;
    for (const tok of sentence.tokens) {
      if (tok.id === null) continue;
      const st = wordStatesRef.current.get(tok.id);
      if (!st?.introduced) continue;
      if (hintsUsed.has(tok.id)) {
        const updated = { ...st, due: now };
        wordStatesRef.current.set(tok.id, updated);
        trackWrite(saveWordState(updated));
      } else if (result.grade === 'good' && noHints) {
        const updated = { ...st, lastSeen: now };
        wordStatesRef.current.set(tok.id, updated);
        trackWrite(saveWordState(updated));
      }
    }
  }

  function handleSentenceOverride() {
    if (!currentSentence || !sentenceFeedback) return;
    const st = sentenceStatesRef.current.get(currentSentence.id);
    if (st) {
      const updated: SentenceState = {
        ...st,
        userAccepted: [...st.userAccepted, sentenceInput],
        correct: sentenceFeedback.grade === 'good' ? st.correct : st.correct + 1,
      };
      sentenceStatesRef.current.set(currentSentence.id, updated);
      trackWrite(saveSentenceState(updated));
    }
    setSentenceFeedback({ ...sentenceFeedback, outcome: 'correct', grade: 'good', note: undefined });
  }

  function handleSentenceDontKnow() {
    if (!currentSentence || sentenceFeedback) return;
    const now = Date.now();
    const st = sentenceStatesRef.current.get(currentSentence.id) ?? createSentenceState(currentSentence.id);
    const result: GradeResult = {
      ...dontKnowResult(currentSentence.es),
      diff: gradeSentence(sentenceInput, currentSentence.es, currentSentence.alt).diff,
    };
    applySentenceSideEffects(currentSentence, result, now);
    const updatedState: SentenceState = { ...st, seen: st.seen + 1, lastSeen: now };
    sentenceStatesRef.current.set(currentSentence.id, updatedState);
    trackWrite(saveSentenceState(updatedState));
    setSentenceFeedback(result);
    setAnswerRevealed(true);
    setRetry(null);
    autoSpeak(currentSentence.es);
  }

  function nextSentence() {
    setMisses(0);
    setRetry(null);
    setSentenceInput('');
    setSentenceFeedback(null);
    setHintsUsed(new Set());
    setRevealed({});
    setAnswerRevealed(false);
    if (sentenceIndex + 1 >= sentenceQueue.length) {
      setPhase('summary');
      finishSession();
    } else {
      setSentenceIndex((i) => i + 1);
    }
  }

  const finishedRef = useRef(false);
  function finishSession() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    trackWrite(
      logSession({
        completedAt: Date.now(),
        newWords: wordSession?.introducedIds.size ?? 0,
        correct: statsRef.current.correctFirstAttempts,
        total: statsRef.current.totalFirstAttempts,
      }),
    );
  }

  /** Await every DB write issued so far before navigating away, so Home's
   *  next stats fetch never races an in-flight save. */
  async function exitAfterWrites() {
    await Promise.all(pendingWritesRef.current);
    onExit();
  }

  // ---- summary data ----
  const [summary, setSummary] = useState<{
    newWords: number;
    accuracy: number;
    masteredNow: number;
    streak: number;
    dueTomorrow: number;
    conjPerfect: number;
    conjTotal: number;
  } | null>(null);

  useEffect(() => {
    if (phase !== 'summary') return;
    let cancelled = false;
    (async () => {
      const dates = await getSessionDates();
      if (cancelled) return;
      let masteredNow = 0;
      for (const s of wordStatesRef.current.values()) if (isMastered(s)) masteredNow++;
      const { correctFirstAttempts, totalFirstAttempts } = statsRef.current;
      setSummary({
        newWords: wordSession?.introducedIds.size ?? 0,
        accuracy: totalFirstAttempts > 0 ? Math.round((correctFirstAttempts / totalFirstAttempts) * 100) : 100,
        masteredNow: Math.max(0, masteredNow - masteredBeforeRef.current),
        streak: computeStreak(dates, Date.now()),
        dueTomorrow: countDueBy(wordStatesRef.current, Date.now() + MS_PER_DAY),
        conjPerfect: conjStatsRef.current.perfect,
        conjTotal: conjStatsRef.current.total,
      });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ---- keyboard: Escape to quit, Enter to submit/continue ----
  // A single centralized listener so a given keypress only ever triggers one
  // action (no double-fire between an input's own key handler and this one).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setConfirmQuit(true);
        return;
      }
      if (e.key !== 'Enter' || e.repeat) return;
      if (confirmQuit) return;
      if (extraDrill) return;
      if (phase === 'sentences' && activeDrill) return; // the drill card handles its own Enter

      if (phase === 'words') {
        if (!currentCard) return;
        if (currentCard.type === 'intro') {
          handleGotIt();
        } else {
          handleQuizSubmit();
        }
      } else if (phase === 'sentences') {
        if (!currentSentence) return;
        handleSentenceSubmit();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, confirmQuit, activeDrill, extraDrill, currentCard, feedback, currentSentence, sentenceFeedback, input, sentenceInput, misses]);

  const progress = useMemo(() => {
    if (phase === 'words') {
      const total = totalWordCardsRef.current || 1;
      return { value: Math.min(wordCardsDoneRef.current, total), total };
    }
    if (phase === 'sentences') {
      return { value: sentenceIndex, total: sentenceQueue.length || 1 };
    }
    return { value: 1, total: 1 };
  }, [phase, sentenceIndex, wordSession, extraDrill]);

  if (phase === 'loading') {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading…</div>;
  }

  return (
    <div className="stack" style={{ padding: '1.25rem', maxWidth: 480, margin: '0 auto', width: '100%' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button className="btn btn-ghost" onClick={() => setConfirmQuit(true)} aria-label="Quit session">
          ✕
        </button>
        <div style={{ flex: 1, margin: '0 1rem' }}>
          <ProgressBar value={progress.value} total={progress.total} />
        </div>
      </div>

      <ConfirmDialog
        open={confirmQuit}
        title="Quit session?"
        message="Progress already answered is kept."
        confirmLabel="Quit"
        cancelLabel="Keep going"
        danger
        onCancel={() => setConfirmQuit(false)}
        onConfirm={exitAfterWrites}
      />

      {!confirmQuit && phase === 'words' && extraDrill && (
        <ConjugationCard
          key={`extra-drill-${cardUid}`}
          lemma={extraDrill.lemma}
          en={extraDrill.en}
          tense="present"
          rows={extraDrill.rows}
          maxTries={maxTriesRef.current}
          onFinished={handleExtraDrillFinished}
          onContinue={handleExtraDrillContinue}
        />
      )}

      {!confirmQuit && phase === 'words' && !extraDrill && currentCard && currentWord && (
        <WordCardView
          key={cardUid}
          card={currentCard}
          word={currentWord}
          input={input}
          setInput={setInput}
          feedback={feedback}
          retry={retry}
          selectSignal={selectSignal}
          onSpeak={autoSpeak}
          onGotIt={handleGotIt}
          onSubmit={handleQuizSubmit}
          onSpoken={micOn ? handleSpokenWord : undefined}
          onDontKnow={handleDontKnow}
          onOverride={handleOverride}
          vosotros={vosotrosRef.current}
        />
      )}

      {!confirmQuit && phase === 'sentences' && currentSentence && activeDrill && (
        <ConjugationCard
          key={`drill-${sentenceIndex}`}
          lemma={activeDrill.found.lemma}
          en={activeDrill.en}
          tense={activeDrill.found.tense}
          rows={activeDrill.rows}
          targetPerson={activeDrill.found.person}
          maxTries={maxTriesRef.current}
          onFinished={handleDrillFinished}
          onContinue={() => setDrillDoneIdx(sentenceIndex)}
        />
      )}

      {!confirmQuit && phase === 'sentences' && currentSentence && !activeDrill && (
        <SentenceCardView
          key={sentenceIndex}
          sentence={currentSentence}
          input={sentenceInput}
          setInput={setSentenceInput}
          feedback={sentenceFeedback}
          retry={retry}
          selectSignal={selectSignal}
          onDontKnow={handleSentenceDontKnow}
          revealed={revealed}
          answerRevealed={answerRevealed}
          isIntroduced={(id) => (id !== null ? (wordStatesRef.current.get(id)?.introduced ?? false) : true)}
          onTapChip={tapChip}
          onSubmit={() => handleSentenceSubmit()}
          onSpoken={micOn ? handleSpokenSentence : undefined}
          onSpeak={autoSpeak}
          onOverride={handleSentenceOverride}
        />
      )}

      {!confirmQuit && phase === 'summary' && summary && (
        <div className="card stack">
          <h2 style={{ margin: 0 }}>Session complete</h2>
          <div>New words learned: {summary.newWords}</div>
          <div>Accuracy: {summary.accuracy}%</div>
          <div>Newly mastered: {summary.masteredNow}</div>
          <div>Streak: {summary.streak} day(s)</div>
          {summary.conjTotal > 0 && (
            <div>
              Conjugation tables: {summary.conjPerfect}/{summary.conjTotal} perfect
            </div>
          )}
          <div className="text-muted">Come back tomorrow: {summary.dueTomorrow} reviews due</div>
          <button className="btn btn-primary btn-block" onClick={exitAfterWrites}>
            Done
          </button>
        </div>
      )}
    </div>
  );
}

interface WordCardViewProps {
  card: NonNullable<ReturnType<typeof peekCard>>;
  word: WordContent;
  input: string;
  setInput: (v: string) => void;
  feedback: GradeResult | null;
  retry: RetryInfo | null;
  selectSignal: number;
  onSpeak: (text: string | undefined) => void;
  onSpoken?: (text: string) => void;
  onGotIt: () => void;
  onSubmit: () => void;
  onDontKnow: () => void;
  onOverride: () => void;
  vosotros: boolean;
}

function WordCardView({ card, word, input, setInput, feedback, retry, selectSignal, onSpeak, onSpoken, onGotIt, onSubmit, onDontKnow, onOverride, vosotros }: WordCardViewProps) {
  const spokenRef = useRef(false); // survives StrictMode's simulated remount
  useEffect(() => {
    if (spokenRef.current) return;
    spokenRef.current = true;
    if (card.type === 'intro') onSpeak(word.es);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (card.type === 'intro') {
    return (
      <div className="card stack">
        <div className="text-muted">New word</div>
        <div style={{ fontSize: '1.1rem' }}>{word.en}</div>
        <div style={{ fontSize: '2rem', fontWeight: 700 }}>{word.es}</div>
        {word.gender && <div className="text-muted">gender: {word.gender}</div>}
        <div className="card" style={{ background: 'var(--surface-2)' }}>
          <div>{word.example.es}</div>
          <div className="text-muted">{word.example.en}</div>
        </div>
        {word.pos === 'verb' && <PresentTable lemma={word.lemma} vosotros={vosotros} />}
        <button className="btn btn-ghost" onClick={() => speak(word.es, { explicit: true })}>
          🔊 Listen
        </button>
        <button className="btn btn-primary btn-block" onClick={onGotIt}>
          Got it
        </button>
      </div>
    );
  }

  const isNoun = isArticledNoun(word);

  return (
    <div className="card stack">
      <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{word.en}</div>
      {word.hint && <div className="text-muted">{word.hint}</div>}
      {isNoun && <div className="text-muted">(noun — include article)</div>}
      <AnswerInput value={input} onChange={setInput} disabled={!!feedback} selectSignal={selectSignal} onSpoken={onSpoken} />
      {retry && !feedback && <RetryNotice info={retry} />}
      {feedback && <FeedbackBanner result={feedback} onOverride={onOverride} showOverride={feedback.outcome !== 'correct' && feedback.outcome !== 'accent'} />}
      <div className="row">
        {!feedback && (
          <button className="btn btn-ghost" onClick={onDontKnow}>
            Don't know
          </button>
        )}
        <button className="btn btn-primary btn-block" onClick={onSubmit}>
          {feedback ? 'Continue' : 'Check'}
        </button>
      </div>
    </div>
  );
}

interface SentenceCardViewProps {
  sentence: SentenceContent;
  input: string;
  setInput: (v: string) => void;
  feedback: GradeResult | null;
  retry: RetryInfo | null;
  selectSignal: number;
  onDontKnow: () => void;
  onSpoken?: (text: string) => void;
  onSpeak: (text: string | undefined) => void;
  revealed: Record<string, boolean>;
  answerRevealed: boolean;
  isIntroduced: (id: number | null) => boolean;
  onTapChip: (tokenKey: string, tokenId: number | null, countsAsHint: boolean) => void;
  onSubmit: () => void;
  onOverride: () => void;
}

function SentenceCardView({
  sentence,
  input,
  setInput,
  feedback,
  retry,
  selectSignal,
  onDontKnow,
  onSpoken,
  revealed,
  answerRevealed,
  isIntroduced,
  onTapChip,
  onSubmit,
  onOverride,
}: SentenceCardViewProps) {
  return (
    <div className="card stack">
      <div style={{ fontSize: '1.3rem', fontWeight: 600 }}>{sentence.en}</div>

      {!answerRevealed && (
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {sentence.tokens.map((tok, i) => {
            const key = `hint-${i}`;
            const known = isIntroduced(tok.id);
            return (
              <Chip
                key={key}
                label={tok.gloss}
                revealed={revealed[key] ? `${tok.t} · ${tok.form ?? tok.gloss}` : undefined}
                isNew={!known}
                muted={known}
                onTap={() => onTapChip(key, tok.id, true)}
              />
            );
          })}
        </div>
      )}

      <AnswerInput value={input} onChange={setInput} disabled={!!feedback} placeholder="Type the Spanish sentence" selectSignal={selectSignal} onSpoken={onSpoken} />
      {retry && !feedback && <RetryNotice info={retry} />}

      {feedback && (
        <>
          <FeedbackBanner result={feedback} onOverride={onOverride} showOverride={feedback.outcome !== 'correct' && feedback.outcome !== 'accent'} />
          {feedback.diff && <DiffLine diff={feedback.diff} />}
          <button className="btn btn-ghost" onClick={() => speak(sentence.es, { explicit: true })}>
            🔊 Listen
          </button>
          <div className="card" style={{ background: 'var(--surface-2)' }}>
            <div className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '0.4rem' }}>
              Tap a word for its meaning
            </div>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              {sentence.tokens.map((tok, i) => {
                const key = `answer-${i}`;
                return (
                  <Chip
                    key={key}
                    label={tok.t}
                    revealed={revealed[key] ? `${tok.t}: ${tok.gloss}${tok.form ? ' · ' + tok.form : ''}` : undefined}
                    onTap={() => onTapChip(key, tok.id, false)}
                  />
                );
              })}
            </div>
            <div className="stack" style={{ marginTop: '0.5rem' }}>
              {sentence.tokens
                .filter((t) => t.form)
                .map((t, i) => (
                  <div key={i} className="text-muted" style={{ fontSize: '0.85rem' }}>
                    {t.t} → {t.form}
                  </div>
                ))}
            </div>
          </div>
        </>
      )}

      <div className="row">
        {!feedback && (
          <button className="btn btn-ghost" onClick={onDontKnow}>
            Don't know
          </button>
        )}
        <button className="btn btn-primary btn-block" onClick={onSubmit}>
          {feedback ? 'Continue' : 'Check'}
        </button>
      </div>
    </div>
  );
}

function PresentTable({ lemma, vosotros }: { lemma: string; vosotros: boolean }) {
  const rows = buildRows(lemma, 'present', vosotros);
  if (!rows) return null;
  const irregular = irregularPresentPersons(lemma);
  return (
    <div className="card" style={{ background: 'var(--surface-2)', padding: '0.6rem' }} data-testid="present-table">
      <div className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '0.3rem' }}>
        Present tense
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.25rem 0.5rem', alignItems: 'center' }}>
        {rows.map((r) => (
          <div key={r.person} style={{ display: 'contents' }}>
            <div className="text-muted" style={{ fontSize: '0.8rem' }}>
              {r.label}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', justifyContent: 'flex-end' }}>
              <span style={irregular.has(r.person) ? { fontWeight: 700, color: 'var(--accent)' } : undefined}>{r.answer}</span>
              <button className="btn btn-ghost" style={{ padding: '0 0.3rem' }} aria-label={`Listen ${r.answer}`} onClick={() => speak(r.answer, { explicit: true })}>
                🔊
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
