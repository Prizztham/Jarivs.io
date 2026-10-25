/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Flame,
  CheckCircle2,
  TrendingUp,
  Edit2,
  Check,
  Target,
  Sparkles,
  BarChart2,
} from 'lucide-react';
import { Attempt, DomainItem, Session, UserProfile } from '../types';
import {
  calculateHumanFirstRate,
  calculateQualifyingTakesThisWeek,
  calculateStreak,
  calculateWeeklyHumanFirstBars,
} from '../utils/rules';
import { Storage } from '../utils/storage';

interface ProgressPanelProps {
  user: UserProfile;
  sessions: Session[];
  attempts: Attempt[];
  domains: DomainItem[];
  onGoalUpdated?: () => void;
}

export const ProgressPanel: React.FC<ProgressPanelProps> = ({
  user,
  sessions,
  attempts,
  domains,
  onGoalUpdated,
}) => {
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState(user.ownTakesWeeklyGoal || 10);

  // Compute metrics via pure rules engine
  const takesData = calculateQualifyingTakesThisWeek(attempts, sessions, domains);
  const weeklyGoal = user.ownTakesWeeklyGoal || 10;
  const takesCount = takesData.count;
  const takesPct = Math.min(100, Math.round((takesCount / weeklyGoal) * 100));

  const humanFirst = calculateHumanFirstRate(sessions, domains, 7);
  const weeklyBars = calculateWeeklyHumanFirstBars(sessions, domains);
  const streak = calculateStreak(attempts, sessions, domains);

  const handleSaveGoal = () => {
    const nextGoal = Math.max(1, Math.min(50, Number(goalInput) || 10));
    const updatedUser = { ...user, ownTakesWeeklyGoal: nextGoal };
    Storage.saveUserProfile(updatedUser);
    setIsEditingGoal(false);
    onGoalUpdated?.();
  };

  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
            <Target className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Weekly Progress & Deliberation
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Measuring deliberate human thought before AI delegation
            </p>
          </div>
        </div>

        {/* Streak Pill */}
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${
            streak.currentStreak > 0
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-300'
              : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
          }`}
        >
          <Flame
            className={`w-4 h-4 ${
              streak.currentStreak > 0 ? 'text-amber-500 animate-pulse' : 'text-slate-400'
            }`}
          />
          <span>{streak.message}</span>
        </div>
      </div>

      {/* Grid: 3 Core Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Pillar 1: Own takes this week */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span className="font-semibold uppercase tracking-wider text-[11px]">
                Own Takes This Week
              </span>
              {!isEditingGoal ? (
                <button
                  onClick={() => setIsEditingGoal(true)}
                  className="flex items-center gap-1 text-[11px] text-teal-600 hover:text-teal-700 dark:text-teal-400 cursor-pointer"
                  title="Edit weekly goal"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>Edit goal</span>
                </button>
              ) : (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={goalInput}
                    onChange={e => setGoalInput(Number(e.target.value))}
                    className="w-12 px-1 py-0.5 text-xs bg-white dark:bg-slate-900 border border-teal-500 rounded text-center"
                  />
                  <button
                    onClick={handleSaveGoal}
                    className="p-1 bg-teal-600 text-white rounded hover:bg-teal-700 cursor-pointer"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                {takesCount}
              </span>
              <span className="text-sm font-semibold text-slate-400">
                / {weeklyGoal} goal
              </span>
              <span className="text-xs font-bold text-teal-600 dark:text-teal-400 ml-auto">
                {takesPct}%
              </span>
            </div>

            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden mb-2">
              <div
                className="bg-teal-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${takesPct}%` }}
              />
            </div>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
            Qualifying take: reasoning score ≥ 40 in a growth domain before AI answer.
          </p>
        </div>

        {/* Pillar 2: Human-First Rate (7-day rolling) */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span className="font-semibold uppercase tracking-wider text-[11px]">
                Human-First Rate (7d)
              </span>
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                {humanFirst.numerator}/{humanFirst.denominator} requests
              </span>
            </div>

            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-3xl font-extrabold text-teal-600 dark:text-teal-400">
                {humanFirst.rate}%
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 mb-3">
              <TrendingUp
                className={`w-3.5 h-3.5 ${
                  humanFirst.isHigher ? 'text-teal-600' : 'text-slate-400'
                }`}
              />
              <span className="text-[11px]">{humanFirst.changeText}</span>
            </div>
          </div>

          {/* Micro-bars for 4 weeks */}
          <div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
              <span>Last 4 Weeks</span>
              <span>Baseline: 60%</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5 items-end h-9 pt-1">
              {weeklyBars.map((bar, idx) => (
                <div key={idx} className="flex flex-col items-center gap-1 h-full justify-end">
                  <div
                    className={`w-full rounded-sm transition-all duration-300 ${
                      bar.rate >= 60
                        ? 'bg-teal-500 dark:bg-teal-400'
                        : bar.rate > 0
                        ? 'bg-amber-400 dark:bg-amber-500'
                        : 'bg-slate-200 dark:bg-slate-700'
                    }`}
                    style={{ height: `${Math.max(15, bar.rate)}%` }}
                    title={`${bar.label}: ${bar.rate}% (${bar.numerator}/${bar.denominator})`}
                  />
                  <span className="text-[9px] text-slate-400 truncate w-full text-center">
                    {bar.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pillar 3: Streak & Daily Discipline */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span className="font-semibold uppercase tracking-wider text-[11px]">
                Consistency Streak
              </span>
              <span className="text-[11px] text-slate-400">
                Best: {streak.bestStreak}d
              </span>
            </div>

            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-3xl font-extrabold text-amber-500">
                {streak.currentStreak}
              </span>
              <span className="text-sm font-semibold text-slate-400">days</span>
            </div>

            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
              {streak.currentStreak > 0
                ? `${streak.currentStreak} consecutive day${
                    streak.currentStreak === 1 ? '' : 's'
                  } with at least one qualifying own take.`
                : 'Start a new streak today — one take is all it takes.'}
            </p>
          </div>

          <div
            className={`p-2 rounded-lg text-[11px] flex items-center gap-2 ${
              streak.isStreakActiveToday
                ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 border border-teal-200/60 dark:border-teal-900/40'
                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200/60 dark:border-amber-900/40'
            }`}
          >
            {streak.isStreakActiveToday ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                <span>Today's deliberate take completed!</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>Submit 1 own take today to keep your streak alive.</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
