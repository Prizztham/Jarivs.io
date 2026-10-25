/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Map,
  Clock,
  Flag,
  Target,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  PlusCircle,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Calendar,
  BarChart3,
  ExternalLink,
  BookOpen,
  Info,
  X,
} from 'lucide-react';
import {
  AppConfig,
  Attempt,
  Decision,
  DomainItem,
  LogEntry,
  Rehearsal,
  Session,
  TrackerEntry,
  UserProfile,
} from '../types';
import {
  calculateActivityGraphData,
  calculateCalibrationBuckets,
  calculateHumanFirstRate,
  calculateWinRates,
  ActivityDaySummary,
} from '../utils/rules';
import { Storage } from '../utils/storage';
import { ProgressPanel } from './ProgressPanel';

interface GrowthViewProps {
  user?: UserProfile;
  attempts?: Attempt[];
  domains: DomainItem[];
  decisions: Decision[];
  sessions: Session[];
  rehearsals: Rehearsal[];
  logEntries: LogEntry[];
  trackerEntries: TrackerEntry[];
  config: AppConfig;
  onNavigateToAskDomain: (domainId: string) => void;
  onOpenLogHours: () => void;
  onRefreshData: () => void;
}

export const GrowthView: React.FC<GrowthViewProps> = ({
  user: userProp,
  attempts: attemptsProp,
  domains,
  decisions,
  sessions,
  rehearsals,
  logEntries,
  trackerEntries,
  config,
  onNavigateToAskDomain,
  onOpenLogHours,
  onRefreshData,
}) => {
  const [activeTab, setActiveTab] = useState<'scorecard' | 'growth_map' | 'tracker' | 'ai_log'>('scorecard');
  const [graphWindow, setGraphWindow] = useState<'weekly' | 'monthly'>('monthly');

  // Selected day or session for detailed report modal (PRD Section 7)
  const [selectedDaySummary, setSelectedDaySummary] = useState<ActivityDaySummary | null>(null);
  const [selectedSessionDetail, setSelectedSessionDetail] = useState<Session | null>(null);

  // Weekly review reflection state
  const [reflectionText, setReflectionText] = useState('');
  const [reflectionSaved, setReflectionSaved] = useState(false);

  // Get live user and attempts
  const user = userProp || Storage.getUserProfile();
  const attempts = attemptsProp || Storage.getAttempts();

  // Computed activity graph data (7 days or 30 days)
  const activityData = useMemo(() => {
    const days = graphWindow === 'weekly' ? 7 : 30;
    return calculateActivityGraphData(sessions, attempts, logEntries, trackerEntries, days);
  }, [sessions, attempts, logEntries, trackerEntries, graphWindow]);

  // Overall rolling 7-day human-first rate
  const humanFirstRate = calculateHumanFirstRate(sessions, domains, 7);

  // Win rates & Calibration
  const winRates = calculateWinRates(decisions);
  const calibrationBuckets = calculateCalibrationBuckets(decisions);

  const avgRehearsal = rehearsals.length
    ? Math.round(rehearsals.reduce((sum, r) => sum + r.avgScore, 0) / rehearsals.length)
    : 85;

  // Breakdown of decisions by source
  const sourceBreakdown = {
    mine: decisions.filter(d => d.chosen === 'mine').length,
    ai: decisions.filter(d => d.chosen === 'ai').length,
    merged: decisions.filter(d => d.chosen === 'merged').length,
    total: Math.max(1, decisions.length),
  };

  // Flag counts by type
  const flagCountsByType = {
    wrong_assumption: logEntries.filter(e => e.type === 'wrong_assumption').length,
    missed_context: logEntries.filter(e => e.type === 'missed_context').length,
    wrong_fact: logEntries.filter(e => e.type === 'wrong_fact').length,
    tone_mismatch: logEntries.filter(e => e.type === 'tone_mismatch').length,
  };

  const handleSaveReflection = () => {
    if (!reflectionText.trim()) return;

    Storage.addPointEvent({
      id: `pt_ref_${Date.now()}`,
      type: 'ai_log_reflection',
      points: config.points.aiLogReflection,
      description: 'Completed weekly AI flaw reflection review (+8 pts)',
      createdAt: new Date().toISOString(),
    });

    Storage.logAnalyticsEvent('ai_flagged', { note: reflectionText });
    setReflectionSaved(true);
    setReflectionText('');
    setTimeout(() => {
      setReflectionSaved(false);
      onRefreshData();
    }, 1200);
  };

  // Maximum activity count for bar chart scaling
  const maxBarValue = Math.max(
    1,
    ...activityData.map(d => d.sessionsCount + d.attemptsCount + d.correctionsCount)
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      {/* Top Header & Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Growth & Practice Progress
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Deliberate practice analytics, independent takes, and calibration reports.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold">
          {[
            { id: 'scorecard', label: 'Scorecard & Activity' },
            { id: 'growth_map', label: 'Growth Map' },
            { id: 'tracker', label: 'Tracker' },
            { id: 'ai_log', label: `AI Mistake Log (${logEntries.length})` },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                activeTab === t.id
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* FULL PROGRESS PANEL (PRD V2 Section 3: Show full Progress panel on Growth) */}
      <ProgressPanel
        user={user}
        sessions={sessions}
        attempts={attempts}
        domains={domains}
        onGoalUpdated={onRefreshData}
      />

      {/* =========================================================================
          TAB 1: SCORECARD & ACTIVITY GRAPH (PRD Section 7)
         ========================================================================= */}
      {activeTab === 'scorecard' && (
        <div className="space-y-6">
          {/* VISIBLE ACTIVITY GRAPH (PRD Section 7: do not leave main area blank) */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-teal-600" />
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    Deliberate Practice Activity Timeline
                  </h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Click on any day bar to view detailed learning questions, verified corrections, and attempts.
                </p>
              </div>

              {/* Weekly vs Monthly Toggle */}
              <div className="flex p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-semibold self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setGraphWindow('weekly')}
                  className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                    graphWindow === 'weekly'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Weekly View (7d)
                </button>
                <button
                  type="button"
                  onClick={() => setGraphWindow('monthly')}
                  className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                    graphWindow === 'monthly'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Monthly View (30d)
                </button>
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-1">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-teal-500 inline-block"></span>
                <span>Qualifying Own Takes</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-indigo-500 inline-block"></span>
                <span>Sessions & Coach Checkpoints</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block"></span>
                <span>Identified Mistakes / Corrections</span>
              </span>
            </div>

            {/* Interactive Bars Container */}
            <div className="pt-4 overflow-x-auto">
              <div className="min-w-[600px] flex items-end justify-between gap-1.5 h-44 pb-6 pt-2 px-1 border-b border-slate-100 dark:border-slate-800">
                {activityData.map((day, idx) => {
                  const total = day.attemptsCount + day.sessionsCount + day.correctionsCount;
                  const barHeightPct = Math.max(8, Math.round((total / maxBarValue) * 100));

                  return (
                    <button
                      key={day.date}
                      type="button"
                      onClick={() => setSelectedDaySummary(day)}
                      title={`${day.dayLabel}: ${day.attemptsCount} own takes, ${day.sessionsCount} sessions, ${day.correctionsCount} corrections`}
                      className="group flex-1 flex flex-col items-center justify-end h-full cursor-pointer focus:outline-none"
                    >
                      <div className="w-full max-w-[20px] rounded-t-sm flex flex-col-reverse overflow-hidden transition-all group-hover:brightness-110" style={{ height: `${barHeightPct}%` }}>
                        {/* Own takes in teal */}
                        {day.attemptsCount > 0 && (
                          <div
                            className="bg-teal-500 w-full"
                            style={{ height: `${Math.round((day.attemptsCount / total) * 100)}%` }}
                          />
                        )}
                        {/* Sessions in indigo */}
                        {day.sessionsCount > 0 && (
                          <div
                            className="bg-indigo-500 w-full"
                            style={{ height: `${Math.round((day.sessionsCount / total) * 100)}%` }}
                          />
                        )}
                        {/* Corrections in amber */}
                        {day.correctionsCount > 0 && (
                          <div
                            className="bg-amber-500 w-full"
                            style={{ height: `${Math.round((day.correctionsCount / total) * 100)}%` }}
                          />
                        )}
                        {total === 0 && <div className="bg-slate-200 dark:bg-slate-800 w-full h-1" />}
                      </div>
                      <span className="text-[10px] text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white mt-2 block truncate w-full text-center">
                        {day.dayLabel.split(' ')[1]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* DAY DETAIL MODAL (PRD Section 7: shows what was learned, domain, original attempts, corrections made, AI errors) */}
          {selectedDaySummary && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
              <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Activity Report for {selectedDaySummary.dayLabel} ({selectedDaySummary.date})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Detailed breakdown of deliberate attempts, topics tackled, and verified corrections.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedDaySummary(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Day KPI chips */}
                <div className="grid grid-cols-3 gap-3 text-center text-xs">
                  <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800">
                    <span className="text-xl font-bold text-teal-700 dark:text-teal-300 block">
                      {selectedDaySummary.attemptsCount}
                    </span>
                    <span className="text-[11px] text-slate-600 dark:text-slate-400">Qualifying Takes</span>
                  </div>
                  <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
                    <span className="text-xl font-bold text-indigo-700 dark:text-indigo-300 block">
                      {selectedDaySummary.sessionsCount}
                    </span>
                    <span className="text-[11px] text-slate-600 dark:text-slate-400">Sessions Tackled</span>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                    <span className="text-xl font-bold text-amber-700 dark:text-amber-300 block">
                      {selectedDaySummary.correctionsCount}
                    </span>
                    <span className="text-[11px] text-slate-600 dark:text-slate-400">Model Flaws Logged</span>
                  </div>
                </div>

                {/* Sessions tackled on this date */}
                <div className="space-y-3 pt-2">
                  <span className="font-bold text-xs text-slate-900 dark:text-white block">
                    Learning Questions & Topics on this Day:
                  </span>
                  {sessions.filter(s => s.createdAt.startsWith(selectedDaySummary.date)).length === 0 ? (
                    <p className="text-xs text-slate-400 py-3 text-center">
                      No active sessions recorded on this date.
                    </p>
                  ) : (
                    sessions
                      .filter(s => s.createdAt.startsWith(selectedDaySummary.date))
                      .map(s => {
                        const domain = domains.find(d => d.id === s.domainId);
                        const attempt = attempts.find(a => a.id === s.attemptId);
                        return (
                          <div
                            key={s.id}
                            className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider text-[10px]">
                                {domain?.name || 'General Domain'} {s.topicName ? `• ${s.topicName}` : ''}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                {new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-slate-900 dark:text-white font-semibold">
                              "{s.question}"
                            </p>
                            {attempt && (
                              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                                    Your Independent Attempt:
                                  </span>
                                  <span className="text-teal-600 font-bold">
                                    Quality: {attempt.score}/100
                                  </span>
                                </div>
                                <p className="text-slate-600 dark:text-slate-300 italic text-[11px]">
                                  "{attempt.text}"
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })
                  )}
                </div>

                {/* Model Flaws & Corrections on this date */}
                <div className="space-y-3 pt-2">
                  <span className="font-bold text-xs text-slate-900 dark:text-white block">
                    Corrections & Identified Mistakes on this Day:
                  </span>
                  {logEntries.filter(l => l.createdAt.startsWith(selectedDaySummary.date)).length === 0 ? (
                    <p className="text-xs text-slate-400 py-3 text-center">
                      No model flaws or corrections logged on this date.
                    </p>
                  ) : (
                    logEntries
                      .filter(l => l.createdAt.startsWith(selectedDaySummary.date))
                      .map(l => (
                        <div
                          key={l.id}
                          className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/80 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-amber-700 dark:text-amber-400 uppercase text-[10px]">
                              {l.type.replace('_', ' ')}
                            </span>
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                                l.verified
                                  ? 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300'
                                  : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {l.verified ? 'Verified Flaw' : 'Observation (Pending validation)'}
                            </span>
                          </div>
                          <p className="text-slate-800 dark:text-slate-200 font-medium">
                            "{l.note}"
                          </p>
                        </div>
                      ))
                  )}
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setSelectedDaySummary(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 cursor-pointer"
                  >
                    Close Report
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* North Star Metrics Grid (with numerator/denominator display) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Human-First Rolling 7-day Rate */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
                <span>Human-first rate (7d)</span>
                <span className="font-bold text-teal-600">
                  {humanFirstRate.numerator}/{humanFirstRate.denominator}
                </span>
              </div>
              <div className="text-3xl font-extrabold text-slate-900 dark:text-white">
                {humanFirstRate.rate}%
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {humanFirstRate.denominator === 0
                  ? 'Your first take starts your progress'
                  : `${humanFirstRate.numerator} of ${humanFirstRate.denominator} questions started with own take`}
              </p>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
                <div className="bg-teal-600 h-1.5 rounded-full" style={{ width: `${humanFirstRate.rate}%` }} />
              </div>
            </div>

            {/* Win Rate: User vs AI */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
                <span>Your Calls Win Rate</span>
                <span className="text-emerald-600 font-semibold">{winRates.userCount} calls</span>
              </div>
              <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {winRates.userWinRate}%
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                vs AI standalone: {winRates.aiWinRate}% ({winRates.aiCount} calls)
              </p>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
                <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${winRates.userWinRate}%` }} />
              </div>
            </div>

            {/* Rehearsal Average Score */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
                <span>Defend-It Readiness</span>
                <span className="font-bold text-indigo-600">{rehearsals.length} sessions</span>
              </div>
              <div className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400">
                {avgRehearsal}/100
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Pass threshold: 60/100 (Stress-tested defense)
              </p>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
                <div className="bg-indigo-600 h-1.5 rounded-full" style={{ width: `${avgRehearsal}%` }} />
              </div>
            </div>

            {/* Decisions by Source */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                Decisions by Stance
              </div>
              <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center justify-between mb-1.5">
                <span>Mine: {sourceBreakdown.mine}</span>
                <span>Merged: {sourceBreakdown.merged}</span>
                <span>AI: {sourceBreakdown.ai}</span>
              </div>
              <div className="w-full h-3 rounded-full flex overflow-hidden bg-slate-100 dark:bg-slate-800 mt-3">
                <div
                  title="My take"
                  className="bg-teal-500 h-full"
                  style={{ width: `${(sourceBreakdown.mine / sourceBreakdown.total) * 100}%` }}
                />
                <div
                  title="Merged synthesis"
                  className="bg-indigo-500 h-full"
                  style={{ width: `${(sourceBreakdown.merged / sourceBreakdown.total) * 100}%` }}
                />
                <div
                  title="AI direct"
                  className="bg-slate-400 h-full"
                  style={{ width: `${(sourceBreakdown.ai / sourceBreakdown.total) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span className="text-teal-600 font-medium">● Mine</span>
                <span className="text-indigo-600 font-medium">● Merged</span>
                <span className="text-slate-400 font-medium">● AI</span>
              </div>
            </div>
          </div>

          {/* Calibration Chart with sample size suppression (PRD Section 7) */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Confidence Calibration Breakdown
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Compares stated confidence against actual historical decision accuracy. Claims are suppressed when sample sizes are below 3 decisions.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-2">
              {calibrationBuckets.map((bucket, i) => {
                const diff = Math.abs(bucket.actualAccuracyPct - bucket.statedConfidenceAvg);
                const isWellCalibrated = bucket.total >= 3 && diff <= 15;
                return (
                  <div
                    key={i}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-center"
                  >
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                      {bucket.range} Stated
                    </span>
                    <div className="text-xl font-bold text-slate-900 dark:text-white my-1">
                      {bucket.total > 0 ? `${bucket.actualAccuracyPct}%` : '—'}
                    </div>
                    <span className="text-[10px] text-slate-500 block">
                      {bucket.total} decision{bucket.total !== 1 ? 's' : ''} ({bucket.accurateCount}/{bucket.total})
                    </span>
                    {bucket.total > 0 && (
                      <span
                        className={`inline-block mt-2 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          bucket.suppressed
                            ? 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                            : isWellCalibrated
                            ? 'bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300'
                            : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                        }`}
                      >
                        {bucket.suppressed
                          ? 'Small sample (insufficient data)'
                          : isWellCalibrated
                          ? 'Well calibrated'
                          : 'Divergent'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: GROWTH MAP (PRD Section 3: Add human-first rate to every domain tile)
         ========================================================================= */}
      {activeTab === 'growth_map' && (
        <div className="space-y-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Growth domain tiles showing domain proficiency, human-first rate, and 30-day activity.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {domains
              .filter(d => d.isGrowth)
              .map(domain => {
                const domainSessions = sessions.filter(s => s.domainId === domain.id);
                const domainHF = calculateHumanFirstRate(domainSessions, [domain], 7);
                const lastPracticed = domainSessions[0]?.createdAt
                  ? new Date(domainSessions[0].createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })
                  : '3 days ago';

                return (
                  <div
                    key={domain.id}
                    className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-teal-50 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                          {domain.level}
                        </span>
                        {domain.isCustom && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                            Custom Topic
                          </span>
                        )}
                      </div>

                      <h3 className="font-bold text-base text-slate-900 dark:text-white mb-1">
                        {domain.name}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                        Last practiced: {lastPracticed}
                      </p>

                      <div className="space-y-1 mb-4">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Human-first rate (7d)</span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {domainHF.denominator === 0
                              ? 'No takes yet'
                              : `${domainHF.rate}% (${domainHF.numerator} of ${domainHF.denominator})`}
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-teal-600 h-1.5 rounded-full"
                            style={{ width: `${domainHF.rate}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onNavigateToAskDomain(domain.id)}
                      className="w-full py-2 px-3 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>Practice in this domain</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: TRACKER & DELIBERATION LOG (PRD Section 5: distinguish self-reported)
         ========================================================================= */}
      {activeTab === 'tracker' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Deliberate Thinking & Learning Tracker
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Tracks offline learning hours, independent drafts, and mastered topics. Clearly distinguishes self-reported from internally observed events.
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenLogHours}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Log Offline Hours</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {trackerEntries.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  No tracker entries logged yet. Click "Log Offline Hours" or complete deliberate drafts in Ask.
                </div>
              ) : (
                trackerEntries.map(entry => (
                  <div
                    key={entry.id}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {entry.type === 'manual_hours' && `Offline Deliberation: ${entry.count} hours`}
                          {entry.type === 'independent_draft' && `Independent First Draft (${entry.count})`}
                          {entry.type === 'topic_mastered' && `Topic Mastered: ${entry.topicName || 'Strategic Practice'}`}
                          {entry.type === 'topic_explored' && `Topic Practised: ${entry.topicName || 'Strategic Practice'}`}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                            entry.source === 'self_reported'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              : 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300'
                          }`}
                        >
                          {entry.source === 'self_reported' ? 'Self-reported' : 'Internally observed'}
                        </span>
                      </div>
                      {entry.note && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          "{entry.note}"
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: AI MISTAKE LOG (PRD Section 7: do not imply correction was right unless verified)
         ========================================================================= */}
      {activeTab === 'ai_log' && (
        <div className="space-y-6">
          {/* Weekly Prompt Card (+8 points) */}
          <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-amber-500/10 via-white to-teal-500/10 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 border border-amber-500/30 dark:border-amber-500/20 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flag className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Weekly Reflection: "Take two minutes to review where your agent missed this week"
                </h3>
              </div>
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                +8 pts for review
              </span>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400">
              Spotting AI blindspots (wrong assumptions, tone mismatches, missed context) is the hallmark of sharp judgement. Record a brief synthesis of model errors observed this week.
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                value={reflectionText}
                onChange={e => setReflectionText(e.target.value)}
                placeholder="e.g. Notice model consistently underestimates customer support queue latency..."
                className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button
                type="button"
                onClick={handleSaveReflection}
                disabled={!reflectionText.trim() || reflectionSaved}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                {reflectionSaved ? 'Logged (+8 pts)!' : 'Submit Review'}
              </button>
            </div>
          </div>

          {/* Breakdown by Category */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { type: 'Wrong Assumption', count: flagCountsByType.wrong_assumption, color: 'text-amber-600' },
              { type: 'Missed Context', count: flagCountsByType.missed_context, color: 'text-indigo-600' },
              { type: 'Wrong Fact', count: flagCountsByType.wrong_fact, color: 'text-rose-600' },
              { type: 'Tone Mismatch', count: flagCountsByType.tone_mismatch, color: 'text-teal-600' },
            ].map((f, i) => (
              <div
                key={i}
                className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center"
              >
                <div className={`text-2xl font-bold ${f.color}`}>{f.count}</div>
                <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-0.5">
                  {f.type}
                </div>
              </div>
            ))}
          </div>

          {/* List of Flagged Gaps */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-3">
              User-Reported AI Flaws ({logEntries.length})
            </h3>
            <div className="space-y-3">
              {logEntries.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">
                  No issues flagged yet. You can flag assumptions or flaws on any AI response in the Ask view.
                </p>
              ) : (
                logEntries.map(entry => (
                  <div
                    key={entry.id}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider text-[10px]">
                        {entry.type.replace('_', ' ')}
                      </span>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                            entry.verified
                              ? 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300'
                              : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {entry.verified ? 'Verified Model Flaw' : 'User Observation (Pending validation)'}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(entry.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    {entry.questionText && (
                      <p className="text-slate-500 font-medium">
                        On: "{entry.questionText}"
                      </p>
                    )}
                    <p className="text-slate-800 dark:text-slate-200 font-semibold">
                      "{entry.note}"
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
