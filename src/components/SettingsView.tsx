/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Settings as SettingsIcon,
  Lock,
  Bell,
  Sparkles,
  Sliders,
  Database,
  ArrowRight,
  RotateCcw,
  ShieldAlert,
  Clock,
  Check,
  Flame,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import {
  AnalyticsEvent,
  AppConfig,
  DomainItem,
  PlanType,
  UserProfile,
} from '../types';
import { Storage } from '../utils/storage';
import { DEFAULT_CONFIG } from '../utils/rules';

interface SettingsViewProps {
  user: UserProfile;
  domains: DomainItem[];
  config: AppConfig;
  analyticsEvents: AnalyticsEvent[];
  onRefreshData: () => void;
  onNavigateToLeadership: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  domains,
  config,
  analyticsEvents,
  onRefreshData,
  onNavigateToLeadership,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'general' | 'ai_lock' | 'plan' | 'advanced'>('general');

  // AI lock state
  const [ideaGateWords, setIdeaGateWords] = useState(config.aiLockDefaults.ideaGateWords || 40);
  const [timeLockMinutes, setTimeLockMinutes] = useState(config.aiLockDefaults.timeLockMinutes || 30);
  const [selectedLockDomain, setSelectedLockDomain] = useState(domains[0]?.id || 'dom_writing');

  // Override simulation
  const [isOverriding, setIsOverriding] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [overrideReason, setOverrideReason] = useState('');

  // Editable config in Advanced
  const [editableConfig, setEditableConfig] = useState<AppConfig>(config);
  const [configSaved, setConfigSaved] = useState(false);

  // Urgent toggle
  const isUrgentActive = user.urgentOverrideUntil && user.urgentOverrideUntil > Date.now();

  const handleToggleUrgent = () => {
    const until = isUrgentActive ? undefined : Date.now() + 60 * 60000;
    Storage.saveUserProfile({
      ...user,
      urgentOverrideUntil: until,
    });
    onRefreshData();
  };

  const startOverrideCountdown = () => {
    if (!overrideReason.trim()) return;
    setIsOverriding(true);
    setCountdown(10);
    const interval = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(interval);
          setIsOverriding(false);
          // Apply penalty (-5 pts)
          Storage.addPointEvent({
            id: `pt_ovr_${Date.now()}`,
            type: 'lock_override_penalty',
            points: config.points.lockOverridePenalty,
            description: `Lock override: "${overrideReason.slice(0, 50)}"`,
            createdAt: new Date().toISOString(),
          });
          Storage.logAnalyticsEvent('lock_override', { reason: overrideReason });
          setOverrideReason('');
          onRefreshData();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const handleSaveConfig = () => {
    Storage.saveConfig(editableConfig);
    setConfigSaved(true);
    setTimeout(() => {
      setConfigSaved(false);
      onRefreshData();
    }, 1200);
  };

  const handleResetConfig = () => {
    setEditableConfig(DEFAULT_CONFIG);
    Storage.saveConfig(DEFAULT_CONFIG);
    onRefreshData();
  };

  const handleTogglePlan = (plan: PlanType) => {
    Storage.saveUserProfile({
      ...user,
      plan,
    });
    Storage.logAnalyticsEvent('plan_changed', { plan });
    onRefreshData();
  };

  const handleLoadDemo = () => {
    Storage.loadDemoData();
    onRefreshData();
  };

  const handleResetAll = () => {
    if (window.confirm('Reset all Jarvis data? This clears your localStorage state.')) {
      Storage.resetAllData();
      onRefreshData();
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Workspace Settings
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Configure growth domains, AI locks, subscription tiers, and tunable parameters.
          </p>
        </div>

        {/* Sub-tab Switcher */}
        <div className="flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold">
          {[
            { id: 'general', label: 'Domains & Nudges' },
            { id: 'ai_lock', label: 'AI Lock' },
            { id: 'plan', label: 'Subscription Plan' },
            { id: 'advanced', label: 'Advanced Config' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                activeSubTab === tab.id
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* =========================================================================
          SUB-TAB 1: GENERAL (DOMAINS)
         ========================================================================= */}
      {activeSubTab === 'general' && (
        <div className="space-y-6">
          {/* Domains Manager */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Growth vs Delegation Domains
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Toggle which areas require independent deliberate thought and which stay instant.
                </p>
              </div>
              <div className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 self-start">
                {domains.filter(d => d.isCustom).length} / 6 custom domains used
              </div>
            </div>

            {/* Add Custom Domain Form (Max 6) */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white block">
                Add Custom Domain (Max 6)
              </span>
              <p className="text-[11px] text-slate-500">
                Create new domains where you want to build intuition and practice critical thinking.
              </p>
              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  id="new-domain-input"
                  placeholder={
                    domains.filter(d => d.isCustom).length >= 6
                      ? 'Maximum 6 custom domains reached'
                      : 'Enter topic or domain name (e.g. Cloud Architecture, Risk Analysis)...'
                  }
                  disabled={domains.filter(d => d.isCustom).length >= 6}
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white disabled:opacity-50"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const input = e.currentTarget;
                      if (!input.value.trim()) return;
                      const res = Storage.addCustomDomain(input.value);
                      if (res.success) {
                        input.value = '';
                        onRefreshData();
                      }
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={domains.filter(d => d.isCustom).length >= 6}
                  onClick={() => {
                    const el = document.getElementById('new-domain-input') as HTMLInputElement;
                    if (!el || !el.value.trim()) return;
                    const res = Storage.addCustomDomain(el.value);
                    if (res.success) {
                      el.value = '';
                      onRefreshData();
                    }
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white cursor-pointer transition-opacity"
                >
                  Add Domain
                </button>
              </div>
              {domains.filter(d => d.isCustom).length >= 6 && (
                <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium block">
                  You have reached the maximum limit of 6 custom domains.
                </span>
              )}
            </div>

            <div className="space-y-2.5">
              {domains.map(dom => (
                <div
                  key={dom.id}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {dom.name}
                      </span>
                      {dom.isCustom && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          Custom
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500">
                      Proficiency: {dom.level}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        Storage.toggleGrowthDomain(dom.id, !dom.isGrowth);
                        onRefreshData();
                      }}
                      className={`px-3 py-1.5 rounded-lg font-bold text-xs cursor-pointer transition-colors ${
                        dom.isGrowth
                          ? 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300'
                          : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {dom.isGrowth ? '⭐ Growth Domain' : 'Delegation (Instant)'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          SUB-TAB 2: AI LOCK (PRD V2 Section 9: Scheduled AI-first mode restriction)
         ========================================================================= */}
      {activeSubTab === 'ai_lock' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div>
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-teal-600" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Scheduled AI-First Mode Restriction
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Lock AI-first/direct-answer mode during designated focus hours in growth domains. Help Me Think, guided coaching, user notes, and reflection remain open.
              </p>
            </div>

            {/* Urgent Override Toggle */}
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-amber-900 dark:text-amber-200 block">
                  Urgent Toggle (60 Minutes)
                </span>
                <span className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
                  One tap temporarily bypasses AI-first mode restrictions with zero penalty so time-critical work is never blocked.
                </span>
              </div>
              <button
                type="button"
                onClick={handleToggleUrgent}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  isUrgentActive
                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                    : 'bg-amber-600 hover:bg-amber-700 text-white'
                }`}
              >
                {isUrgentActive ? 'Cancel Urgent' : 'Enable 60m Urgent'}
              </button>
            </div>

            {/* Schedule Configuration Card */}
            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-xs text-slate-900 dark:text-white block">
                    Weekly Schedule Lock
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Restricts instant answers during your peak hours to foster deliberate practice
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={user.aiLockSchedule?.enabled ?? true}
                    onChange={e => {
                      const updatedSchedule = {
                        enabled: e.target.checked,
                        startHour: user.aiLockSchedule?.startHour ?? 9,
                        endHour: user.aiLockSchedule?.endHour ?? 18,
                        days: user.aiLockSchedule?.days ?? [1, 2, 3, 4, 5],
                      };
                      Storage.saveUserProfile({ ...user, aiLockSchedule: updatedSchedule });
                      onRefreshData();
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-teal-600"></div>
                </label>
              </div>

              {/* Days of week selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Active Days:
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { day: 1, label: 'Mon' },
                    { day: 2, label: 'Tue' },
                    { day: 3, label: 'Wed' },
                    { day: 4, label: 'Thu' },
                    { day: 5, label: 'Fri' },
                    { day: 6, label: 'Sat' },
                    { day: 0, label: 'Sun' },
                  ].map(({ day, label }) => {
                    const currentDays = user.aiLockSchedule?.days ?? [1, 2, 3, 4, 5];
                    const isSelected = currentDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          const nextDays = isSelected
                            ? currentDays.filter(d => d !== day)
                            : [...currentDays, day];
                          const updated = {
                            enabled: user.aiLockSchedule?.enabled ?? true,
                            startHour: user.aiLockSchedule?.startHour ?? 9,
                            endHour: user.aiLockSchedule?.endHour ?? 18,
                            days: nextDays,
                          };
                          Storage.saveUserProfile({ ...user, aiLockSchedule: updated });
                          onRefreshData();
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-teal-600 border-teal-600 text-white'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Hours pickers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Start Lock Time (Local):
                  </label>
                  <select
                    value={user.aiLockSchedule?.startHour ?? 9}
                    onChange={e => {
                      const updated = {
                        enabled: user.aiLockSchedule?.enabled ?? true,
                        startHour: Number(e.target.value),
                        endHour: user.aiLockSchedule?.endHour ?? 18,
                        days: user.aiLockSchedule?.days ?? [1, 2, 3, 4, 5],
                      };
                      Storage.saveUserProfile({ ...user, aiLockSchedule: updated });
                      onRefreshData();
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  >
                    {Array.from({ length: 24 }).map((_, h) => (
                      <option key={h} value={h}>
                        {h.toString().padStart(2, '0')}:00 {h < 12 ? 'AM' : 'PM'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    End Lock Time (Local, handles overnight):
                  </label>
                  <select
                    value={user.aiLockSchedule?.endHour ?? 18}
                    onChange={e => {
                      const updated = {
                        enabled: user.aiLockSchedule?.enabled ?? true,
                        startHour: user.aiLockSchedule?.startHour ?? 9,
                        endHour: Number(e.target.value),
                        days: user.aiLockSchedule?.days ?? [1, 2, 3, 4, 5],
                      };
                      Storage.saveUserProfile({ ...user, aiLockSchedule: updated });
                      onRefreshData();
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  >
                    {Array.from({ length: 24 }).map((_, h) => (
                      <option key={h} value={h}>
                        {h.toString().padStart(2, '0')}:00 {h < 12 ? 'AM' : 'PM'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 italic">
                * Note: Scheduled locks only restrict direct AI-first generation in growth domains. Delegation domains are never locked.
              </p>
            </div>

            {/* Deliberate Practice Phrase Info */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs space-y-1.5">
              <span className="font-bold text-slate-900 dark:text-white block">
                Scheduled Lock Override Rule
              </span>
              <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                If you request an AI-first answer during active lock hours, you must type:
                <br />
                <span className="font-mono text-teal-700 dark:text-teal-300 font-semibold">
                  "I am choosing convenience over deliberate practice"
                </span>
                <br />
                This incurs an internal 10-point practice adjustment. Pledged principal is never affected.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          SUB-TAB 3: SUBSCRIPTION PLAN (F15)
         ========================================================================= */}
      {activeSubTab === 'plan' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Simulated Subscription Tier (F15)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Toggle below to test feature gating for Jarvis Free vs Plus.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Free Plan */}
              <div
                className={`p-5 rounded-2xl border text-left flex flex-col justify-between ${
                  user.plan === 'free'
                    ? 'border-teal-600 bg-teal-50/50 dark:bg-teal-950/30 ring-1 ring-teal-500'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/30'
                }`}
              >
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-base text-slate-900 dark:text-white">Free Plan</span>
                    <span className="text-xs font-bold text-slate-500">₹0</span>
                  </div>
                  <ul className="text-xs space-y-1.5 text-slate-600 dark:text-slate-400 my-4">
                    <li>✓ Ask flow with think-first window</li>
                    <li>✓ Classic AI answers with assumptions</li>
                    <li>✓ 5 guided coaching paths per week</li>
                    <li>✓ Progress Panel & Pledge wallet</li>
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={() => handleTogglePlan('free')}
                  disabled={user.plan === 'free'}
                  className="w-full py-2 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 disabled:opacity-50 text-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  {user.plan === 'free' ? 'Current Plan' : 'Switch to Free'}
                </button>
              </div>

              {/* Plus Plan */}
              <div
                className={`p-5 rounded-2xl border text-left flex flex-col justify-between ${
                  user.plan === 'plus'
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 ring-1 ring-indigo-500'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/30'
                }`}
              >
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-1.5">
                      Jarvis Plus
                      <Sparkles className="w-4 h-4 text-amber-500" />
                    </span>
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                      ₹199 / month (Simulated)
                    </span>
                  </div>
                  <ul className="text-xs space-y-1.5 text-slate-600 dark:text-slate-400 my-4">
                    <li>✓ Unlimited Coach Guided Ladders</li>
                    <li>✓ Unlimited Defend-It Rehearsals</li>
                    <li>✓ Next-Day Teach-Back retention checks</li>
                    <li>✓ Full calibration analytics & AI log</li>
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={() => handleTogglePlan('plus')}
                  disabled={user.plan === 'plus'}
                  className="w-full py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 cursor-pointer"
                >
                  {user.plan === 'plus' ? 'Current Plan (Plus Active)' : 'Upgrade to Plus'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          SUB-TAB 4: ADVANCED CONFIG & SEED DATA
         ========================================================================= */}
      {activeSubTab === 'advanced' && (
        <div className="space-y-6">
          {/* Tunable parameters object */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Tunable Config Object (All values in one place)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Points, caps, yields, and timers exposed as specified in Section 0 & Section 6.
                </p>
              </div>

              <button
                type="button"
                onClick={handleResetConfig}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Defaults</span>
              </button>
            </div>

            {/* Editable JSON / parameters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Think-First Attempt Max Points
                </label>
                <input
                  type="number"
                  value={editableConfig.points.thinkFirstAttemptMax}
                  onChange={e =>
                    setEditableConfig({
                      ...editableConfig,
                      points: {
                        ...editableConfig.points,
                        thinkFirstAttemptMax: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Guided Path Completed Points
                </label>
                <input
                  type="number"
                  value={editableConfig.points.guidedPathCompleted}
                  onChange={e =>
                    setEditableConfig({
                      ...editableConfig,
                      points: {
                        ...editableConfig.points,
                        guidedPathCompleted: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Decision Logged Base Points
                </label>
                <input
                  type="number"
                  value={editableConfig.points.decisionLogged}
                  onChange={e =>
                    setEditableConfig({
                      ...editableConfig,
                      points: {
                        ...editableConfig.points,
                        decisionLogged: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Calibration Accuracy Bonus Points
                </label>
                <input
                  type="number"
                  value={editableConfig.points.calibrationBonus}
                  onChange={e =>
                    setEditableConfig({
                      ...editableConfig,
                      points: {
                        ...editableConfig.points,
                        calibrationBonus: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Classic Without Take Penalty
                </label>
                <input
                  type="number"
                  value={editableConfig.points.classicWithoutTakePenalty}
                  onChange={e =>
                    setEditableConfig({
                      ...editableConfig,
                      points: {
                        ...editableConfig.points,
                        classicWithoutTakePenalty: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Daily Positive Cap Points
                </label>
                <input
                  type="number"
                  value={editableConfig.points.dailyPositiveCap}
                  onChange={e =>
                    setEditableConfig({
                      ...editableConfig,
                      points: {
                        ...editableConfig.points,
                        dailyPositiveCap: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleSaveConfig}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white cursor-pointer"
              >
                {configSaved ? 'Saved to LocalStorage!' : 'Save Config'}
              </button>
            </div>
          </div>

          {/* Local Analytics Event Log */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Local Analytics Events Log (Section 11)
            </h3>
            <div className="max-h-48 overflow-y-auto space-y-1.5 text-[11px] font-mono">
              {analyticsEvents.map(evt => (
                <div
                  key={evt.id}
                  className="p-2 rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex justify-between"
                >
                  <span className="text-teal-700 dark:text-teal-300 font-bold">
                    {evt.name}
                  </span>
                  <span className="text-slate-400">
                    {new Date(evt.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Demo Data & Reset Actions */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div>
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                Demo Seeding & Reset Controls
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Populate 30 days of realistic Arjun manager history or reset clean.
              </p>
            </div>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={handleLoadDemo}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white cursor-pointer"
              >
                Load Demo Data (30 Days)
              </button>
              <button
                type="button"
                onClick={handleResetAll}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl cursor-pointer"
              >
                Reset All
              </button>
            </div>
          </div>

          {/* Hidden Leadership View Route Link (PRD Section 4 & F16) */}
          <div className="p-5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300 font-bold text-xs uppercase tracking-wider">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Executive Strategy Portal</span>
              </div>
              <h4 className="font-bold text-sm text-slate-900 dark:text-white mt-0.5">
                Open Leadership View (F16)
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Aggregate user economics, ₹48L pledge pool, 6.0% yield assumptions, and retention model.
              </p>
            </div>

            <button
              type="button"
              onClick={onNavigateToLeadership}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
            >
              <span>View Leadership Dashboard</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
