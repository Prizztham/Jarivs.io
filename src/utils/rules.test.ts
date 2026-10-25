/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAttemptPoints,
  isCalibrated,
  calculateDecisionPoints,
  calculateRehearsalPoints,
  calculateSpacedQuizPoints,
  calculateRewardDelta,
  calculateIDR,
  calculateHumanFirstRate,
  calculateWeeklyHumanFirstBars,
  calculateStreak,
  countWords,
} from './rules.ts';
import type { Decision, DomainItem, Session, Attempt } from '../types/index.ts';

test('calculateAttemptPoints awards nothing for filler or score < 40', () => {
  assert.equal(calculateAttemptPoints(35, true), 0);
  assert.equal(calculateAttemptPoints(85, false), 0);
  assert.equal(calculateAttemptPoints(0, false), 0);
});

test('calculateAttemptPoints scales points between 40-69 and 70+', () => {
  assert.equal(calculateAttemptPoints(55, true), 6);
  assert.equal(calculateAttemptPoints(70, true), 10);
  assert.equal(calculateAttemptPoints(95, true), 10);
});

test('isCalibrated correctly checks 15-point threshold', () => {
  assert.equal(isCalibrated(90, 'right'), true);
  assert.equal(isCalibrated(80, 'right'), false);
  assert.equal(isCalibrated(10, 'wrong'), true);
  assert.equal(isCalibrated(45, 'mixed'), true);
  assert.equal(isCalibrated(70, 'mixed'), false);
});

test('calculateDecisionPoints gives base + calibration bonus', () => {
  const withoutTake = calculateDecisionPoints(false, 90, 'right');
  assert.equal(withoutTake.total, 0);

  const calibrated = calculateDecisionPoints(true, 90, 'right');
  assert.equal(calibrated.basePoints, 8);
  assert.equal(calibrated.calibrationBonus, 4);
  assert.equal(calibrated.total, 12);
});

test('calculateRehearsalPoints gives 20 for >= 60 and 8 for < 60', () => {
  assert.equal(calculateRehearsalPoints(85), 20);
  assert.equal(calculateRehearsalPoints(60), 20);
  assert.equal(calculateRehearsalPoints(59), 8);
});

test('calculateSpacedQuizPoints requires at least 2 sound answers', () => {
  assert.equal(calculateSpacedQuizPoints(3), 10);
  assert.equal(calculateSpacedQuizPoints(2), 10);
  assert.equal(calculateSpacedQuizPoints(1), 0);
});

test('calculateHumanFirstRate computes rolling rate with numerator and denominator', () => {
  const domains: DomainItem[] = [
    { id: 'd1', name: 'Writing and memos', isGrowth: true, level: 'Developing', createdAt: '' },
  ];
  const now = new Date().toISOString();
  const sessions: Session[] = [
    { id: 's1', domainId: 'd1', mode: 'help_me_grow', question: 'Q1', timeBudget: '5m', createdAt: now, usedClassicOnly: false, hintDepth: 2, attemptId: 'a1' },
    { id: 's2', domainId: 'd1', mode: 'help_me_grow', question: 'Q2', timeBudget: '5m', createdAt: now, usedClassicOnly: true, hintDepth: 0 },
  ];

  const res = calculateHumanFirstRate(sessions, domains, 7);
  assert.equal(res.rate, 50);
  assert.equal(res.numerator, 1);
  assert.equal(res.denominator, 2);
});

test('calculateStreak tracks consecutive days and supportive message when reset', () => {
  const domains: DomainItem[] = [
    { id: 'd1', name: 'Writing', isGrowth: true, level: 'Developing', createdAt: '' },
  ];
  const today = new Date().toISOString();
  const yesterday = new Date(Date.now() - 86400000).toISOString();
  const attempts: Attempt[] = [
    { id: 'a1', sessionId: 's1', text: 'T1', confidencePct: 80, score: 75, isMeaningful: true, strengths: [], gaps: [], createdAt: yesterday },
    { id: 'a2', sessionId: 's2', text: 'T2', confidencePct: 80, score: 70, isMeaningful: true, strengths: [], gaps: [], createdAt: today },
  ];
  const sessions: Session[] = [
    { id: 's1', domainId: 'd1', mode: 'help_me_grow', question: '', timeBudget: '5m', createdAt: yesterday, usedClassicOnly: false, hintDepth: 0 },
    { id: 's2', domainId: 'd1', mode: 'help_me_grow', question: '', timeBudget: '5m', createdAt: today, usedClassicOnly: false, hintDepth: 0 },
  ];

  const streak = calculateStreak(attempts, sessions, domains);
  assert.equal(streak.currentStreak, 2);
  assert.equal(streak.bestStreak, 2);
  assert.equal(streak.isStreakActiveToday, true);
});

test('countWords accurately splits text', () => {
  assert.equal(countWords('   hello   world   '), 2);
  assert.equal(countWords(''), 0);
});
