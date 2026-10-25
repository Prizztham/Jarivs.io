/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Zap,
  Clock,
  ArrowRight,
  Shield,
  Lightbulb,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  BookOpen,
  Search,
  Flag,
  Loader2,
  ChevronRight,
  ExternalLink,
  Lock,
  Unlock,
  Check,
  Video,
  FileText,
} from 'lucide-react';
import {
  AppConfig,
  AppMode,
  ClassicAnswerData,
  DomainItem,
  Session,
  TimeBudget,
  TopicCheckpoint,
  TopicSessionData,
  UserProfile,
} from '../types';
import { aiService, ScoreCheckpointResult } from '../services/aiService';
import { Storage } from '../utils/storage';
import {
  calculateAttemptPoints,
  countWords,
} from '../utils/rules';
import { getRandomQuote } from '../utils/quotes';
import { FlagIssueModal } from './FlagIssueModal';

interface AskViewProps {
  user: UserProfile;
  config: AppConfig;
  domains: DomainItem[];
  initialQuestion?: string;
  onOpenRehearsalWithText: (text: string) => void;
  onRefreshUserData: () => void;
}

type AskStage =
  | 'input'
  | 'think_first'
  | 'two_options'
  | 'topic_coach'
  | 'topic_summary';

export const AskView: React.FC<AskViewProps> = ({
  user,
  config,
  domains,
  initialQuestion = '',
  onOpenRehearsalWithText,
  onRefreshUserData,
}) => {
  // Query & Options
  const [question, setQuestion] = useState(initialQuestion);
  const [selectedDomainId, setSelectedDomainId] = useState<string>(
    domains.find(d => d.isGrowth)?.id || domains[0]?.id || 'dom_writing'
  );
  const [mode, setMode] = useState<AppMode>('help_me_grow');
  const [timeBudget, setTimeBudget] = useState<TimeBudget>('5m');

  // Stage state machine
  const [stage, setStage] = useState<AskStage>('input');

  // Think-First state
  const [userTake, setUserTake] = useState('');
  const [confidencePct, setConfidencePct] = useState(70);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [motivationalQuote, setMotivationalQuote] = useState(getRandomQuote());
  const [meaningfulWarning, setMeaningfulWarning] = useState<string | null>(null);

  // Classic Answer state
  const [classicAnswer, setClassicAnswer] = useState<ClassicAnswerData | null>(null);

  // Topic Coaching state (PRD V2 Section 6)
  const [topicSession, setTopicSession] = useState<TopicSessionData | null>(null);
  const [currentCheckpointIndex, setCurrentCheckpointIndex] = useState(0);
  const [revealedHintIndex, setRevealedHintIndex] = useState(0);
  const [checkpointAnswers, setCheckpointAnswers] = useState<Record<number, string>>({});
  const [checkpointScores, setCheckpointScores] = useState<Record<number, ScoreCheckpointResult>>({});
  const [isScoringCheckpoint, setIsScoringCheckpoint] = useState(false);
  const [hintsUsedTotal, setHintsUsedTotal] = useState(0);
  const [topicConfidence, setTopicConfidence] = useState(75);

  // AI-first penalty confirm modal
  const [showAiFirstWarning, setShowAiFirstWarning] = useState(false);
  const [pendingAiFirstAction, setPendingAiFirstAction] = useState<(() => void) | null>(null);

  // Scheduled AI Lock override modal
  const [showScheduledLockModal, setShowScheduledLockModal] = useState(false);
  const [typedUnlockPhrase, setTypedUnlockPhrase] = useState('');
  const REQUIRED_UNLOCK_PHRASE = 'I am choosing convenience over deliberate practice';

  // Flag issue modal
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [activeSnippetForFlag, setActiveSnippetForFlag] = useState('');

  // AI loading and error states
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryAction, setRetryAction] = useState<(() => void) | null>(null);

  // Current session tracking
  const [currentSessionId, setCurrentSessionId] = useState<string>(`sess_${Date.now()}`);
  const [currentAttemptId, setCurrentAttemptId] = useState<string | null>(null);

  // Selected domain object
  const currentDomain = domains.find(d => d.id === selectedDomainId) || domains[0];
  const isGrowthDomain = currentDomain?.isGrowth;

  // Check Scheduled AI Lock state
  const isScheduledLocked = useMemo(() => {
    if (!user.aiLockSchedule?.enabled) return false;
    if (!isGrowthDomain) return false; // Lock applies only to growth domains
    // If urgent override is active
    if (user.urgentOverrideUntil && user.urgentOverrideUntil > Date.now()) return false;

    const now = new Date();
    const day = now.getDay(); // 0 = Sun .. 6 = Sat
    const scheduleDays = user.aiLockSchedule.days || [1, 2, 3, 4, 5];
    if (!scheduleDays.includes(day)) return false;

    const hour = now.getHours();
    const start = user.aiLockSchedule.startHour;
    const end = user.aiLockSchedule.endHour;

    if (start <= end) {
      return hour >= start && hour < end;
    } else {
      // Overnight lock
      return hour >= start || hour < end;
    }
  }, [user.aiLockSchedule, isGrowthDomain, user.urgentOverrideUntil]);

  // Unlock hour label
  const unlockHourLabel = useMemo(() => {
    if (!user.aiLockSchedule) return '';
    const end = user.aiLockSchedule.endHour;
    return `${end}:00`;
  }, [user.aiLockSchedule]);

  // Timer for Think-First soft target
  useEffect(() => {
    let interval: any;
    if (stage === 'think_first') {
      interval = setInterval(() => {
        setElapsedSeconds(s => s + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [stage]);

  // Auto-suggest domain based on keywords in query
  useEffect(() => {
    if (stage !== 'input') return;
    const qLower = question.toLowerCase();
    if (qLower.includes('hire') || qLower.includes('candidate') || qLower.includes('interview')) {
      const d = domains.find(x => x.name.toLowerCase().includes('hiring'));
      if (d) setSelectedDomainId(d.id);
    } else if (qLower.includes('data') || qLower.includes('churn') || qLower.includes('metric') || qLower.includes('analysis')) {
      const d = domains.find(x => x.name.toLowerCase().includes('analysis'));
      if (d) setSelectedDomainId(d.id);
    } else if (qLower.includes('memo') || qLower.includes('email') || qLower.includes('draft') || qLower.includes('write')) {
      const d = domains.find(x => x.name.toLowerCase().includes('writing'));
      if (d) setSelectedDomainId(d.id);
    } else if (qLower.includes('decide') || qLower.includes('tradeoff') || qLower.includes('choice') || qLower.includes('strategy')) {
      const d = domains.find(x => x.name.toLowerCase().includes('decision'));
      if (d) setSelectedDomainId(d.id);
    }
  }, [question, domains, stage]);

  // When domain changes, set mode default
  useEffect(() => {
    if (isGrowthDomain) {
      setMode('help_me_grow');
    } else {
      setMode('get_it_done');
    }
  }, [selectedDomainId, isGrowthDomain]);

  // Execute AI-first generation after all checks & confirmations
  const executeDirectClassicAnswer = (newSessionId: string) => {
    fetchClassicAnswer(newSessionId, true);
  };

  // Handle Start Ask
  const handleStartAsk = () => {
    if (!question.trim()) return;

    const newSessionId = `sess_${Date.now()}`;
    setCurrentSessionId(newSessionId);

    // If "Get it done" (AI-first) mode selected
    if (mode === 'get_it_done') {
      // 1. Check if Scheduled Lock is active in growth domain
      if (isScheduledLocked) {
        setTypedUnlockPhrase('');
        setPendingAiFirstAction(() => () => executeDirectClassicAnswer(newSessionId));
        setShowScheduledLockModal(true);
        return;
      }

      // 2. In growth domain, if no own take was submitted, show confirmation warning modal (PRD Section 7)
      if (isGrowthDomain) {
        setPendingAiFirstAction(() => () => {
          // Apply 10-point deduction to internal points/reward logic
          Storage.addPointEvent({
            id: `pt_pen_${Date.now()}`,
            type: 'classic_without_take_penalty',
            points: -10,
            domainId: currentDomain.id,
            sessionId: newSessionId,
            description: `Direct AI-first action in growth domain without own take (-10 pts)`,
            createdAt: new Date().toISOString(),
          });
          onRefreshUserData();
          executeDirectClassicAnswer(newSessionId);
        });
        setShowAiFirstWarning(true);
        return;
      }

      // Delegation domain: instant answer with zero penalty
      executeDirectClassicAnswer(newSessionId);
      return;
    }

    // "Help me grow" mode: Transition to Think-First
    setStage('think_first');
    setElapsedSeconds(0);
    setUserTake('');
    setMeaningfulWarning(null);
    setMotivationalQuote(getRandomQuote());
  };

  // Fetch Classic Answer
  const fetchClassicAnswer = async (sessId: string, usedClassicOnly: boolean) => {
    setIsLoading(true);
    setLoadingMessage('Consulting Gemini for authoritative synthesis & assumptions...');
    setErrorMessage(null);

    const action = () => fetchClassicAnswer(sessId, usedClassicOnly);
    setRetryAction(() => action);

    const result = await aiService.classicAnswer(question, currentDomain.name);
    setIsLoading(false);

    if (result.error || !result.data) {
      setErrorMessage(result.error || 'Failed to generate classic answer.');
      return;
    }

    setClassicAnswer(result.data);

    // Save session
    const session: Session = {
      id: sessId,
      domainId: currentDomain.id,
      mode,
      question,
      timeBudget,
      createdAt: new Date().toISOString(),
      usedClassicOnly,
      hintDepth: 0,
      classicAnswer: result.data,
      attemptId: currentAttemptId || undefined,
    };
    Storage.addSession(session);
    Storage.logAnalyticsEvent('ask_submitted', { domain: currentDomain.name, mode, timeBudget });

    if (usedClassicOnly) {
      setStage('two_options');
    }
  };

  // Submit First Take in Think-First Window
  const handleSubmitTake = async () => {
    if (!userTake.trim()) return;

    setIsLoading(true);
    setLoadingMessage('Evaluating your take for relevance and substance...');
    setErrorMessage(null);

    const action = () => handleSubmitTake();
    setRetryAction(() => action);

    const result = await aiService.scoreAttempt(question, userTake.trim());
    setIsLoading(false);

    if (result.error || !result.data) {
      setErrorMessage(result.error || 'Evaluation timed out. Please retry.');
      return;
    }

    const { score, isMeaningful, strengths, gaps } = result.data;

    // Anti-gaming check: if isMeaningful is false or score < 40
    if (!isMeaningful || score < 40) {
      setMeaningfulWarning(
        'Please add a little more substance. Sincere reasoning is required to earn points and calibrate judgement.'
      );
      return;
    }

    // Award points
    const points = calculateAttemptPoints(score, isMeaningful, config);
    const newAttemptId = `att_${Date.now()}`;
    setCurrentAttemptId(newAttemptId);

    Storage.addAttempt({
      id: newAttemptId,
      sessionId: currentSessionId,
      text: userTake.trim(),
      confidencePct,
      score,
      isMeaningful,
      strengths,
      gaps,
      createdAt: new Date().toISOString(),
    });

    if (points > 0 && isGrowthDomain) {
      Storage.addPointEvent({
        id: `pt_att_${Date.now()}`,
        type: 'think_first_attempt',
        points,
        domainId: currentDomain.id,
        sessionId: currentSessionId,
        description: `Think-first attempt on "${question.slice(0, 45)}..." (Score: ${score}/100)`,
        createdAt: new Date().toISOString(),
      });
    }

    // Automatically record independent draft in tracker (PRD Section 5: avoid double-counting)
    Storage.addTrackerEntry({
      id: `tr_${Date.now()}`,
      type: 'independent_draft',
      count: 1,
      date: new Date().toISOString().slice(0, 10),
      source: 'jarvis_observed',
      sessionId: currentSessionId,
      note: `Draft in ${currentDomain.name} (Quality: ${score}/100)`,
      createdAt: new Date().toISOString(),
    });

    Storage.logAnalyticsEvent('attempt_submitted', { score, confidencePct });
    onRefreshUserData();

    // Now fetch Classic Answer in background and proceed to Two-Option Screen
    await fetchClassicAnswer(currentSessionId, false);
    setStage('two_options');
  };

  // Skip think-first take with warning modal
  const handleInitiateSkipTake = () => {
    if (isScheduledLocked) {
      setTypedUnlockPhrase('');
      setPendingAiFirstAction(() => () => {
        fetchClassicAnswer(currentSessionId, true);
        setStage('two_options');
      });
      setShowScheduledLockModal(true);
      return;
    }

    if (isGrowthDomain) {
      setPendingAiFirstAction(() => () => {
        Storage.addPointEvent({
          id: `pt_pen_${Date.now()}`,
          type: 'classic_without_take_penalty',
          points: -10,
          domainId: currentDomain.id,
          sessionId: currentSessionId,
          description: `Skipped think-first take in ${currentDomain.name} (-10 pts)`,
          createdAt: new Date().toISOString(),
        });
        onRefreshUserData();
        fetchClassicAnswer(currentSessionId, true);
        setStage('two_options');
      });
      setShowAiFirstWarning(true);
      return;
    }

    fetchClassicAnswer(currentSessionId, true);
    setStage('two_options');
  };

  // Launch Coach Topic Session (PRD V2 Section 6)
  const handleLaunchCoachSession = async () => {
    setIsLoading(true);
    setLoadingMessage('Constructing multi-question topic checkpoints and verified resources...');
    setErrorMessage(null);

    const action = () => handleLaunchCoachSession();
    setRetryAction(() => action);

    const result = await aiService.topicSession(
      question,
      currentDomain.name,
      currentDomain.level,
      timeBudget
    );
    setIsLoading(false);

    if (result.error || !result.data) {
      setErrorMessage(result.error || 'Failed to construct coach topic session.');
      return;
    }

    setTopicSession(result.data);
    setCurrentCheckpointIndex(0);
    setRevealedHintIndex(0);
    setCheckpointAnswers({});
    setCheckpointScores({});
    setHintsUsedTotal(0);
    setStage('topic_coach');
    Storage.logAnalyticsEvent('mode_selected', { mode: 'coach_topic' });
  };

  // Submit Answer for Current Checkpoint
  const handleSubmitCheckpointAnswer = async () => {
    if (!topicSession) return;
    const currentCp = topicSession.checkpoints[currentCheckpointIndex];
    if (!currentCp) return;

    const answer = checkpointAnswers[currentCheckpointIndex]?.trim();
    if (!answer) return;

    setIsScoringCheckpoint(true);
    setErrorMessage(null);

    const result = await aiService.scoreCheckpoint(
      currentCp.prompt,
      currentCp.criteria,
      answer
    );
    setIsScoringCheckpoint(false);

    if (result.error || !result.data) {
      setErrorMessage(result.error || 'Failed to evaluate checkpoint answer.');
      return;
    }

    setCheckpointScores(prev => ({
      ...prev,
      [currentCheckpointIndex]: result.data!,
    }));
  };

  // Move to next checkpoint or topic summary
  const handleNextCheckpoint = () => {
    if (!topicSession) return;
    if (currentCheckpointIndex + 1 < topicSession.checkpoints.length) {
      setCurrentCheckpointIndex(idx => idx + 1);
      setRevealedHintIndex(0);
    } else {
      setStage('topic_summary');
    }
  };

  // Finish and save completed topic (PRD V2 Section 6)
  const handleSaveCompletedTopic = () => {
    if (!topicSession) return;

    const scoresList = Object.values(checkpointScores).map(s => s.score);
    const avgScore = scoresList.length
      ? Math.round((scoresList.reduce((a, b) => a + b, 0) / scoresList.length) * 10) / 10
      : 8.0;

    const isMastered = avgScore >= 7.0 && topicConfidence >= 60;

    // Checkpoints mapped with results
    const storedCheckpoints: TopicCheckpoint[] = topicSession.checkpoints.map((cp, idx) => ({
      id: `cp_${Date.now()}_${idx}`,
      checkpointNumber: cp.checkpointNumber,
      prompt: cp.prompt,
      criteria: cp.criteria,
      hints: cp.hints,
      resources: cp.resources,
      userAnswer: checkpointAnswers[idx] || '',
      score: checkpointScores[idx]?.score,
      strengths: checkpointScores[idx]?.strengths,
      gaps: checkpointScores[idx]?.gaps,
      completedAt: new Date().toISOString(),
    }));

    // Save session record
    const updatedSession: Session = {
      id: currentSessionId,
      domainId: currentDomain.id,
      mode: 'help_me_grow',
      question,
      timeBudget,
      createdAt: new Date().toISOString(),
      usedClassicOnly: false,
      hintDepth: revealedHintIndex,
      attemptId: currentAttemptId || undefined,
      topicName: topicSession.topicName,
      checkpoints: storedCheckpoints,
      understandingConfidence: topicConfidence,
      overallTopicScore: avgScore,
      hintsUsedCount: hintsUsedTotal,
      isMastered,
    };
    Storage.addSession(updatedSession);

    // Award +15 points for completing coach guided session
    if (isGrowthDomain) {
      Storage.addPointEvent({
        id: `pt_gui_${Date.now()}`,
        type: 'guided_completed',
        points: config.points.guidedPathCompleted,
        domainId: currentDomain.id,
        sessionId: currentSessionId,
        description: `Mastered topic checkpoint session on "${topicSession.topicName}" (+15 pts)`,
        createdAt: new Date().toISOString(),
      });
    }

    // Record in Tracker (distinguish mastered from explored/practised)
    Storage.addTrackerEntry({
      id: `tr_${Date.now()}`,
      type: isMastered ? 'topic_mastered' : 'topic_explored',
      count: 1,
      date: new Date().toISOString().slice(0, 10),
      source: 'jarvis_observed',
      sessionId: currentSessionId,
      topicName: topicSession.topicName,
      note: isMastered
        ? `Mastered "${topicSession.topicName}" (Score: ${avgScore}/10, Conf: ${topicConfidence}%)`
        : `Explored "${topicSession.topicName}" (Score: ${avgScore}/10, Conf: ${topicConfidence}%)`,
      createdAt: new Date().toISOString(),
    });

    // Schedule Spaced Revisit Quiz (PRD Section 4: prompt: "Shall we revisit [topic] that you learnt [X] days ago?")
    const tomorrow = new Date(Date.now() + 86400000).toISOString();
    Storage.addSpacedQuiz({
      id: `sq_${Date.now()}`,
      sessionId: currentSessionId,
      topicName: topicSession.topicName,
      domainId: currentDomain.id,
      domainName: currentDomain.name,
      daysAgoLearned: 1,
      learnedAt: new Date().toISOString(),
      dueAt: tomorrow,
      questions: topicSession.checkpoints.map(cp => ({
        question: `How would you apply ${topicSession.topicName} in practice: "${cp.prompt}"?`,
      })),
      pointsAwarded: false,
    });

    Storage.logAnalyticsEvent('topic_completed', {
      topic: topicSession.topicName,
      score: avgScore,
      confidence: topicConfidence,
      isMastered,
    });

    onRefreshUserData();
    setStage('input');
    setQuestion('');
    setUserTake('');
    setTopicSession(null);
  };

  const wordCount = countWords(userTake);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Flag Issue Modal */}
      <FlagIssueModal
        isOpen={showFlagModal}
        onClose={() => setShowFlagModal(false)}
        domainId={currentDomain.id}
        sessionId={currentSessionId}
        questionText={question}
        aiSnippet={activeSnippetForFlag}
      />

      {/* AI-First Penalty Confirmation Modal (PRD Section 7) */}
      {showAiFirstWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-amber-300 dark:border-amber-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Deliberate Practice Check
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure? This skips your own thinking in a domain you chose to grow ({currentDomain.name}). You may forfeit 10 points.
            </p>
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-[11px] text-amber-800 dark:text-amber-300">
              Your pledged principal is never affected. This adjustment applies solely to your internal practice points.
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowAiFirstWarning(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Go back to my take
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAiFirstWarning(false);
                  pendingAiFirstAction?.();
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
              >
                Continue to AI Answer (-10 pts)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scheduled AI Lock Override Modal (PRD Section 9) */}
      {showScheduledLockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-rose-300 dark:border-rose-900 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <Lock className="w-5 h-5" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Scheduled AI-First Lock Active
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              You scheduled this window to protect your own thinking in growth domains. Help Me Think, guided topic coaching, and your own notes remain fully available.
            </p>
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-200 space-y-2">
              <span className="font-bold block">
                To override the schedule and access direct AI generation (-10 pts penalty):
              </span>
              <p className="text-[11px] font-mono text-slate-700 dark:text-slate-300 select-all bg-white/60 dark:bg-black/40 p-2 rounded-lg border border-rose-200 dark:border-rose-800">
                {REQUIRED_UNLOCK_PHRASE}
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Type the unlock phrase above to confirm:
              </label>
              <input
                type="text"
                value={typedUnlockPhrase}
                onChange={e => setTypedUnlockPhrase(e.target.value)}
                placeholder="Type the exact phrase..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 font-mono"
              />
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowScheduledLockModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel & Use Coach Mode
              </button>
              <button
                type="button"
                disabled={typedUnlockPhrase.trim() !== REQUIRED_UNLOCK_PHRASE}
                onClick={() => {
                  setShowScheduledLockModal(false);
                  // Apply 10 point penalty and record override event
                  Storage.addPointEvent({
                    id: `pt_ovr_${Date.now()}`,
                    type: 'lock_override_penalty',
                    points: -10,
                    domainId: currentDomain.id,
                    sessionId: currentSessionId,
                    description: `Scheduled AI lock override in ${currentDomain.name} (-10 pts)`,
                    createdAt: new Date().toISOString(),
                  });
                  Storage.logAnalyticsEvent('lock_override', { domain: currentDomain.name });
                  onRefreshUserData();
                  pendingAiFirstAction?.();
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white cursor-pointer transition-opacity"
              >
                Confirm Override (-10 pts)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Error Banner with Retry */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          {retryAction && (
            <button
              onClick={retryAction}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Global Loading Overlay */}
      {isLoading && (
        <div className="p-8 rounded-2xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center text-center space-y-3">
          <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
          <div className="text-sm font-semibold text-slate-900 dark:text-white">
            {loadingMessage || 'Consulting live Gemini API...'}
          </div>
          <p className="text-xs text-slate-400">
            Real-time inference. Resilient multi-model fallback active.
          </p>
        </div>
      )}

      {/* =========================================================================
          STAGE 1: MAIN INPUT
         ========================================================================= */}
      {stage === 'input' && !isLoading && (
        <div className="space-y-6">
          {/* Scheduled Lock Banner (PRD Section 9: Show state & when it will unlock) */}
          {isScheduledLocked && (
            <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex items-start gap-3">
              <Lock className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <span className="font-bold text-slate-900 dark:text-white block">
                  Scheduled AI-first mode lock active (Unlocks at {unlockHourLabel})
                </span>
                <p className="text-slate-600 dark:text-slate-300">
                  Direct AI generation in growth domains is locked until {unlockHourLabel} by your deliberate practice schedule. Coach guided mode, note drafting, and reflection remain available.
                </p>
              </div>
            </div>
          )}

          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-900 dark:text-white mb-2">
                What topic, decision, or memo are you working on?
              </label>
              <textarea
                value={question}
                onChange={e => setQuestion(e.target.value)}
                placeholder="Paste the problem, memo prompt, decision scenario, or strategy question..."
                rows={4}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* Select Domain & Mode */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Domain Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Domain (Auto-suggested)
                </label>
                <select
                  value={selectedDomainId}
                  onChange={e => setSelectedDomainId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  {domains.map(dom => (
                    <option key={dom.id} value={dom.id}>
                      {dom.name} {dom.isGrowth ? '⭐ (Growth Domain)' : '(Delegation)'}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  {isGrowthDomain
                    ? 'Growth domain: deliberate practice builds intuition & tracks progress.'
                    : 'Delegation domain: instant answers with zero penalties.'}
                </p>
              </div>

              {/* Mode Switch: Help me grow vs Get it done */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMode('help_me_grow')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      mode === 'help_me_grow'
                        ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200 shadow-xs ring-1 ring-teal-500'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    <Lightbulb className="w-3.5 h-3.5 text-teal-600" />
                    <span>Help me grow</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode('get_it_done')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      mode === 'get_it_done'
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-200 shadow-xs ring-1 ring-indigo-500'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Get it done</span>
                  </button>
                </div>

                {isGrowthDomain && mode === 'get_it_done' && !isScheduledLocked && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                    AI-first in growth domain: subject to practice check modal (-10 pts).
                  </p>
                )}
              </div>
            </div>

            {/* Time Budget */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Time Budget (calibrates depth)
              </label>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { id: '2m', label: '2 min (Speed)' },
                    { id: '5m', label: '5 min (Standard)' },
                    { id: '15m', label: '15 min (Deep)' },
                    { id: 'norush', label: 'No rush' },
                  ] as const
                ).map(chip => (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setTimeBudget(chip.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                      timeBudget === chip.id
                        ? 'border-teal-600 bg-teal-50 dark:bg-teal-950 text-teal-800 dark:text-teal-300'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Primary Action Button */}
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleStartAsk}
                disabled={!question.trim()}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white shadow-md transition-all cursor-pointer"
              >
                <span>{mode === 'help_me_grow' ? 'Begin Think-First' : 'Generate Answer'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          STAGE 2: THINK-FIRST WINDOW
         ========================================================================= */}
      {stage === 'think_first' && !isLoading && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            {/* Question Recap */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs">
              <span className="font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wider text-[10px]">
                {currentDomain.name} Challenge
              </span>
              <p className="text-sm font-semibold text-slate-900 dark:text-white mt-1">
                "{question}"
              </p>
            </div>

            {/* Soft Target indicators */}
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 font-medium">
                  <div className="w-5 h-5 rounded-full border-2 border-teal-500/30 flex items-center justify-center text-[10px]">
                    <Clock className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                  </div>
                  <span>{elapsedSeconds}s elapsed</span>
                </div>
                <div
                  className={`font-medium ${
                    wordCount >= 15 ? 'text-teal-600 dark:text-teal-400' : 'text-slate-500'
                  }`}
                >
                  {wordCount} / 15 words target
                </div>
              </div>
              <span className="text-[11px] text-slate-400 italic">Never blocking</span>
            </div>

            {meaningfulWarning && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <span>{meaningfulWarning}</span>
              </div>
            )}

            {/* First Take Textarea */}
            <div>
              <label className="block text-xs font-bold text-slate-900 dark:text-white mb-1.5">
                Your First Take
              </label>
              <textarea
                value={userTake}
                onChange={e => {
                  setUserTake(e.target.value);
                  setMeaningfulWarning(null);
                }}
                placeholder="What is your immediate intuition, key hypothesis, or framework before the AI speaks? (Even 2-3 lines anchors your own judgement)"
                rows={5}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* Confidence Slider */}
            <div>
              <div className="flex items-center justify-between text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                <span>Stated Confidence in your take</span>
                <span className="font-bold text-teal-600 dark:text-teal-400">
                  {confidencePct}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={confidencePct}
                onChange={e => setConfidencePct(Number(e.target.value))}
                className="w-full accent-teal-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>Uncertain (0%)</span>
                <span>Calibrated guess (50%)</span>
                <span>Definite conviction (100%)</span>
              </div>
            </div>

            {/* Motivational Quote */}
            <div className="p-3 bg-teal-50/50 dark:bg-teal-950/30 rounded-xl border border-teal-100 dark:border-teal-900/40 text-xs text-teal-800 dark:text-teal-300 italic text-center">
              "{motivationalQuote}"
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleLaunchCoachSession}
                className="text-xs text-teal-600 hover:text-teal-700 dark:text-teal-400 font-semibold cursor-pointer flex items-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>I'm stuck, guide me through checkpoints</span>
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleInitiateSkipTake}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  Skip to Classic Answer
                </button>

                <button
                  type="button"
                  onClick={handleSubmitTake}
                  disabled={!userTake.trim()}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white shadow-sm transition-colors cursor-pointer"
                >
                  Submit My Take (+10 pts)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          STAGE 3: TWO-OPTION SCREEN
         ========================================================================= */}
      {stage === 'two_options' && classicAnswer && !isLoading && (
        <div className="space-y-6">
          <div className="text-center max-w-lg mx-auto">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Choose Your Next Step
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {userTake
                ? 'Your independent take has been recorded in your Progress. Review the classic answer or enter Coach topic checkpoints.'
                : 'Direct answer selected. Review the synthesis or enter Coach guided checkpoints.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card 1: Classic Answer */}
            <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-indigo-600" />
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      Classic Answer
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {userTake ? 'Independent take recorded' : 'Direct synthesis'}
                  </span>
                </div>

                <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed mb-4 space-y-2 max-h-56 overflow-y-auto pr-1">
                  <p>{classicAnswer.answer}</p>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-[11px] space-y-1.5 mb-4">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center justify-between">
                    <span>What to verify (Assumptions):</span>
                    <span className="text-teal-600 font-semibold">{classicAnswer.confidencePct}% confidence</span>
                  </div>
                  <ul className="list-disc pl-4 space-y-0.5 text-slate-600 dark:text-slate-400">
                    {classicAnswer.assumptions.map((ass, i) => (
                      <li key={i}>{ass}</li>
                    ))}
                  </ul>

                  {classicAnswer.mayBeWrongIf?.length > 0 && (
                    <div className="pt-1 text-amber-700 dark:text-amber-300">
                      <span className="font-semibold">May be wrong if: </span>
                      {classicAnswer.mayBeWrongIf.join('; ')}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveSnippetForFlag(classicAnswer.answer);
                    setShowFlagModal(true);
                  }}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 cursor-pointer"
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>Flag an issue</span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenRehearsalWithText(userTake || classicAnswer.answer)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer flex items-center gap-1.5"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Defend This Decision</span>
                </button>
              </div>
            </div>

            {/* Card 2: Coach Guided Path */}
            <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-teal-50/60 via-white to-indigo-50/40 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 border-2 border-teal-500/40 dark:border-teal-500/30 shadow-md flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-teal-600" />
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      Coach Guided Path
                    </span>
                  </div>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300">
                    +15 when completed
                  </span>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                  Multi-question topic coaching with progressive hints, verified study resources, and transparent scoring:
                </p>

                <div className="space-y-2 mb-4">
                  {[
                    '1. Sequential learning checkpoints',
                    '2. Progressive hints: nudge → question → framework → partial → full',
                    '3. Curated resources: articles, docs, and YouTube videos',
                    '4. Transparent scoring (/10) with strengths & gaps',
                  ].map((lvl, i) => (
                    <div
                      key={i}
                      className="text-xs p-2 rounded-lg bg-white/70 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 font-medium"
                    >
                      {lvl}
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleLaunchCoachSession}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-sm transition-colors cursor-pointer"
              >
                <span>Enter Coach Topic Checkpoints</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          STAGE 4: COACH TOPIC CHECKPOINTS (PRD V2 Section 6)
         ========================================================================= */}
      {stage === 'topic_coach' && topicSession && !isLoading && (
        <div className="space-y-6">
          {/* Header */}
          <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                  Coach Topic Session: {topicSession.topicName}
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                  Checkpoint {currentCheckpointIndex + 1} of {topicSession.checkpoints.length}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-teal-600 dark:text-teal-400">
                  +15 pts on completion
                </span>
                {/* Clear path to full answer so user is never trapped */}
                <button
                  type="button"
                  onClick={() => {
                    if (classicAnswer) {
                      setStage('two_options');
                    } else {
                      fetchClassicAnswer(currentSessionId, false);
                      setStage('two_options');
                    }
                  }}
                  className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white underline cursor-pointer"
                >
                  View Full Authoritative Answer
                </button>
              </div>
            </div>

            {/* Checkpoint Progress Bar */}
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-teal-600 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${((currentCheckpointIndex + 1) / topicSession.checkpoints.length) * 100}%`,
                }}
              />
            </div>

            {/* Current Checkpoint Prompt & Criteria */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-2">
              <span className="text-xs font-bold text-teal-700 dark:text-teal-300 block">
                Task Challenge:
              </span>
              <p className="text-sm font-semibold text-slate-900 dark:text-white leading-relaxed">
                {topicSession.checkpoints[currentCheckpointIndex]?.prompt}
              </p>
              <div className="pt-1 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Criteria: </span>
                {topicSession.checkpoints[currentCheckpointIndex]?.criteria}
              </div>
            </div>

            {/* Progressive Hints (PRD V2: nudge -> guiding question -> framework -> partial answer -> full answer) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-teal-600" />
                  <span>
                    Hint Ladder (Level {revealedHintIndex + 1} of 5:{' '}
                    {topicSession.checkpoints[currentCheckpointIndex]?.hints[revealedHintIndex]?.type.replace('_', ' ')})
                  </span>
                </span>
                <div className="flex items-center gap-2">
                  {revealedHintIndex < 4 && (
                    <button
                      type="button"
                      onClick={() => {
                        setRevealedHintIndex(idx => idx + 1);
                        setHintsUsedTotal(t => t + 1);
                      }}
                      className="text-xs text-teal-600 hover:text-teal-700 dark:text-teal-400 font-semibold cursor-pointer"
                    >
                      Reveal Next Hint ({revealedHintIndex + 2}/5)
                    </button>
                  )}
                  {revealedHintIndex < 4 && (
                    <button
                      type="button"
                      onClick={() => {
                        setRevealedHintIndex(4);
                        setHintsUsedTotal(t => t + 1);
                      }}
                      className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      Reveal Full Answer
                    </button>
                  )}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-teal-50/60 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800 text-xs text-slate-900 dark:text-white font-medium leading-relaxed">
                {topicSession.checkpoints[currentCheckpointIndex]?.hints[revealedHintIndex]?.text}
              </div>
            </div>

            {/* Curated Verified Study Resources (Articles and Videos with YouTube) */}
            {topicSession.checkpoints[currentCheckpointIndex]?.resources?.length > 0 && (
              <div className="space-y-2.5 pt-2">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Verified Study Resources (Official Docs, Case Studies & Videos)</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {topicSession.checkpoints[currentCheckpointIndex].resources.map((res, i) => {
                    const isVideo = res.type === 'video' || res.source.toLowerCase().includes('youtube');
                    const destinationUrl =
                      res.url ||
                      (isVideo
                        ? `https://www.youtube.com/results?search_query=${encodeURIComponent(res.searchQuery || res.title)}`
                        : `https://www.google.com/search?q=${encodeURIComponent(res.searchQuery || res.title)}`);

                    return (
                      <div
                        key={i}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-slate-900 dark:text-white line-clamp-1">
                              {res.title}
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 uppercase flex items-center gap-1">
                              {isVideo ? <Video className="w-3 h-3 text-rose-500" /> : <FileText className="w-3 h-3 text-indigo-500" />}
                              <span>{res.source}</span>
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-2">
                            {res.why}
                          </p>
                        </div>
                        <a
                          href={destinationUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 mt-1 cursor-pointer"
                        >
                          <span>{isVideo ? 'Watch on YouTube' : 'Open Search & Resource'}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* User Checkpoint Answer Input */}
            <div className="pt-2">
              <label className="block text-xs font-bold text-slate-900 dark:text-white mb-1.5">
                Your Answer / Reasoning for Checkpoint {currentCheckpointIndex + 1}
              </label>
              <textarea
                value={checkpointAnswers[currentCheckpointIndex] || ''}
                onChange={e =>
                  setCheckpointAnswers({
                    ...checkpointAnswers,
                    [currentCheckpointIndex]: e.target.value,
                  })
                }
                placeholder="Write your approach addressing the criteria and incorporating the hints..."
                rows={4}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* Checkpoint Evaluation Result (Transparent /10 score, strengths & gaps) */}
            {checkpointScores[currentCheckpointIndex] && (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Checkpoint Evaluation:
                  </span>
                  <div className="flex items-center gap-1 text-sm font-extrabold text-teal-600 dark:text-teal-400">
                    <span>{checkpointScores[currentCheckpointIndex].score} / 10</span>
                  </div>
                </div>

                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {checkpointScores[currentCheckpointIndex].feedback}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                  <div className="p-2.5 rounded-lg bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800/60">
                    <span className="font-semibold text-teal-800 dark:text-teal-300 block mb-1">
                      Strengths:
                    </span>
                    <ul className="list-disc pl-4 space-y-0.5 text-slate-700 dark:text-slate-300 text-[11px]">
                      {checkpointScores[currentCheckpointIndex].strengths.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60">
                    <span className="font-semibold text-amber-800 dark:text-amber-300 block mb-1">
                      Areas to sharpen:
                    </span>
                    <ul className="list-disc pl-4 space-y-0.5 text-slate-700 dark:text-slate-300 text-[11px]">
                      {checkpointScores[currentCheckpointIndex].gaps.map((g, i) => (
                        <li key={i}>{g}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Submit / Proceed Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              {!checkpointScores[currentCheckpointIndex] ? (
                <button
                  type="button"
                  onClick={handleSubmitCheckpointAnswer}
                  disabled={!checkpointAnswers[currentCheckpointIndex]?.trim() || isScoringCheckpoint}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  {isScoringCheckpoint ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Evaluating answer against criteria...</span>
                    </>
                  ) : (
                    <span>Submit Checkpoint Answer</span>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleNextCheckpoint}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <span>
                    {currentCheckpointIndex + 1 < topicSession.checkpoints.length
                      ? 'Proceed to Next Checkpoint'
                      : 'Complete Topic Coaching'}
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          STAGE 5: TOPIC SUMMARY & RETENTION QUIZ SCHEDULING (PRD V2 Section 6)
         ========================================================================= */}
      {stage === 'topic_summary' && topicSession && !isLoading && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="text-center max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Topic Coaching Complete
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              You worked through all learning checkpoints for "{topicSession.topicName}".
            </p>
          </div>

          {/* Score & Checkpoints Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
              <span className="text-xs text-slate-500">Overall Topic Assessment</span>
              <div className="text-3xl font-extrabold text-teal-600 dark:text-teal-400 my-2">
                {Math.round(
                  (Object.values(checkpointScores).reduce((a, b) => a + b.score, 0) /
                    Math.max(1, Object.keys(checkpointScores).length)) *
                    10
                ) / 10}{' '}
                / 10
              </div>
              <span className="text-[11px] text-slate-400">
                Task criteria assessment across {topicSession.checkpoints.length} checkpoints
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
              <span className="text-xs text-slate-500">Scheduled Spaced Revisit</span>
              <div className="text-sm font-bold text-slate-900 dark:text-white my-2">
                Tomorrow (in 1 day)
              </div>
              <span className="text-[11px] text-slate-400">
                A quick application quiz will prompt on Home to test long-term retention
              </span>
            </div>
          </div>

          {/* Confidence Slider (PRD V2: Ask user to rate their confidence) */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-900 dark:text-white">
              <span>Rate your confidence in applying this topic independently:</span>
              <span className="text-teal-600 dark:text-teal-400 font-bold">{topicConfidence}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={topicConfidence}
              onChange={e => setTopicConfidence(Number(e.target.value))}
              className="w-full accent-teal-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>Still learning (0%)</span>
              <span>Solid grasp (60%)</span>
              <span>Fluent mastery (100%)</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => onOpenRehearsalWithText(question)}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 cursor-pointer flex items-center gap-1.5"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Stress-test in Defend-It Rehearsal</span>
            </button>

            <button
              type="button"
              onClick={handleSaveCompletedTopic}
              className="px-6 py-2.5 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-sm cursor-pointer"
            >
              Save Topic & Record Progress (+15 pts)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
