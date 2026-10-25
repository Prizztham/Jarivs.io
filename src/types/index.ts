/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AudienceType = 'Senior leader' | 'Peer' | 'Client' | 'Team';
export type DomainLevel = 'Beginner' | 'Developing' | 'Strong';
export type TimeBudget = '2m' | '5m' | '15m' | 'norush';
export type AppMode = 'help_me_grow' | 'get_it_done';
export type DecisionChoice = 'mine' | 'ai' | 'merged';
export type DecisionOutcome = 'right' | 'mixed' | 'wrong' | 'pending';
export type FlagType = 'wrong_fact' | 'missed_context' | 'wrong_assumption' | 'tone_mismatch';
export type PlanType = 'free' | 'plus';

export interface UserProfile {
  id: string;
  name: string;
  plan: PlanType;
  onboardingDone: boolean;
  weeklyDelegationAllowance: number;
  delegationUsedThisWeek: number;
  lastAllowanceReset: string;
  urgentOverrideUntil?: number;
  ownTakesWeeklyGoal: number; // Default 10, user editable
  lastDailyCheckinDate?: string; // YYYY-MM-DD
  aiLockSchedule?: {
    enabled: boolean;
    startHour: number; // e.g. 9
    endHour: number; // e.g. 18
    days: number[]; // 1=Mon .. 5=Fri
  };
}

export interface DomainItem {
  id: string;
  name: string;
  isGrowth: boolean;
  level: DomainLevel;
  createdAt: string;
  isCustom?: boolean;
}

export interface Attempt {
  id: string;
  sessionId: string;
  text: string;
  confidencePct: number;
  score: number;
  isMeaningful: boolean;
  strengths: string[];
  gaps: string[];
  createdAt: string;
}

export interface Decision {
  id: string;
  sessionId: string;
  question: string;
  domainId: string;
  chosen: DecisionChoice;
  confidencePct: number;
  outcome: DecisionOutcome;
  outcomeDueAt: string;
  outcomeRecordedAt?: string;
  createdAt: string;
}

export interface TopicCheckpoint {
  id: string;
  checkpointNumber: number;
  prompt: string;
  criteria: string;
  hints: GuidedLevel[];
  resources: GuidedResource[];
  userAnswer?: string;
  score?: number; // 0-10 transparent score
  strengths?: string[];
  gaps?: string[];
  completedAt?: string;
}

export interface Session {
  id: string;
  domainId: string;
  mode: AppMode;
  question: string;
  timeBudget: TimeBudget;
  createdAt: string;
  usedClassicOnly: boolean;
  hintDepth: number;
  helpfulRating?: 'up' | 'down';
  attemptId?: string;
  decisionId?: string;
  classicAnswer?: ClassicAnswerData;
  // Topic coaching session fields (PRD V2 Section 6)
  topicName?: string;
  checkpoints?: TopicCheckpoint[];
  understandingConfidence?: number; // 0-100%
  overallTopicScore?: number; // e.g. 8.5/10
  hintsUsedCount?: number;
  isMastered?: boolean;
}

export interface Rehearsal {
  id: string;
  sessionId?: string;
  draftText: string;
  audience: AudienceType;
  questions: string[];
  answers: string[];
  scores: number[];
  feedbacks: string[];
  avgScore: number;
  strongestAnswer?: string;
  weakestAnswer?: string;
  suggestedCoachTopics?: string[];
  completedAt?: string;
  pointsAwarded?: boolean;
  createdAt: string;
}

export interface SpacedQuizQuestionItem {
  question: string;
  userAnswer?: string;
  score?: number;
  feedback?: string;
  needsLook?: boolean;
}

export interface SpacedRevisitQuiz {
  id: string;
  sessionId: string;
  topicName: string;
  domainId: string;
  domainName: string;
  daysAgoLearned: number;
  learnedAt: string;
  dueAt: string;
  questions: SpacedQuizQuestionItem[];
  completedAt?: string;
  passed?: boolean;
  score?: number;
  feedback?: string;
  aspectsToRevisit?: string[];
  pointsAwarded?: boolean;
}

export interface LogEntry {
  id: string;
  sessionId?: string;
  questionText?: string;
  aiSnippet?: string;
  domainId: string;
  type: FlagType;
  note: string;
  verified?: boolean; // PRD: "Do not imply that a user correction was right unless it has been verified"
  createdAt: string;
}

export interface PointEvent {
  id: string;
  type:
    | 'think_first_attempt'
    | 'guided_completed'
    | 'decision_logged'
    | 'calibration_bonus'
    | 'rehearsal_completed'
    | 'spaced_quiz_completed'
    | 'teach_back'
    | 'ai_log_reflection'
    | 'manual_hour_goal'
    | 'classic_without_take_penalty'
    | 'lock_override_penalty';
  points: number;
  domainId?: string;
  sessionId?: string;
  description: string;
  createdAt: string;
}

export interface WalletTransaction {
  id: string;
  type: 'deposit' | 'withdraw' | 'accrual' | 'penalty' | 'redeem';
  amount: number; // in INR for deposit/withdraw, or RC for rewards
  currency: 'INR' | 'RC';
  description: string;
  createdAt: string;
}

export interface Wallet {
  principal: number; // in INR
  rewardBalance: number; // in RC (1 RC = 1 INR coupon value)
  lifetimeRewards: number;
  transactions: WalletTransaction[];
}

export interface PartnerCoupon {
  id: string;
  partner: string;
  title: string;
  discount: string;
  costRC: number;
  category: string;
  mockCode?: string;
  redeemedAt?: string;
}

export interface TrackerEntry {
  id: string;
  type: 'manual_hours' | 'independent_draft' | 'topic_mastered' | 'topic_explored' | 'topic_learned';
  count: number;
  date?: string; // YYYY-MM-DD
  source?: 'self_reported' | 'jarvis_observed'; // PRD V2: distinguish self-reported from internally observed
  sessionId?: string;
  topicName?: string;
  note?: string;
  createdAt: string;
}

export interface Recall {
  id: string;
  sessionId?: string;
  sessionQuestion?: string;
  domainName?: string;
  domainId?: string;
  topic?: string;
  topicName?: string;
  questions: Array<{
    question: string;
    userAnswer?: string;
    score?: number;
    feedback?: string;
  }>;
  dueAt?: string;
  completedAt?: string;
  passed?: boolean;
  score?: number;
  createdAt?: string;
}


export interface AppConfig {
  points: {
    thinkFirstAttemptMax: number;
    thinkFirstMidPct: number;
    guidedPathCompleted: number;
    decisionLogged: number;
    calibrationBonus: number;
    rehearsalCompletedPass: number;
    rehearsalCompletedFail: number;
    teachBackSuccess: number;
    aiLogReflection: number;
    manualHourGoalMet: number;
    classicWithoutTakePenalty: number;
    lockOverridePenalty: number;
    dailyPositiveCap: number;
  };
  judgementIndex: {
    startingIndex: number;
    floor: number;
    multiplier: number;
  };
  rewardAccrual: {
    pointsRate: number; // RC per positive point
    maxPledgeRate: number; // weekly cap as fraction of pledge (e.g. 0.005 = 0.5%)
    penaltyRate: number; // RC deducted per penalty point
  };
  simulatedYieldAnnual: number; // 0.06 = 6.0%
  delegationAllowanceWeekly: number;
  aiLockDefaults: {
    ideaGateWords: number;
    timeLockMinutes: number;
    maxOverridesPerDay: number;
    urgentToggleMinutes: number;
  };
  nudges: {
    maxPerDay: number;
    quietHoursStart: number;
    quietHoursEnd: number;
  };
  weeklyGoals: {
    topicsLearned: number;
    independentDrafts: number;
    manualHours: number;
  };
}

export interface ClassicAnswerData {
  answer: string;
  confidencePct: number;
  assumptions: string[];
  mayBeWrongIf: string[];
}

export interface GuidedLevel {
  type: 'nudge' | 'guiding_question' | 'framework' | 'partial_answer' | 'full_answer';
  text: string;
}

export interface GuidedResource {
  title: string;
  source: string; // e.g. "Martin Fowler", "Harvard Business Review", "Google Cloud Architecture", "YouTube"
  type: 'article' | 'video' | 'concept' | 'document';
  why: string;
  searchQuery: string;
  url: string | null; // Verified real destination or null for search suggestion
}

export interface TopicSessionData {
  topicName: string;
  overview: string;
  checkpoints: Array<{
    checkpointNumber: number;
    prompt: string;
    criteria: string;
    hints: GuidedLevel[];
    resources: GuidedResource[];
  }>;
}

export interface GuidedPathData {
  steps: Array<{
    stepNumber: number;
    title: string;
    action: string;
    reflectionPrompt: string;
    hints: GuidedLevel[];
    resources: GuidedResource[];
  }>;
}

export interface CompareViewsData {
  agree: string[];
  differ: string[];
  userCaught: string[];
  aiCaught: string[];
  suggestedMerge: string;
}


export interface AnalyticsEvent {
  id: string;
  name:
    | 'onboarding_completed'
    | 'ask_submitted'
    | 'mode_selected'
    | 'attempt_submitted'
    | 'classic_chosen'
    | 'hint_revealed'
    | 'guided_completed'
    | 'topic_completed'
    | 'compare_viewed'
    | 'decision_logged'
    | 'outcome_recorded'
    | 'rehearsal_completed'
    | 'spaced_quiz_completed'
    | 'ai_flagged'
    | 'lock_override'
    | 'pledge_changed'
    | 'withdrawal'
    | 'coupon_redeemed'
    | 'plan_changed';
  timestamp: string;
  metadata?: Record<string, any>;
}
