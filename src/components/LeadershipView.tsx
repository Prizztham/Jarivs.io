/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  TrendingUp,
  Coins,
  Users,
  ShieldCheck,
  ArrowLeft,
  Sliders,
  DollarSign,
  Activity,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface LeadershipViewProps {
  onBack: () => void;
}

export const LeadershipView: React.FC<LeadershipViewProps> = ({ onBack }) => {
  // Tunable assumptions
  const [activeUsers, setActiveUsers] = useState(2400);
  const [avgPledge, setAvgPledge] = useState(2000);
  const [annualYieldPct, setAnnualYieldPct] = useState(6.0); // PRD F12 assumption: 6.0%
  const [avgRewardRate, setAvgRewardRate] = useState(0.35); // 0.35% monthly reward claim

  // Calculated economics
  const totalPledgePool = activeUsers * avgPledge;
  const annualSimulatedYield = (totalPledgePool * annualYieldPct) / 100;
  const dailySimulatedYield = annualSimulatedYield / 365;

  const annualRewardPayouts = (totalPledgePool * (avgRewardRate * 12)) / 100;
  const netTreasurySpread = annualSimulatedYield - annualRewardPayouts;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      {/* Top Banner & Back */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Workspace</span>
        </button>

        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-bold uppercase tracking-wider">
          Executive Leadership View
        </span>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Simulated Treasury & Macro Health
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Macroeconomics of the pledge pool, 6.0% simulated low-risk yield, and organizational IDR calibration.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Pledge Pool */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span>Total Pledge Pool</span>
            <Coins className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
            ₹{(totalPledgePool / 100000).toFixed(2)} Lakhs
          </div>
          <span className="text-[11px] text-slate-500 block mt-1">
            ₹{totalPledgePool.toLocaleString()} principal (100% withdrawable)
          </span>
        </div>

        {/* Simulated Annual Yield */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span>Simulated Yield ({annualYieldPct}%)</span>
            <span className="text-[10px] font-bold text-amber-600 uppercase">Assumption</span>
          </div>
          <div className="text-2xl font-extrabold text-teal-600 dark:text-teal-400">
            ₹{Math.round(annualSimulatedYield).toLocaleString()} / yr
          </div>
          <span className="text-[11px] text-slate-500 block mt-1">
            ₹{Math.round(dailySimulatedYield).toLocaleString()} daily accrued
          </span>
        </div>

        {/* Net Treasury Spread */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span>Treasury Margin Spread</span>
            <Activity className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
            +₹{Math.round(netTreasurySpread).toLocaleString()} / yr
          </div>
          <span className="text-[11px] text-slate-500 block mt-1">
            After ₹{Math.round(annualRewardPayouts).toLocaleString()} partner coupon redemptions
          </span>
        </div>

        {/* Aggregate User Base & IDR */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span>Aggregate IDR</span>
            <Users className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">
            74.8%
          </div>
          <span className="text-[11px] text-slate-500 block mt-1">
            Across {activeUsers.toLocaleString()} active professionals
          </span>
        </div>
      </div>

      {/* Interactive Assumptions Modeler (Demo step 8) */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-600" />
              <span>Interactive Model Assumptions (Demo Script Step 8)</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Adjust levers to model fund self-sustainability and unit economics.
            </p>
          </div>
          <span className="text-[11px] text-slate-400 italic">
            Labeled an assumption per PRD Section F12
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 text-xs">
          {/* Lever 1: Annual Yield */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex justify-between font-semibold">
              <span>Annual Yield on Pledge Pool</span>
              <span className="text-teal-600 font-bold">{annualYieldPct}%</span>
            </div>
            <input
              type="range"
              min="3.0"
              max="10.0"
              step="0.5"
              value={annualYieldPct}
              onChange={e => setAnnualYieldPct(Number(e.target.value))}
              className="w-full accent-teal-600 cursor-pointer"
            />
            <p className="text-[10px] text-slate-400">
              PRD Default: 6.0% annual yield on low-risk instruments.
            </p>
          </div>

          {/* Lever 2: Active User Scale */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex justify-between font-semibold">
              <span>Active Professionals</span>
              <span className="text-indigo-600 font-bold">{activeUsers.toLocaleString()}</span>
            </div>
            <input
              type="range"
              min="500"
              max="10000"
              step="100"
              value={activeUsers}
              onChange={e => setActiveUsers(Number(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <p className="text-[10px] text-slate-400">
              Beachhead: early-career professionals and managers.
            </p>
          </div>

          {/* Lever 3: Average Pledge */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex justify-between font-semibold">
              <span>Average User Pledge</span>
              <span className="text-teal-600 font-bold">₹{avgPledge.toLocaleString()}</span>
            </div>
            <input
              type="range"
              min="500"
              max="5000"
              step="250"
              value={avgPledge}
              onChange={e => setAvgPledge(Number(e.target.value))}
              className="w-full accent-teal-600 cursor-pointer"
            />
            <p className="text-[10px] text-slate-400">
              Default ₹2,000 slider.
            </p>
          </div>
        </div>
      </div>

      {/* Product Principle 6 & 7 Callout */}
      <div className="p-5 rounded-2xl bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800/60 text-xs text-slate-700 dark:text-slate-300 space-y-2">
        <h4 className="font-bold text-teal-900 dark:text-teal-200 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-teal-600" />
          <span>Non-Negotiable Product Principles (Section 2)</span>
        </h4>
        <ul className="list-disc pl-4 space-y-1 text-slate-600 dark:text-slate-400">
          <li><strong>Principle 5:</strong> The deposit is always the user's: visible, withdrawable at any time, never reduced by penalties.</li>
          <li><strong>Principle 6:</strong> The company never profits from user failure.</li>
          <li><strong>Principle 7:</strong> Sponsors and partners never influence the coach's hints, resources, or rankings.</li>
        </ul>
      </div>
    </div>
  );
};
