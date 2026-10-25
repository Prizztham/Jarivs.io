/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Compass,
  Sparkles,
  Shield,
  BrainCircuit,
  Clock,
  ArrowRight,
  TrendingUp,
  PlusCircle,
  CheckCircle2,
  Calendar,
  AlertCircle,
  HelpCircle,
  BookOpen,
  X,
} from 'lucide-react';
import { ProgressPanel } from './ProgressPanel';
import { PointEvent, Recall, UserProfile, Session, TrackerEntry, AppConfig, SpacedRevisitQuiz } from '../types';
import { Storage } from '../utils/storage';
import { aiService } from '../services/aiService';

interface HomeViewProps {
  user: UserProfile;
  config: AppConfig;
  pointEvents: PointEvent[];
  sessions: Session[];
  recalls: Recall[];
  trackerEntries: TrackerEntry[];
  onNavigateToAsk: (prefill?: string) => void;
  onOpenRehearsal: (draft?: string) => void;
  onOpenRecall: (recall: Recall) => void;
  onOpenQuiz?: (quiz: SpacedRevisitQuiz) => void;
  onOpenLogHours: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  user,
  config,
  pointEvents,
  sessions,
  recalls,
  trackerEntries,
  onNavigateToAsk,
  onOpenRehearsal,
  onOpenRecall,
  onOpenQuiz,
  onOpenLogHours,
}) => {
  const [askInput, setAskInput] = useState('');
  const [isSimulatingNextDay, setIsSimulatingNextDay] = useState(false);

  // Daily Check-in state (PRD V2 Section 8 & 11)
  const todayStr = new Date().toISOString().slice(0, 10);
  const [dismissedDailyCheckin, setDismissedDailyCheckin] = useState(false);
  const [checkinHours, setCheckinHours] = useState('1');
  const showDailyCheckinPrompt = !dismissedDailyCheckin && user.lastDailyCheckinDate !== todayStr;

  const handleLogDailyCheckin = () => {
    const hours = Math.max(0, Number(checkinHours) || 0);
    Storage.recordDailyCheckin(hours);
    setDismissedDailyCheckin(true);
  };

  const handleDismissDailyCheckin = () => {
    Storage.recordDailyCheckin(0);
    setDismissedDailyCheckin(true);
  };

  // Spaced Revisit Quizzes (PRD V2 Section 7 & 11)
  const pendingQuiz = Storage.getPendingSpacedQuiz();
  const activeRecall = recalls.find(r => !r.completedAt);

  // Get attempts & domains from storage for ProgressPanel
  const attempts = Storage.getAttempts();
  const domains = Storage.getDomains();

  // Compute tracker weekly metrics
  const now = Date.now();
  const weekStart = now - 7 * 86400000;
  const recentEntries = trackerEntries.filter(
    e => new Date(e.createdAt).getTime() >= weekStart
  );

  const manualHoursTotal = recentEntries
    .filter(e => e.type === 'manual_hours')
    .reduce((sum, e) => sum + e.count, 0);

  const draftsTotal = recentEntries
    .filter(e => e.type === 'independent_draft')
    .reduce((sum, e) => sum + e.count, 0);

  const topicsTotal = recentEntries
    .filter(e => e.type === 'topic_learned' || e.type === 'topic_mastered')
    .reduce((sum, e) => sum + e.count, 0);

  // Quick "Simulate next day" for demo
  const handleSimulateNextDay = async () => {
    setIsSimulatingNextDay(true);
    const growthSession = sessions.find(s => s.domainId && s.domainId.includes('dom_')) || sessions[0];
    const sessionQuestion = growthSession
      ? growthSession.question
      : 'Should we rebuild our authentication service in-house or migrate to managed identity?';

    const result = await aiService.recallQuestions(sessionQuestion);
    setIsSimulatingNextDay(false);

    const questions = result.data?.questions?.length
      ? result.data.questions
      : [
          'What was your primary rationale for choosing a phased release instead of immediate cutover?',
          'What would change in your communication strategy if our top enterprise account objected?',
          'How did the AI recommendation differ from your original hypothesis?',
        ];

    const newQuiz: SpacedRevisitQuiz = {
      id: `sq_${Date.now()}`,
      sessionId: growthSession?.id || 'demo_sess',
      topicName: growthSession?.topicName || 'Strategic Decision Framing',
      domainId: growthSession?.domainId || 'dom_decision',
      domainName: 'Decision-making',
      daysAgoLearned: 1,
      learnedAt: new Date(Date.now() - 86400000).toISOString(),
      dueAt: new Date().toISOString(),
      questions: questions.map(q => ({ question: q })),
    };
    Storage.addSpacedQuiz(newQuiz);
    if (onOpenQuiz) {
      onOpenQuiz(newQuiz);
    } else {
      onOpenRecall({
        id: newQuiz.id,
        sessionId: newQuiz.sessionId,
        sessionQuestion: newQuiz.topicName,
        domainName: newQuiz.domainName,
        dueAt: newQuiz.dueAt,
        questions: newQuiz.questions.map(q => ({ question: q.question })),
      });
    }
  };

  const handleQuickAskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (askInput.trim()) {
      onNavigateToAsk(askInput.trim());
      setAskInput('');
    }
  };

  const handleStartPendingQuiz = () => {
    if (pendingQuiz) {
      if (onOpenQuiz) {
        onOpenQuiz(pendingQuiz);
      } else {
        onOpenRecall({
          id: pendingQuiz.id,
          sessionId: pendingQuiz.sessionId,
          sessionQuestion: pendingQuiz.topicName,
          domainName: pendingQuiz.domainName,
          dueAt: pendingQuiz.dueAt,
          questions: pendingQuiz.questions.map(q => ({ question: q.question })),
        });
      }
    } else if (activeRecall) {
      onOpenRecall(activeRecall);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Greeting & Philosophy Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Good morning, {user.name}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            "Speed is for tasks. Judgement is for decisions."
          </p>
        </div>

        {/* Action: Quick Simulate for Demo */}
        <button
          onClick={handleSimulateNextDay}
          disabled={isSimulatingNextDay}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300/60 dark:border-slate-700 transition-colors cursor-pointer"
          title="Demo shortcut: Simulates 24-hour advance to trigger Spaced Revisit Quiz"
        >
          <Clock className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
          <span>{isSimulatingNextDay ? 'Generating...' : 'Simulate Next Day (Demo)'}</span>
        </button>
      </div>

      {/* Dismissible Daily Check-in Prompt (PRD V2 Section 8 & 11) */}
      {showDailyCheckinPrompt && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-teal-500/10 via-indigo-500/10 to-teal-500/10 border border-teal-500/30 dark:border-teal-500/20 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0 mt-0.5">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Daily Check-in: Outside Learning
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Did you spend time reading books, whiteboarding, or learning outside Jarvis today? (Self-reported hours)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1.5">
              <input
                type="number"
                min="0.5"
                max="12"
                step="0.5"
                value={checkinHours}
                onChange={e => setCheckinHours(e.target.value)}
                className="w-12 text-xs font-bold text-center bg-transparent text-slate-900 dark:text-white focus:outline-none"
              />
              <span className="text-xs text-slate-400">hours</span>
            </div>

            <button
              onClick={handleLogDailyCheckin}
              className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              Log Hours
            </button>

            <button
              onClick={handleDismissDailyCheckin}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              title="Dismiss for today"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Quick Ask Bar */}
      <form
        onSubmit={handleQuickAskSubmit}
        className="p-2 sm:p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-2"
      >
        <div className="p-2 text-teal-600 dark:text-teal-400">
          <Sparkles className="w-5 h-5" />
        </div>
        <input
          type="text"
          value={askInput}
          onChange={e => setAskInput(e.target.value)}
          placeholder="What do you need help with? In growth domains, Jarvis asks you to think first..."
          className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!askInput.trim()}
          className="px-4 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white transition-colors cursor-pointer flex items-center gap-1.5"
        >
          <span>Ask</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </form>

      {/* Progress Panel (PRD V2 Section 1, 3, 11 - Replaces Judgement Index) */}
      <ProgressPanel
        user={user}
        sessions={sessions}
        attempts={attempts}
        domains={domains}
      />

      {/* Row 2: Spaced Revisit Quiz Prompt & Defend-It Rehearsal */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Spaced Revisit Quiz Card (PRD V2 Section 7 & 11) */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                <BrainCircuit className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  Spaced Revisit Quiz
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {pendingQuiz ? '1 retention quiz ready' : 'Next review scheduled after deliberation'}
                </p>
              </div>
            </div>
            {pendingQuiz && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 animate-pulse">
                Ready
              </span>
            )}
          </div>

          <div className="text-xs text-slate-700 dark:text-slate-300 mb-4 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 leading-relaxed font-medium">
            {pendingQuiz ? (
              <span>
                "Shall we revisit {pendingQuiz.topicName} that you learnt {pendingQuiz.daysAgoLearned} days ago through a quick quiz?"
              </span>
            ) : activeRecall ? (
              <span>
                "Shall we revisit {activeRecall.sessionQuestion} that you learnt yesterday through a quick quiz?"
              </span>
            ) : (
              <p className="text-slate-500 dark:text-slate-400 font-normal">
                Jarvis schedules spaced recall quizzes 1 to 5 days after a learning session to cement conceptual grasp.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {pendingQuiz || activeRecall ? (
              <button
                onClick={handleStartPendingQuiz}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white cursor-pointer transition-colors"
              >
                <span>Take Revisit Quiz (+10 pts)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={handleSimulateNextDay}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold border border-teal-500/40 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/40 cursor-pointer transition-colors"
              >
                <span>Simulate Tomorrow's Quiz</span>
              </button>
            )}
          </div>
        </div>

        {/* Defend-It Rehearsal Card */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  Defend-It Rehearsal
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Stress-test decisions against skeptical audiences
                </p>
              </div>
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300">
              Pass 60+ (+20 pts)
            </span>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
            Paste any proposal, email, or architecture memo. Sceptical AI persona asks 3 probing questions before your real meeting.
          </p>

          <button
            onClick={() => onOpenRehearsal()}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer transition-colors"
          >
            <span>Launch Rehearsal Room</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Row 3: Weekly Goal Rings (Tracker) */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">
              Weekly Independent Thinking Rings
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Track manual deliberation time and unassisted drafts.
            </p>
          </div>
          <button
            onClick={onOpenLogHours}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/60 dark:hover:bg-teal-900 text-teal-800 dark:text-teal-300 transition-colors cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Log AI-Free Time</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Manual AI-free hours */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-center">
            <div className="text-2xl font-bold text-teal-600 dark:text-teal-400">
              {manualHoursTotal} / {config.weeklyGoals.manualHours}h
            </div>
            <div className="text-xs font-semibold text-slate-900 dark:text-white mt-1">
              Manual AI-Free Hours
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Self-reported reading and offline thinking time
            </p>
            <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-3 overflow-hidden">
              <div
                className="bg-teal-600 h-1.5 rounded-full"
                style={{
                  width: `${Math.min(100, (manualHoursTotal / config.weeklyGoals.manualHours) * 100)}%`,
                }}
              />
            </div>
          </div>

          {/* Independent Drafts Started */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-center">
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {draftsTotal} / {config.weeklyGoals.independentDrafts}
            </div>
            <div className="text-xs font-semibold text-slate-900 dark:text-white mt-1">
              Independent Drafts
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Drafts started before consulting AI assistants
            </p>
            <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-3 overflow-hidden">
              <div
                className="bg-indigo-600 h-1.5 rounded-full"
                style={{
                  width: `${Math.min(
                    100,
                    (draftsTotal / config.weeklyGoals.independentDrafts) * 100
                  )}%`,
                }}
              />
            </div>
          </div>

          {/* Topics Mastered */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-center">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {topicsTotal} / {config.weeklyGoals.topicsLearned}
            </div>
            <div className="text-xs font-semibold text-slate-900 dark:text-white mt-1">
              Topics Mastered
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Concepts completed through Coach checkpoints
            </p>
            <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-3 overflow-hidden">
              <div
                className="bg-amber-600 h-1.5 rounded-full"
                style={{
                  width: `${Math.min(
                    100,
                    (topicsTotal / config.weeklyGoals.topicsLearned) * 100
                  )}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
