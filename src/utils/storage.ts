/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AnalyticsEvent,
  AppConfig,
  Attempt,
  Decision,
  DomainItem,
  LogEntry,
  PartnerCoupon,
  PointEvent,
  Recall,
  Rehearsal,
  Session,
  SpacedRevisitQuiz,
  TrackerEntry,
  UserProfile,
  Wallet,
} from '../types';
import { DEFAULT_CONFIG } from './rules';

const STORAGE_KEYS = {
  USER: 'jarvis_user_profile',
  DOMAINS: 'jarvis_domains',
  SESSIONS: 'jarvis_sessions',
  ATTEMPTS: 'jarvis_attempts',
  DECISIONS: 'jarvis_decisions',
  REHEARSALS: 'jarvis_rehearsals',
  RECALLS: 'jarvis_recalls',
  AI_LOG: 'jarvis_ai_log',
  POINT_EVENTS: 'jarvis_point_events',
  WALLET: 'jarvis_wallet',
  COUPONS: 'jarvis_coupons',
  TRACKER: 'jarvis_tracker',
  CONFIG: 'jarvis_config',
  ANALYTICS: 'jarvis_analytics',
  THEME: 'jarvis_theme',
  SPACED_QUIZZES: 'jarvis_spaced_quizzes',
};

const DEFAULT_COUPONS: PartnerCoupon[] = [
  {
    id: 'c1',
    partner: 'PageTurn Books',
    title: 'PageTurn Books ₹100 voucher',
    discount: '₹100 off any executive leadership or strategic thinking book',
    costRC: 40,
    category: 'Books & Learning',
  },
  {
    id: 'c2',
    partner: 'LearnLoop',
    title: 'LearnLoop 15% course discount',
    discount: '15% off any masterclass in critical thinking and product strategy',
    costRC: 60,
    category: 'Courses',
  },
  {
    id: 'c3',
    partner: 'Notebook Co.',
    title: 'Notebook Co. ₹150 off',
    discount: '₹150 off archival analog journals and deliberate thinking planners',
    costRC: 70,
    category: 'Productivity',
  },
  {
    id: 'c4',
    partner: 'AudioShelf',
    title: 'AudioShelf one-month trial',
    discount: '1 Month of unlimited nonfiction audio summaries and debates',
    costRC: 30,
    category: 'Audio',
  },
  {
    id: 'c5',
    partner: 'FocusDesk Plus',
    title: 'FocusDesk Plus one month',
    discount: '1 Month of distraction-free workspace blocking and deep work sessions',
    costRC: 50,
    category: 'Software',
  },
  {
    id: 'c6',
    partner: 'Marketplace voucher',
    title: 'Marketplace voucher ₹200',
    discount: '₹200 universal digital goods voucher for educational resources',
    costRC: 90,
    category: 'General',
  },
];

const DEFAULT_DOMAINS: DomainItem[] = [
  { id: 'dom_writing', name: 'Writing and memos', isGrowth: true, level: 'Developing', createdAt: new Date().toISOString() },
  { id: 'dom_decision', name: 'Decision-making', isGrowth: true, level: 'Developing', createdAt: new Date().toISOString() },
  { id: 'dom_hiring', name: 'Hiring and people', isGrowth: true, level: 'Beginner', createdAt: new Date().toISOString() },
  { id: 'dom_analysis', name: 'Analysis', isGrowth: true, level: 'Strong', createdAt: new Date().toISOString() },
  { id: 'dom_presenting', name: 'Presenting', isGrowth: false, level: 'Beginner', createdAt: new Date().toISOString() },
  { id: 'dom_learning', name: 'Learning new topics', isGrowth: false, level: 'Beginner', createdAt: new Date().toISOString() },
];

const DEFAULT_USER: UserProfile = {
  id: 'usr_arjun',
  name: 'Arjun',
  plan: 'free',
  onboardingDone: true,
  weeklyDelegationAllowance: 3,
  delegationUsedThisWeek: 0,
  lastAllowanceReset: new Date().toISOString(),
  ownTakesWeeklyGoal: 10,
};

const DEFAULT_WALLET: Wallet = {
  principal: 2000,
  rewardBalance: 45,
  lifetimeRewards: 85,
  transactions: [
    {
      id: 'tx_init',
      type: 'deposit',
      amount: 2000,
      currency: 'INR',
      description: 'Initial deposit pledge (Simulated funds)',
      createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    },
    {
      id: 'tx_accrual_1',
      type: 'accrual',
      amount: 45,
      currency: 'RC',
      description: 'Weekly judgement reward accrual',
      createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    },
  ],
};

type Listener = () => void;
const listeners: Set<Listener> = new Set();

function notifyListeners() {
  listeners.forEach(fn => {
    try {
      fn();
    } catch (e) {
      console.error('Storage listener error', e);
    }
  });
}

export function subscribeToStorage(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Storage helpers
function getItem<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw);
  } catch (e) {
    console.warn(`Failed to parse localStorage key ${key}`, e);
    return defaultValue;
  }
}

function setItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    notifyListeners();
  } catch (e) {
    console.error(`Failed to set localStorage key ${key}`, e);
  }
}

export const Storage = {
  // User Profile
  getUserProfile(): UserProfile {
    return getItem<UserProfile>(STORAGE_KEYS.USER, DEFAULT_USER);
  },
  saveUserProfile(user: UserProfile): void {
    setItem(STORAGE_KEYS.USER, user);
  },

  // Domains
  getDomains(): DomainItem[] {
    return getItem<DomainItem[]>(STORAGE_KEYS.DOMAINS, DEFAULT_DOMAINS);
  },
  saveDomains(domains: DomainItem[]): void {
    setItem(STORAGE_KEYS.DOMAINS, domains);
  },
  updateDomainLevel(domainId: string, level: DomainItem['level']): void {
    const domains = this.getDomains().map(d => (d.id === domainId ? { ...d, level } : d));
    this.saveDomains(domains);
  },
  toggleGrowthDomain(domainId: string, isGrowth: boolean): void {
    const domains = this.getDomains().map(d => (d.id === domainId ? { ...d, isGrowth } : d));
    this.saveDomains(domains);
  },
  getCustomDomains(): DomainItem[] {
    return this.getDomains().filter(d => Boolean(d.isCustom));
  },
  getCustomDomainsCount(): number {
    return this.getCustomDomains().length;
  },
  addCustomDomain(name: string): { success: boolean; domain?: DomainItem; error?: string } {
    const customCount = this.getCustomDomainsCount();
    if (customCount >= 6) {
      return { success: false, error: 'Maximum 6 custom domains allowed. You have reached the limit.' };
    }
    const trimmed = name.trim();
    if (!trimmed) {
      return { success: false, error: 'Domain name cannot be empty.' };
    }
    const domains = this.getDomains();
    const newDomain: DomainItem = {
      id: `dom_custom_${Date.now()}`,
      name: trimmed,
      isGrowth: true,
      level: 'Beginner',
      createdAt: new Date().toISOString(),
      isCustom: true,
    };
    this.saveDomains([...domains, newDomain]);
    return { success: true, domain: newDomain };
  },

  // Config
  getConfig(): AppConfig {
    return getItem<AppConfig>(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
  },
  saveConfig(config: AppConfig): void {
    setItem(STORAGE_KEYS.CONFIG, config);
  },

  // Sessions
  getSessions(): Session[] {
    return getItem<Session[]>(STORAGE_KEYS.SESSIONS, []);
  },
  addSession(session: Session): void {
    const list = this.getSessions();
    setItem(STORAGE_KEYS.SESSIONS, [session, ...list]);
  },
  updateSession(session: Session): void {
    const list = this.getSessions().map(s => (s.id === session.id ? session : s));
    setItem(STORAGE_KEYS.SESSIONS, list);
  },

  // Attempts
  getAttempts(): Attempt[] {
    return getItem<Attempt[]>(STORAGE_KEYS.ATTEMPTS, []);
  },
  addAttempt(attempt: Attempt): void {
    const list = this.getAttempts();
    setItem(STORAGE_KEYS.ATTEMPTS, [attempt, ...list]);
  },

  // Decisions
  getDecisions(): Decision[] {
    return getItem<Decision[]>(STORAGE_KEYS.DECISIONS, []);
  },
  addDecision(decision: Decision): void {
    const list = this.getDecisions();
    setItem(STORAGE_KEYS.DECISIONS, [decision, ...list]);
  },
  updateDecision(decision: Decision): void {
    const list = this.getDecisions().map(d => (d.id === decision.id ? decision : d));
    setItem(STORAGE_KEYS.DECISIONS, list);
  },

  // Rehearsals
  getRehearsals(): Rehearsal[] {
    return getItem<Rehearsal[]>(STORAGE_KEYS.REHEARSALS, []);
  },
  addRehearsal(rehearsal: Rehearsal): void {
    const list = this.getRehearsals();
    setItem(STORAGE_KEYS.REHEARSALS, [rehearsal, ...list]);
  },

  // Recalls (Next-day teach-back)
  getRecalls(): Recall[] {
    return getItem<Recall[]>(STORAGE_KEYS.RECALLS, []);
  },
  addRecall(recall: Recall): void {
    const list = this.getRecalls();
    setItem(STORAGE_KEYS.RECALLS, [recall, ...list]);
  },
  updateRecall(recall: Recall): void {
    const list = this.getRecalls().map(r => (r.id === recall.id ? recall : r));
    setItem(STORAGE_KEYS.RECALLS, list);
  },

  // Spaced Revisit Quizzes (PRD V2 Section 7)
  getSpacedQuizzes(): SpacedRevisitQuiz[] {
    return getItem<SpacedRevisitQuiz[]>(STORAGE_KEYS.SPACED_QUIZZES, []);
  },
  addSpacedQuiz(quiz: SpacedRevisitQuiz): void {
    const list = this.getSpacedQuizzes();
    setItem(STORAGE_KEYS.SPACED_QUIZZES, [quiz, ...list]);
  },
  updateSpacedQuiz(quiz: SpacedRevisitQuiz): void {
    const list = this.getSpacedQuizzes().map(q => (q.id === quiz.id ? quiz : q));
    setItem(STORAGE_KEYS.SPACED_QUIZZES, list);
  },
  getPendingSpacedQuiz(): SpacedRevisitQuiz | null {
    const quizzes = this.getSpacedQuizzes();
    const now = new Date().toISOString();
    return quizzes.find(q => !q.completedAt && q.dueAt <= now) || null;
  },

  // Daily Check-in (PRD V2 Section 8)
  recordDailyCheckin(hours: number): void {
    const today = new Date().toISOString().slice(0, 10);
    const user = this.getUserProfile();
    this.saveUserProfile({ ...user, lastDailyCheckinDate: today });
    if (hours > 0) {
      this.addTrackerEntry({
        id: `tr_${Date.now()}`,
        type: 'manual_hours',
        count: hours,
        date: today,
        source: 'self_reported',
        note: `Self-reported ${hours}h learning outside Jarvis`,
        createdAt: new Date().toISOString(),
      });
    }
  },

  // AI Mistake Log
  getLogEntries(): LogEntry[] {
    return getItem<LogEntry[]>(STORAGE_KEYS.AI_LOG, []);
  },
  addLogEntry(entry: LogEntry): void {
    const list = this.getLogEntries();
    setItem(STORAGE_KEYS.AI_LOG, [entry, ...list]);
  },

  // Point Events
  getPointEvents(): PointEvent[] {
    return getItem<PointEvent[]>(STORAGE_KEYS.POINT_EVENTS, []);
  },
  addPointEvent(event: PointEvent): void {
    const list = this.getPointEvents();
    setItem(STORAGE_KEYS.POINT_EVENTS, [event, ...list]);
  },

  // Wallet
  getWallet(): Wallet {
    return getItem<Wallet>(STORAGE_KEYS.WALLET, DEFAULT_WALLET);
  },
  saveWallet(wallet: Wallet): void {
    setItem(STORAGE_KEYS.WALLET, wallet);
  },
  addPledge(amount: number): void {
    const w = this.getWallet();
    const updated: Wallet = {
      ...w,
      principal: w.principal + amount,
      transactions: [
        {
          id: `tx_${Date.now()}`,
          type: 'deposit',
          amount,
          currency: 'INR',
          description: `Added ₹${amount.toLocaleString()} to pledge`,
          createdAt: new Date().toISOString(),
        },
        ...w.transactions,
      ],
    };
    this.saveWallet(updated);
  },
  withdrawPledge(amount: number): boolean {
    const w = this.getWallet();
    if (w.principal < amount) return false;
    const updated: Wallet = {
      ...w,
      principal: w.principal - amount,
      transactions: [
        {
          id: `tx_${Date.now()}`,
          type: 'withdraw',
          amount,
          currency: 'INR',
          description: `Withdrew ₹${amount.toLocaleString()} from pledge`,
          createdAt: new Date().toISOString(),
        },
        ...w.transactions,
      ],
    };
    this.saveWallet(updated);
    return true;
  },

  // Coupons
  getCoupons(): PartnerCoupon[] {
    return getItem<PartnerCoupon[]>(STORAGE_KEYS.COUPONS, DEFAULT_COUPONS);
  },
  redeemCoupon(couponId: string): { success: boolean; code?: string; message?: string } {
    const coupons = this.getCoupons();
    const coupon = coupons.find(c => c.id === couponId);
    if (!coupon) return { success: false, message: 'Coupon not found' };

    const wallet = this.getWallet();
    if (wallet.rewardBalance < coupon.costRC) {
      return { success: false, message: `Insufficient RC balance. Requires ${coupon.costRC} RC.` };
    }

    const mockCode = `JARVIS-${coupon.partner.slice(0, 4).toUpperCase()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const updatedCoupons = coupons.map(c =>
      c.id === couponId ? { ...c, mockCode, redeemedAt: new Date().toISOString() } : c
    );
    setItem(STORAGE_KEYS.COUPONS, updatedCoupons);

    const updatedWallet: Wallet = {
      ...wallet,
      rewardBalance: wallet.rewardBalance - coupon.costRC,
      transactions: [
        {
          id: `tx_${Date.now()}`,
          type: 'redeem',
          amount: coupon.costRC,
          currency: 'RC',
          description: `Redeemed ${coupon.title}`,
          createdAt: new Date().toISOString(),
        },
        ...wallet.transactions,
      ],
    };
    this.saveWallet(updatedWallet);
    this.logAnalyticsEvent('coupon_redeemed', { couponId, cost: coupon.costRC });

    return { success: true, code: mockCode };
  },

  // Tracker
  getTrackerEntries(): TrackerEntry[] {
    return getItem<TrackerEntry[]>(STORAGE_KEYS.TRACKER, []);
  },
  addTrackerEntry(entry: TrackerEntry): void {
    const list = this.getTrackerEntries();
    setItem(STORAGE_KEYS.TRACKER, [entry, ...list]);
  },

  // Analytics
  getAnalyticsEvents(): AnalyticsEvent[] {
    return getItem<AnalyticsEvent[]>(STORAGE_KEYS.ANALYTICS, []);
  },
  logAnalyticsEvent(name: AnalyticsEvent['name'], metadata?: Record<string, any>): void {
    const list = this.getAnalyticsEvents();
    const event: AnalyticsEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name,
      timestamp: new Date().toISOString(),
      metadata,
    };
    setItem(STORAGE_KEYS.ANALYTICS, [event, ...list].slice(0, 100)); // retain last 100
  },

  // Theme
  getTheme(): 'dark' | 'light' {
    return getItem<'dark' | 'light'>(STORAGE_KEYS.THEME, 'dark');
  },
  setTheme(theme: 'dark' | 'light'): void {
    setItem(STORAGE_KEYS.THEME, theme);
  },

  // Reset
  resetAllData(): void {
    Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
    notifyListeners();
  },

  // Load 30-Day Demo Data (Arjun, Senior Manager)
  loadDemoData(): void {
    const now = Date.now();
    const day = 86400000;

    const domains: DomainItem[] = [
      { id: 'dom_writing', name: 'Writing and memos', isGrowth: true, level: 'Developing', createdAt: new Date(now - 30 * day).toISOString() },
      { id: 'dom_decision', name: 'Decision-making', isGrowth: true, level: 'Developing', createdAt: new Date(now - 30 * day).toISOString() },
      { id: 'dom_hiring', name: 'Hiring and people', isGrowth: true, level: 'Beginner', createdAt: new Date(now - 30 * day).toISOString() },
      { id: 'dom_analysis', name: 'Analysis', isGrowth: true, level: 'Strong', createdAt: new Date(now - 30 * day).toISOString() },
      { id: 'dom_presenting', name: 'Presenting', isGrowth: false, level: 'Beginner', createdAt: new Date(now - 30 * day).toISOString() },
      { id: 'dom_learning', name: 'Learning new topics', isGrowth: false, level: 'Beginner', createdAt: new Date(now - 30 * day).toISOString() },
    ];

    const user: UserProfile = {
      id: 'usr_arjun',
      name: 'Arjun',
      plan: 'free',
      onboardingDone: true,
      weeklyDelegationAllowance: 3,
      delegationUsedThisWeek: 1,
      lastAllowanceReset: new Date(now - 2 * day).toISOString(),
      ownTakesWeeklyGoal: 10,
      // lastDailyCheckinDate is undefined on first load so the dismissible prompt appears!
    };

    const sessions: Session[] = [];
    const attempts: Attempt[] = [];
    const decisions: Decision[] = [];
    const pointEvents: PointEvent[] = [];
    const logEntries: LogEntry[] = [];
    const trackerEntries: TrackerEntry[] = [];

    // Helper to format ISO date and YYYY-MM-DD
    const isoDate = (daysAgo: number, hoursOffset = 10) =>
      new Date(now - daysAgo * day + hoursOffset * 3600000).toISOString();
    const ymdDate = (daysAgo: number) =>
      new Date(now - daysAgo * day).toISOString().slice(0, 10);

    // Build 30 days of realistic history
    // Today (Day 0) - Qualifying own take
    sessions.push({
      id: 'sess_day0',
      domainId: 'dom_writing',
      mode: 'help_me_grow',
      question: 'How should I structure the quarterly technical strategy update for the executive team?',
      timeBudget: '5m',
      createdAt: isoDate(0, 2),
      usedClassicOnly: false,
      hintDepth: 2,
      attemptId: 'att_day0',
      overallTopicScore: 8.4,
    });
    attempts.push({
      id: 'att_day0',
      sessionId: 'sess_day0',
      text: 'Lead with platform latency reductions and business ROI first, before unpacking distributed tracing and service mesh migrations.',
      confidencePct: 85,
      score: 84,
      isMeaningful: true,
      strengths: ['Direct executive framing', 'Business ROI focus'],
      gaps: ['Could highlight customer impact metrics'],
      createdAt: isoDate(0, 2),
    });

    // Day 1 - Qualifying own take
    sessions.push({
      id: 'sess_1',
      domainId: 'dom_writing',
      mode: 'help_me_grow',
      question: 'How should I communicate the delay in Q3 Platform API deprecation to enterprise clients?',
      timeBudget: '5m',
      createdAt: isoDate(1),
      usedClassicOnly: false,
      hintDepth: 3,
      helpfulRating: 'up',
      attemptId: 'att_1',
      decisionId: 'dec_1',
      topicName: 'Platform API Deprecation Strategy',
      overallTopicScore: 8.2,
      classicAnswer: {
        answer: 'Send a phased advisory 60 days before the hard deadline, offering sandbox transition support and designated tech office hours.',
        confidencePct: 88,
        assumptions: ['Enterprise clients have active developer teams', 'Deprecation is non-breaking for read APIs'],
        mayBeWrongIf: ['Key partners lack dedicated engineering capacity this quarter', 'Contractual SLA guarantees deprecation freeze'],
      },
    });
    attempts.push({
      id: 'att_1',
      sessionId: 'sess_1',
      text: 'Frame the deprecation not as an inconvenience but as an infrastructure upgrade. Give a 60-day buffer, personal outreach to top 15 tier accounts, and automated migration scripts.',
      confidencePct: 85,
      score: 82,
      isMeaningful: true,
      strengths: ['Clear customer empathy', 'Concrete mitigation (top 15 accounts outreach)'],
      gaps: ['Could specify resource burden on internal engineering support'],
      createdAt: isoDate(1),
    });
    decisions.push({
      id: 'dec_1',
      sessionId: 'sess_1',
      domainId: 'dom_writing',
      question: 'How should I communicate the delay in Q3 Platform API deprecation to enterprise clients?',
      chosen: 'merged',
      confidencePct: 85,
      outcome: 'pending',
      outcomeDueAt: isoDate(-2),
      createdAt: isoDate(1),
    });

    // Day 2 - Qualifying own take
    sessions.push({
      id: 'sess_day2',
      domainId: 'dom_analysis',
      mode: 'help_me_grow',
      question: 'Analyze why trial-to-paid conversion dipped after the new onboarding checklist was introduced.',
      timeBudget: '15m',
      createdAt: isoDate(2),
      usedClassicOnly: false,
      hintDepth: 2,
      attemptId: 'att_day2',
      overallTopicScore: 7.9,
    });
    attempts.push({
      id: 'att_day2',
      sessionId: 'sess_day2',
      text: 'The 7-step checklist creates cognitive fatigue. Users drop off at step 4 (invite team member) before seeing core product utility.',
      confidencePct: 80,
      score: 79,
      isMeaningful: true,
      strengths: ['Isolated friction point', 'Understood user journey fatigue'],
      gaps: ['Compare with self-serve cohort data'],
      createdAt: isoDate(2),
    });

    // Day 3 - Qualifying own take
    sessions.push({
      id: 'sess_2',
      domainId: 'dom_decision',
      mode: 'help_me_grow',
      question: 'Should we rebuild our authentication service in-house or migrate to managed identity?',
      timeBudget: '15m',
      createdAt: isoDate(3),
      usedClassicOnly: false,
      hintDepth: 4,
      helpfulRating: 'up',
      attemptId: 'att_2',
      decisionId: 'dec_2',
      topicName: 'Managed Identity vs In-House Auth',
      overallTopicScore: 8.8,
    });
    attempts.push({
      id: 'att_2',
      sessionId: 'sess_2',
      text: 'Opt for managed identity. Auth is table stakes compliance liability; our core competitive advantage is our search intelligence, not reinventing OAuth2 and SOC2 audits.',
      confidencePct: 90,
      score: 88,
      isMeaningful: true,
      strengths: ['Identified core moat vs commodity maintenance', 'Addressed compliance risk'],
      gaps: ['Need to model vendor lock-in cost escalation at 5x volume'],
      createdAt: isoDate(3),
    });
    decisions.push({
      id: 'dec_2',
      sessionId: 'sess_2',
      domainId: 'dom_decision',
      question: 'Should we rebuild our authentication service in-house or migrate to managed identity?',
      chosen: 'mine',
      confidencePct: 90,
      outcome: 'right',
      outcomeDueAt: isoDate(1),
      outcomeRecordedAt: isoDate(1),
      createdAt: isoDate(3),
    });

    // Day 4 - Classic delegation session (without take)
    sessions.push({
      id: 'sess_day4_classic',
      domainId: 'dom_writing',
      mode: 'get_it_done',
      question: 'Clean up meeting notes from vendor sync into bulleted summary.',
      timeBudget: '2m',
      createdAt: isoDate(4),
      usedClassicOnly: true,
      hintDepth: 0,
    });

    // Day 5 - Qualifying own take
    sessions.push({
      id: 'sess_day5',
      domainId: 'dom_decision',
      mode: 'help_me_grow',
      question: 'Should we commit to a 2-week freeze to address database migration debt or interleave it with feature work?',
      timeBudget: '5m',
      createdAt: isoDate(5),
      usedClassicOnly: false,
      hintDepth: 2,
      attemptId: 'att_day5',
      overallTopicScore: 7.5,
    });
    attempts.push({
      id: 'att_day5',
      sessionId: 'sess_day5',
      text: 'Dedicated freeze is cleaner for database migrations because partial state schemas break feature flags and double regression testing overhead.',
      confidencePct: 78,
      score: 75,
      isMeaningful: true,
      strengths: ['Clean state consideration', 'Reduced regression surface'],
      gaps: ['Need stakeholder buy-in plan for delayed roadmaps'],
      createdAt: isoDate(5),
    });

    // Day 6 - Qualifying own take + classic session
    sessions.push({
      id: 'sess_3',
      domainId: 'dom_hiring',
      mode: 'help_me_grow',
      question: 'Candidate A has deep technical skill but low domain experience; Candidate B has high domain grasp but needs ramp-up on system design.',
      timeBudget: '5m',
      createdAt: isoDate(6),
      usedClassicOnly: false,
      hintDepth: 2,
      helpfulRating: 'up',
      attemptId: 'att_3',
      decisionId: 'dec_3',
      overallTopicScore: 7.4,
    });
    attempts.push({
      id: 'att_3',
      sessionId: 'sess_3',
      text: 'Hire Candidate A. In a fast-evolving API platform, fundamental systems architecture is much harder to teach than domain business context.',
      confidencePct: 75,
      score: 74,
      isMeaningful: true,
      strengths: ['Principled staffing philosophy', 'Long term capacity focus'],
      gaps: ['Assumes immediate peer bandwidth to teach domain terminology'],
      createdAt: isoDate(6),
    });
    decisions.push({
      id: 'dec_3',
      sessionId: 'sess_3',
      domainId: 'dom_hiring',
      question: 'Candidate A has deep technical skill but low domain experience; Candidate B has high domain grasp but needs ramp-up on system design.',
      chosen: 'mine',
      confidencePct: 75,
      outcome: 'mixed',
      outcomeDueAt: isoDate(2),
      outcomeRecordedAt: isoDate(2),
      createdAt: isoDate(6),
    });

    sessions.push({
      id: 'sess_day6_classic',
      domainId: 'dom_analysis',
      mode: 'get_it_done',
      question: 'Extract summary statistics from CSV metrics table.',
      timeBudget: '2m',
      createdAt: isoDate(6, 6),
      usedClassicOnly: true,
      hintDepth: 0,
    });

    // Populate historical sessions for Days 7 to 29 (ensuring 30-day activity data)
    for (let d = 7; d <= 29; d++) {
      const isClassic = d % 4 === 0;
      const domainId = d % 3 === 0 ? 'dom_analysis' : d % 2 === 0 ? 'dom_decision' : 'dom_writing';
      const sId = `sess_hist_${d}`;
      const attId = `att_hist_${d}`;
      const score = 65 + (d * 7) % 30;

      sessions.push({
        id: sId,
        domainId,
        mode: isClassic ? 'get_it_done' : 'help_me_grow',
        question: `Historical strategic inquiry from ${d} days ago regarding ${domainId.replace('dom_', '')}`,
        timeBudget: '5m',
        createdAt: isoDate(d),
        usedClassicOnly: isClassic,
        hintDepth: isClassic ? 0 : 3,
        attemptId: isClassic ? undefined : attId,
        overallTopicScore: isClassic ? undefined : score / 10,
      });

      if (!isClassic) {
        attempts.push({
          id: attId,
          sessionId: sId,
          text: `Deliberate independent reasoning drafted ${d} days ago focusing on first-principles fundamentals and risk mitigations.`,
          confidencePct: 70 + (d % 25),
          score,
          isMeaningful: true,
          strengths: ['Clear reasoning foundation', 'Identified trade-offs'],
          gaps: ['Could further quantify probabilistic impact'],
          createdAt: isoDate(d),
        });
      }
    }

    // AI Mistake Log entries across 30 days (User flagged, verified: false)
    logEntries.push(
      {
        id: 'log_1',
        sessionId: 'sess_1',
        questionText: 'API deprecation memo',
        aiSnippet: 'Assumed all tier 1 enterprise partners have full dedicated devops capacity in August.',
        domainId: 'dom_writing',
        type: 'wrong_assumption',
        note: 'User flagged: AI assumed partners have Q3 availability; in reality, enterprise budgeting is frozen during annual planning.',
        verified: false,
        createdAt: isoDate(2),
      },
      {
        id: 'log_2',
        domainId: 'dom_analysis',
        type: 'missed_context',
        note: 'User flagged: AI omitted the impact of our competitor launching an open-source tier on the same week pricing was adjusted.',
        verified: false,
        createdAt: isoDate(11),
      },
      {
        id: 'log_3',
        domainId: 'dom_decision',
        type: 'wrong_fact',
        note: 'User flagged: AI stated Auth0 does not support cross-tenant SAML federation out of the box, which was factually inaccurate for enterprise plans.',
        verified: false,
        createdAt: isoDate(19),
      },
      {
        id: 'log_4',
        domainId: 'dom_writing',
        type: 'tone_mismatch',
        note: 'User flagged: Generated tone was overly defensive regarding service downtime instead of transparent and accountability-focused.',
        verified: false,
        createdAt: isoDate(26),
      }
    );

    // Spaced Revisit Quizzes (PRD V2 Section 7)
    // Pending quiz ready now!
    const spacedQuizzes: SpacedRevisitQuiz[] = [
      {
        id: 'sq_1',
        sessionId: 'sess_1',
        topicName: 'Platform API Deprecation Communication',
        domainId: 'dom_writing',
        domainName: 'Writing and memos',
        daysAgoLearned: 3,
        learnedAt: isoDate(3),
        dueAt: isoDate(0, -1), // Due 1 hour ago -> ready now
        questions: [
          {
            question: 'What was your primary rationale for choosing a 60-day advisory window instead of an immediate freeze?',
          },
          {
            question: 'How do you safeguard enterprise client retention if their internal developer bandwidth is constrained?',
          },
          {
            question: 'What rollback or migration safety guarantee did you offer in your original strategy draft?',
          },
        ],
      },
    ];

    // Historical Rehearsal
    const rehearsals: Rehearsal[] = [
      {
        id: 'reh_1',
        draftText: 'Proposal to migrate our user data store to distributed PostgreSQL across three availability zones with automated cross-region read replicas.',
        audience: 'Senior leader',
        questions: [
          'What is the catastrophic blast radius if automated failover triggers prematurely under transient network split?',
          'How does this migration guarantee zero write loss for active payment webhooks during cutover?',
          'What is the rollback procedure if the new replica schema introduces 200ms latency spikes in peak morning hours?',
        ],
        answers: [
          'Premature failover is guarded with a quorum split-brain mediator requiring confirmation from at least two witness nodes before elevating a secondary.',
          'We execute a dual-write pipeline where transactions are queued in Redis and drained with checksum verification before cutting over primary DNS.',
          'Rollback utilizes continuous change data capture streaming backwards into the legacy cluster for 48 hours post-cutover.',
        ],
        scores: [88, 82, 85],
        feedbacks: [
          'Excellent witness node mitigation.',
          'Realistic dual-write architecture with clear reconciliation.',
          'Solid backwards replication safety net.',
        ],
        avgScore: 85,
        strongestAnswer: 'Witness node split-brain quorum mediation',
        weakestAnswer: 'Dual-write cutover pipeline details',
        suggestedCoachTopics: [
          'Distributed consensus in split-brain scenarios',
          'Database replication lag mitigation',
        ],
        pointsAwarded: true,
        completedAt: isoDate(5),
        createdAt: isoDate(5),
      },
    ];

    // Tracker entries (with both source: 'self_reported' and 'jarvis_observed')
    trackerEntries.push(
      {
        id: 'tr_1',
        type: 'manual_hours',
        count: 3.5,
        date: ymdDate(1),
        source: 'self_reported',
        note: 'Whiteboarding Q4 API architecture offline without AI',
        createdAt: isoDate(1),
      },
      {
        id: 'tr_2',
        type: 'manual_hours',
        count: 2.0,
        date: ymdDate(2),
        source: 'self_reported',
        note: 'Drafting 1-on-1 team development plans on paper',
        createdAt: isoDate(2),
      },
      {
        id: 'tr_3',
        type: 'topic_mastered',
        count: 1,
        date: ymdDate(3),
        source: 'jarvis_observed',
        topicName: 'Managed Identity Architecture',
        note: 'Completed all coaching checkpoints with 8.8/10 score',
        sessionId: 'sess_2',
        createdAt: isoDate(3),
      },
      {
        id: 'tr_4',
        type: 'independent_draft',
        count: 1,
        date: ymdDate(5),
        source: 'jarvis_observed',
        topicName: 'Database Freeze Evaluation',
        note: 'Formulated independent hypothesis before AI review',
        sessionId: 'sess_day5',
        createdAt: isoDate(5),
      },
      {
        id: 'tr_5',
        type: 'manual_hours',
        count: 4.0,
        date: ymdDate(7),
        source: 'self_reported',
        note: 'Direct customer interview analysis without LLM summarization',
        createdAt: isoDate(7),
      }
    );

    // Point events
    pointEvents.push(
      { id: 'pt_1', type: 'think_first_attempt', points: 10, domainId: 'dom_writing', description: 'Strong first take on technical strategy memo', createdAt: isoDate(0) },
      { id: 'pt_2', type: 'think_first_attempt', points: 10, domainId: 'dom_writing', description: 'Strong first take on enterprise API advisory', createdAt: isoDate(1) },
      { id: 'pt_3', type: 'think_first_attempt', points: 10, domainId: 'dom_analysis', description: 'High quality attempt on trial conversion drop', createdAt: isoDate(2) },
      { id: 'pt_4', type: 'think_first_attempt', points: 10, domainId: 'dom_decision', description: 'First take on auth service rebuild', createdAt: isoDate(3) },
      { id: 'pt_5', type: 'decision_logged', points: 8, domainId: 'dom_decision', description: 'Logged auth decision (mine)', createdAt: isoDate(3) },
      { id: 'pt_6', type: 'rehearsal_completed', points: 20, domainId: 'dom_writing', description: 'Defend-it rehearsal passed with 85%', createdAt: isoDate(5) },
      { id: 'pt_7', type: 'think_first_attempt', points: 10, domainId: 'dom_decision', description: 'First take on database freeze', createdAt: isoDate(5) },
      { id: 'pt_8', type: 'think_first_attempt', points: 10, domainId: 'dom_hiring', description: 'First take on candidate trade-off', createdAt: isoDate(6) }
    );

    const wallet: Wallet = {
      principal: 2000,
      rewardBalance: 65,
      lifetimeRewards: 105,
      transactions: [
        {
          id: 'tx_init',
          type: 'deposit',
          amount: 2000,
          currency: 'INR',
          description: 'Simulated commitment deposit',
          createdAt: new Date(now - 30 * day).toISOString(),
        },
        {
          id: 'tx_accrual_w1',
          type: 'accrual',
          amount: 25,
          currency: 'RC',
          description: 'Week 1 Judgement reward accrual',
          createdAt: new Date(now - 21 * day).toISOString(),
        },
        {
          id: 'tx_accrual_w2',
          type: 'accrual',
          amount: 35,
          currency: 'RC',
          description: 'Week 2 Judgement reward accrual',
          createdAt: new Date(now - 14 * day).toISOString(),
        },
        {
          id: 'tx_redeem_1',
          type: 'redeem',
          amount: 40,
          currency: 'RC',
          description: 'Redeemed PageTurn Books ₹100 voucher',
          createdAt: new Date(now - 10 * day).toISOString(),
        },
        {
          id: 'tx_accrual_w3',
          type: 'accrual',
          amount: 45,
          currency: 'RC',
          description: 'Week 3 Judgement reward accrual',
          createdAt: new Date(now - 7 * day).toISOString(),
        },
      ],
    };

    setItem(STORAGE_KEYS.DOMAINS, domains);
    setItem(STORAGE_KEYS.USER, user);
    setItem(STORAGE_KEYS.SESSIONS, sessions);
    setItem(STORAGE_KEYS.ATTEMPTS, attempts);
    setItem(STORAGE_KEYS.DECISIONS, decisions);
    setItem(STORAGE_KEYS.POINT_EVENTS, pointEvents);
    setItem(STORAGE_KEYS.REHEARSALS, rehearsals);
    setItem(STORAGE_KEYS.SPACED_QUIZZES, spacedQuizzes);
    setItem(STORAGE_KEYS.AI_LOG, logEntries);
    setItem(STORAGE_KEYS.WALLET, wallet);
    setItem(STORAGE_KEYS.TRACKER, trackerEntries);
    setItem(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
    setItem(STORAGE_KEYS.COUPONS, DEFAULT_COUPONS);
  },
};
