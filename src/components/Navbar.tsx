/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Compass,
  Sparkles,
  TrendingUp,
  Wallet,
  Settings,
  Shield,
  Sun,
  Moon,
  Coins,
  ShieldCheck,
} from 'lucide-react';
import { PlanType } from '../types';

export type TabType = 'home' | 'ask' | 'growth' | 'wallet' | 'settings' | 'leadership';

interface NavbarProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  rewardBalance: number;
  plan: PlanType;
  onOpenRehearsal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  rewardBalance,
  plan,
  onOpenRehearsal,
}) => {
  const tabs = [
    { id: 'home' as TabType, label: 'Home', icon: Compass },
    { id: 'ask' as TabType, label: 'Ask', icon: Sparkles },
    { id: 'growth' as TabType, label: 'Growth', icon: TrendingUp },
    { id: 'wallet' as TabType, label: 'Wallet', icon: Wallet },
    { id: 'settings' as TabType, label: 'Settings', icon: Settings },
  ];

  return (
    <>
      {/* Top Desktop Navigation */}
      <header className="sticky top-0 z-30 w-full border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-6">
            <button
              onClick={() => onSelectTab('home')}
              className="flex items-center gap-2.5 text-left group focus:outline-none cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-600 to-indigo-600 flex items-center justify-center text-white shadow-sm shadow-teal-500/20 group-hover:scale-105 transition-transform">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-lg tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                  Jarvis
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-teal-100 dark:bg-teal-950/70 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                    v0.1
                  </span>
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden lg:block -mt-0.5">
                  Keep the judgement
                </p>
              </div>
            </button>

            {/* Desktop Nav Items */}
            <nav className="hidden md:flex items-center gap-1">
              {tabs.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => onSelectTab(tab.id)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Quick Metrics & Actions */}
          <div className="flex items-center gap-2.5">
            {/* Reward Balance (RC) */}
            <button
              onClick={() => onSelectTab('wallet')}
              title="Reward Balance: 1 RC = ₹1 redeemable partner coupon"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-teal-50 dark:bg-teal-950/40 hover:bg-teal-100 dark:hover:bg-teal-900/50 text-xs font-medium text-teal-800 dark:text-teal-300 transition-colors cursor-pointer border border-teal-200/50 dark:border-teal-800/50"
            >
              <Coins className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span className="font-semibold">{rewardBalance}</span>
              <span className="text-teal-600 dark:text-teal-400 font-normal">RC</span>
            </button>

            {/* Quick Rehearsal Launch */}
            <button
              onClick={onOpenRehearsal}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-medium border border-indigo-200/60 dark:border-indigo-800/60 transition-colors cursor-pointer"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Defend Draft</span>
            </button>

            {/* Plan Badge */}
            <button
              onClick={() => onSelectTab('settings')}
              className={`hidden lg:flex items-center text-[11px] font-semibold uppercase tracking-wider px-2 py-1 rounded-md border ${
                plan === 'plus'
                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
              }`}
            >
              {plan === 'plus' ? 'Plus' : 'Free Plan'}
            </button>
          </div>
        </div>
      </header>

      {/* Bottom Mobile Navigation Tabs */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 flex items-center justify-around py-2 px-1">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                isActive
                  ? 'text-teal-600 dark:text-teal-400'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
