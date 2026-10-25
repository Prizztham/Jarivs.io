/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AppConfig, Attempt, Decision, DomainItem, LogEntry, Session, TrackerEntry } from '../types/index.ts';

export const DEFAULT_CONFIG: AppConfig = {
  points: {
    thinkFirstAttemptMax: 10,
    thinkFirstMidPct: 0.6, // 6 points for score 40-69
    guidedPathCompleted: 15,
    decisionLogged: 8,
    calibrationBonus: 4,
    rehearsalCompletedPass: 20,
    rehearsalCompletedFail: 8,
    teachBackSuccess: 10,
    aiLogReflection: 8,
    manualHourGoalMet: 15,
    classicWithoutTakePenalty: -6,
    lockOverridePenalty: -5,
    dailyPositiveCap: 100,
  },
  judgementIndex: {
    startingIndex: 100,
    floor: 50,
    multiplier: 0.1,
  },
  rewardAccrual: {
    pointsRate: 0.05, // ₹0.05 per positive point (1 RC = ₹1)
    maxPledgeRate: 0.005, // 0.5% of pledge
    penaltyRate: 0.05, // ₹0.05 reduction per penalty point
  },
  simulatedYieldAnnual: 0.06, // 6.0% annual yield on pledge pool
  delegationAllowanceWeekly: 3,
  aiLockDefaults: {
    ideaGateWords: 40,
    timeLockMinutes: 30,
    maxOverridesPerDay: 3,
    urgentToggleMinutes: 60,
  },
  nudges: {
    maxPerDay: 2,
    quietHoursStart: 22,
    quietHoursEnd: 8,
  },
  weeklyGoals: {
    topicsLearned: 5,
    independentDrafts: 3,
    manualHours: 10,
  },
};

/**
 * Calculates points awarded for a think-first attempt.
 * If not meaningful or score < 40: 0 points.
 * If 40 <= score < 70: 60% of max points (6 pts).
 * If score >= 70: 100% of max points (10 pts).
 */
export function calculateAttemptPoints(
  score: number,
  isMeaningful: boolean,
  config: AppConfig = DEFAULT_CONFIG
): number {
  if (!isMeaningful || score < 40) {
    return 0;
  }
  if (score >= 70) {
    return config.points.thinkFirstAttemptMax;
  }
  return Math.round(config.points.thinkFirstAttemptMax * config.points.thinkFirstMidPct);
}

/**
 * Calculates calibration bonus points.
 * Outcome mapping: Right = 100, Mixed = 50, Wrong = 0.
 * If user's stated confidence is within 15 percentage points of the mapped accuracy, bonus is awarded.
 */
export function isCalibrated(
  confidencePct: number,
  outcome: 'right' | 'mixed' | 'wrong'
): boolean {
  let target = 50;
  if (outcome === 'right') target = 100;
  if (outcome === 'wrong') target = 0;

  return Math.abs(confidencePct - target) <= 15;
}

/**
 * Calculates points for logging a decision.
 */
export function calculateDecisionPoints(
  hasOwnTake: boolean,
  confidencePct: number,
  outcome?: 'right' | 'mixed' | 'wrong' | 'pending',
  config: AppConfig = DEFAULT_CONFIG
): { basePoints: number; calibrationBonus: number; total: number } {
  if (!hasOwnTake) {
    return { basePoints: 0, calibrationBonus: 0, total: 0 };
  }
  const basePoints = config.points.decisionLogged;
  let bonus = 0;
  if (outcome && outcome !== 'pending') {
    if (isCalibrated(confidencePct, outcome)) {
      bonus = config.points.calibrationBonus;
    }
  }
  return {
    basePoints,
    calibrationBonus: bonus,
    total: basePoints + bonus,
  };
}

/**
 * Rehearsal points: average score >= 60 awards +20, below 60 awards +8 for trying.
 */
export function calculateRehearsalPoints(
  avgScore: number,
  config: AppConfig = DEFAULT_CONFIG
): number {
  if (avgScore >= 60) {
    return config.points.rehearsalCompletedPass;
  }
  return config.points.rehearsalCompletedFail;
}

/**
 * Spaced quiz / teach back points: 2 of 3 correct or sound gives +10.
 */
export function calculateSpacedQuizPoints(
  soundCount: number,
  config: AppConfig = DEFAULT_CONFIG
): number {
  return soundCount >= 2 ? config.points.teachBackSuccess : 0;
}

/**
 * Judgement Index formula retained internally for ledger logic if needed.
 */
export function calculateJudgementIndex(
  previousIndex: number,
  netPoints: number,
  config: AppConfig = DEFAULT_CONFIG
): number {
  const next = previousIndex + netPoints * config.judgementIndex.multiplier;
  const floored = Math.max(config.judgementIndex.floor, next);
  return Math.round(floored * 10) / 10;
}

/**
 * Weekly reward balance accrual.
 */
export function calculateRewardDelta(
  positivePoints: number,
  penaltyPoints: number,
  pledge: number,
  config: AppConfig = DEFAULT_CONFIG
): number {
  const maxCap = pledge * config.rewardAccrual.maxPledgeRate;
  const earned = Math.min(positivePoints * config.rewardAccrual.pointsRate, maxCap);
  const deduction = Math.abs(penaltyPoints) * config.rewardAccrual.penaltyRate;
  return Math.round((earned - deduction) * 100) / 100;
}

/**
 * Human-First Rate (PRD V2 Section 3):
 * Percentage of growth-domain questions where the user submitted their own take before seeing the AI answer,
 * calculated over a rolling 7-day window.
 * Returns { percentage, numerator, denominator, changeFromLastWeekText, isHigher }
 */
export function calculateHumanFirstRate(
  sessions: Session[],
  domains: DomainItem[],
  daysWindow = 7
): {
  rate: number;
  numerator: number;
  denominator: number;
  changeText: string;
  isHigher: boolean;
} {
  const growthIds = new Set(domains.filter(d => d.isGrowth).map(d => d.id));
  const now = Date.now();
  const currentWindowStart = now - daysWindow * 86400000;
  const prevWindowStart = now - daysWindow * 2 * 86400000;

  // Filter current window
  const currentGrowthSessions = sessions.filter(s => {
    const t = new Date(s.createdAt).getTime();
    return t >= currentWindowStart && growthIds.has(s.domainId);
  });

  const denominator = currentGrowthSessions.length;
  const numerator = currentGrowthSessions.filter(s => !s.usedClassicOnly && s.attemptId).length;
  const rate = denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;

  // Filter previous window for comparison
  const prevGrowthSessions = sessions.filter(s => {
    const t = new Date(s.createdAt).getTime();
    return t >= prevWindowStart && t < currentWindowStart && growthIds.has(s.domainId);
  });
  const prevDenom = prevGrowthSessions.length;
  const prevNum = prevGrowthSessions.filter(s => !s.usedClassicOnly && s.attemptId).length;
  const prevRate = prevDenom > 0 ? Math.round((prevNum / prevDenom) * 100) : 0;

  let changeText = 'Your first take starts your progress';
  let isHigher = true;

  if (denominator > 0 && prevDenom > 0) {
    const diff = rate - prevRate;
    if (diff > 0) {
      changeText = `Up ${diff} percentage points from last week`;
      isHigher = true;
    } else if (diff < 0) {
      changeText = 'A lighter week';
      isHigher = false;
    } else {
      changeText = 'Consistent with last week';
      isHigher = true;
    }
  } else if (denominator > 0) {
    changeText = `${numerator} of ${denominator} decisions started with your own take`;
    isHigher = true;
  }

  return { rate, numerator, denominator, changeText, isHigher };
}

/**
 * Weekly Human-First Bars for the last four weeks.
 */
export function calculateWeeklyHumanFirstBars(
  sessions: Session[],
  domains: DomainItem[]
): Array<{ label: string; rate: number; numerator: number; denominator: number }> {
  const growthIds = new Set(domains.filter(d => d.isGrowth).map(d => d.id));
  const now = Date.now();
  const bars: Array<{ label: string; rate: number; numerator: number; denominator: number }> = [];

  for (let w = 3; w >= 0; w--) {
    const start = now - (w + 1) * 7 * 86400000;
    const end = now - w * 7 * 86400000;
    const weekSessions = sessions.filter(s => {
      const t = new Date(s.createdAt).getTime();
      return t >= start && t < end && growthIds.has(s.domainId);
    });

    const denom = weekSessions.length;
    const num = weekSessions.filter(s => !s.usedClassicOnly && s.attemptId).length;
    const rate = denom > 0 ? Math.round((num / denom) * 100) : 0;
    bars.push({
      label: w === 0 ? 'This wk' : `${w}w ago`,
      rate,
      numerator: num,
      denominator: denom,
    });
  }

  return bars;
}

/**
 * Qualifying own takes this week (PRD V2: score >= 40 in growth domain).
 */
export function calculateQualifyingTakesThisWeek(
  attempts: Attempt[],
  sessions: Session[],
  domains: DomainItem[]
): { count: number; goal: number } {
  const growthIds = new Set(domains.filter(d => d.isGrowth).map(d => d.id));
  const sessionMap = new Map(sessions.map(s => [s.id, s]));
  const weekStart = Date.now() - 7 * 86400000;

  const qualifying = attempts.filter(att => {
    const t = new Date(att.createdAt).getTime();
    if (t < weekStart) return false;
    if (att.score < 40 || !att.isMeaningful) return false;
    const sess = sessionMap.get(att.sessionId);
    if (!sess) return true; // standalone or linked
    return growthIds.has(sess.domainId);
  });

  return {
    count: qualifying.length,
    goal: 10,
  };
}

/**
 * Consecutive streak of days with at least one qualifying own take.
 * Supportive wording when reset, never shame user.
 */
export function calculateStreak(
  attempts: Attempt[],
  sessions: Session[],
  domains: DomainItem[]
): {
  currentStreak: number;
  bestStreak: number;
  message: string;
  isStreakActiveToday: boolean;
} {
  const growthIds = new Set(domains.filter(d => d.isGrowth).map(d => d.id));
  const sessionMap = new Map(sessions.map(s => [s.id, s]));

  // Find unique active calendar dates (YYYY-MM-DD)
  const dateSet = new Set<string>();
  attempts.forEach(att => {
    if (att.score >= 40 && att.isMeaningful) {
      const sess = sessionMap.get(att.sessionId);
      if (!sess || growthIds.has(sess.domainId)) {
        const dStr = new Date(att.createdAt).toISOString().split('T')[0];
        dateSet.add(dStr);
      }
    }
  });

  const sortedDates = Array.from(dateSet).sort();
  if (sortedDates.length === 0) {
    return {
      currentStreak: 0,
      bestStreak: 0,
      message: 'Start a new streak today with your first take',
      isStreakActiveToday: false,
    };
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const isStreakActiveToday = dateSet.has(todayStr);

  let currentStreak = 0;
  let checkDate = isStreakActiveToday ? new Date() : new Date(Date.now() - 86400000);

  // If neither today nor yesterday has a take, streak has reset
  if (!isStreakActiveToday && !dateSet.has(yesterdayStr)) {
    currentStreak = 0;
  } else {
    while (true) {
      const dStr = checkDate.toISOString().split('T')[0];
      if (dateSet.has(dStr)) {
        currentStreak++;
        checkDate = new Date(checkDate.getTime() - 86400000);
      } else {
        break;
      }
    }
  }

  // Calculate best streak historically
  let bestStreak = 0;
  let tempStreak = 0;
  for (let i = 0; i < sortedDates.length; i++) {
    if (i === 0) {
      tempStreak = 1;
    } else {
      const prev = new Date(sortedDates[i - 1]).getTime();
      const curr = new Date(sortedDates[i]).getTime();
      if (Math.round((curr - prev) / 86400000) === 1) {
        tempStreak++;
      } else {
        tempStreak = 1;
      }
    }
    if (tempStreak > bestStreak) bestStreak = tempStreak;
  }
  if (currentStreak > bestStreak) bestStreak = currentStreak;

  let message = '';
  if (currentStreak > 0) {
    message = `${currentStreak} day streak (Best: ${bestStreak} days)`;
  } else {
    message = 'Start a new streak today (Best: ' + bestStreak + ' days)';
  }

  return { currentStreak, bestStreak, message, isStreakActiveToday };
}

/**
 * Activity Graph Data (30-day timeline):
 * Shows daily sessions, qualifying attempts, and corrections/identified mistakes logged by day.
 */
export interface ActivityDaySummary {
  date: string;
  dayLabel: string;
  sessionsCount: number;
  attemptsCount: number;
  correctionsCount: number; // User-flagged mistakes/corrections
  manualHours: number;
  totalPoints: number;
}

export function calculateActivityGraphData(
  sessions: Session[],
  attempts: Attempt[],
  logEntries: LogEntry[],
  trackerEntries: TrackerEntry[],
  days = 30
): ActivityDaySummary[] {
  const result: ActivityDaySummary[] = [];
  const now = Date.now();

  for (let i = days - 1; i >= 0; i--) {
    const dayDate = new Date(now - i * 86400000);
    const dateStr = dayDate.toISOString().split('T')[0];
    const dayLabel = dayDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

    const daySessions = sessions.filter(s => s.createdAt.startsWith(dateStr));
    const dayAttempts = attempts.filter(a => a.createdAt.startsWith(dateStr));
    const dayLogs = logEntries.filter(l => l.createdAt.startsWith(dateStr));
    const dayTracker = trackerEntries.filter(t => t.date === dateStr || t.createdAt.startsWith(dateStr));

    const manualHours = dayTracker
      .filter(t => t.type === 'manual_hours')
      .reduce((sum, t) => sum + t.count, 0);

    result.push({
      date: dateStr,
      dayLabel,
      sessionsCount: daySessions.length,
      attemptsCount: dayAttempts.length,
      correctionsCount: dayLogs.length,
      manualHours,
      totalPoints: dayAttempts.reduce((sum, a) => sum + a.score, 0),
    });
  }

  return result;
}

/**
 * Win Rates calculation comparing user's stance calls vs AI direct choices.
 */
export function calculateWinRates(decisions: Decision[]): {
  userWinRate: number;
  userCount: number;
  aiWinRate: number;
  aiCount: number;
} {
  const userCalls = decisions.filter(d => (d.chosen === 'mine' || d.chosen === 'merged') && d.outcome && d.outcome !== 'pending');
  const aiCalls = decisions.filter(d => d.chosen === 'ai' && d.outcome && d.outcome !== 'pending');

  const userWins = userCalls.filter(d => d.outcome === 'right').length + userCalls.filter(d => d.outcome === 'mixed').length * 0.5;
  const aiWins = aiCalls.filter(d => d.outcome === 'right').length + aiCalls.filter(d => d.outcome === 'mixed').length * 0.5;

  const userWinRate = userCalls.length > 0 ? Math.round((userWins / userCalls.length) * 100) : 75;
  const aiWinRate = aiCalls.length > 0 ? Math.round((aiWins / aiCalls.length) * 100) : 68;

  return {
    userWinRate,
    userCount: userCalls.length,
    aiWinRate,
    aiCount: aiCalls.length,
  };
}

/**
 * Backward-compatible IDR calculation
 */
export function calculateIDR(
  decisions: Decision[],
  sessions: Session[],
  domains: DomainItem[]
): number {
  const growthDomainIds = new Set(domains.filter(d => d.isGrowth).map(d => d.id));
  const sessionMap = new Map(sessions.map(s => [s.id, s]));

  let growthDecisions = 0;
  let independentGrowthDecisions = 0;

  for (const dec of decisions) {
    const session = sessionMap.get(dec.sessionId);
    const domainId = dec.domainId || session?.domainId;
    if (domainId && growthDomainIds.has(domainId)) {
      growthDecisions++;
      if (session && !session.usedClassicOnly && (session.attemptId || dec.chosen === 'mine' || dec.chosen === 'merged')) {
        independentGrowthDecisions++;
      }
    }
  }

  if (growthDecisions === 0) return 0;
  return Math.round((independentGrowthDecisions / growthDecisions) * 100);
}

/**
 * Calibration buckets with small sample suppression.
 */
export interface CalibrationBucket {
  range: string;
  min: number;
  max: number;
  total: number;
  accurateCount: number;
  actualAccuracyPct: number;
  statedConfidenceAvg: number;
  suppressed: boolean; // PRD: "suppress strong calibration claims when sample sizes are too small"
}

export function calculateCalibrationBuckets(decisions: Decision[]): CalibrationBucket[] {
  const buckets: CalibrationBucket[] = [
    { range: '0-20%', min: 0, max: 20, total: 0, accurateCount: 0, actualAccuracyPct: 0, statedConfidenceAvg: 10, suppressed: true },
    { range: '21-40%', min: 21, max: 40, total: 0, accurateCount: 0, actualAccuracyPct: 0, statedConfidenceAvg: 30, suppressed: true },
    { range: '41-60%', min: 41, max: 60, total: 0, accurateCount: 0, actualAccuracyPct: 0, statedConfidenceAvg: 50, suppressed: true },
    { range: '61-80%', min: 61, max: 80, total: 0, accurateCount: 0, actualAccuracyPct: 0, statedConfidenceAvg: 70, suppressed: true },
    { range: '81-100%', min: 81, max: 100, total: 0, accurateCount: 0, actualAccuracyPct: 0, statedConfidenceAvg: 90, suppressed: true },
  ];

  const resolved = decisions.filter(d => d.outcome && d.outcome !== 'pending');

  for (const dec of resolved) {
    const conf = Math.max(0, Math.min(100, dec.confidencePct));
    const bucket = buckets.find(b => conf >= b.min && conf <= b.max) || buckets[buckets.length - 1];
    bucket.total++;
    if (dec.outcome === 'right') {
      bucket.accurateCount += 1;
    } else if (dec.outcome === 'mixed') {
      bucket.accurateCount += 0.5;
    }
  }

  for (const bucket of buckets) {
    if (bucket.total > 0) {
      bucket.actualAccuracyPct = Math.round((bucket.accurateCount / bucket.total) * 100);
      bucket.suppressed = bucket.total < 3; // Suppress strong claim if less than 3 samples
    }
  }

  return buckets;
}

export function countWords(text: string): number {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}
