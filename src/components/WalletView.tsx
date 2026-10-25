/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Wallet as WalletIcon,
  Coins,
  ArrowUpRight,
  ArrowDownLeft,
  ShoppingBag,
  Info,
  CheckCircle2,
  AlertTriangle,
  Gift,
  Copy,
  Check,
  ShieldAlert,
} from 'lucide-react';
import { PartnerCoupon, PointEvent, Wallet } from '../types';
import { Storage } from '../utils/storage';

interface WalletViewProps {
  wallet: Wallet;
  coupons: PartnerCoupon[];
  pointEvents: PointEvent[];
  onRefreshData: () => void;
}

export const WalletView: React.FC<WalletViewProps> = ({
  wallet,
  coupons,
  pointEvents,
  onRefreshData,
}) => {
  // Slider & modals
  const [pledgeSlider, setPledgeSlider] = useState(wallet.principal || 2000);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState(500);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addAmount, setAddAmount] = useState(1000);

  // Redemption code popup
  const [redeemedCodeInfo, setRedeemedCodeInfo] = useState<{
    title: string;
    code: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Pending this week estimation
  const positivePointsRecent = pointEvents
    .filter(
      p =>
        p.points > 0 &&
        new Date(p.createdAt).getTime() >= Date.now() - 7 * 86400000
    )
    .reduce((sum, p) => sum + p.points, 0);

  const pendingThisWeek = Math.min(
    Math.round(positivePointsRecent * 0.05 * 10) / 10,
    Math.round(wallet.principal * 0.005)
  );

  const handleUpdatePledge = () => {
    const diff = pledgeSlider - wallet.principal;
    if (diff > 0) {
      Storage.addPledge(diff);
      Storage.logAnalyticsEvent('pledge_changed', { newPledge: pledgeSlider });
    } else if (diff < 0) {
      Storage.withdrawPledge(Math.abs(diff));
      Storage.logAnalyticsEvent('withdrawal', { amount: Math.abs(diff) });
    }
    onRefreshData();
  };

  const handleConfirmWithdraw = () => {
    setShowWithdrawConfirm(false);
    Storage.withdrawPledge(withdrawAmount);
    setPledgeSlider(Math.max(0, wallet.principal - withdrawAmount));
    Storage.logAnalyticsEvent('withdrawal', { amount: withdrawAmount });
    onRefreshData();
  };

  const handleConfirmAddFunds = () => {
    setShowAddModal(false);
    Storage.addPledge(addAmount);
    setPledgeSlider(wallet.principal + addAmount);
    Storage.logAnalyticsEvent('pledge_changed', { added: addAmount });
    onRefreshData();
  };

  const handleRedeem = (couponId: string) => {
    const res = Storage.redeemCoupon(couponId);
    if (res.success && res.code) {
      const c = coupons.find(x => x.id === couponId);
      setRedeemedCodeInfo({
        title: c?.title || 'Partner Voucher',
        code: res.code,
      });
      onRefreshData();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      {/* Modal: Redeem Code Success */}
      {redeemedCodeInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto">
              <Gift className="w-7 h-7" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Coupon Redeemed!
              </h3>
              <p className="text-xs text-slate-500 mt-1">{redeemedCodeInfo.title}</p>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-dashed border-teal-500/50 flex items-center justify-between">
              <span className="font-mono text-sm font-bold text-teal-700 dark:text-teal-300">
                {redeemedCodeInfo.code}
              </span>
              <button
                onClick={() => copyToClipboard(redeemedCodeInfo.code)}
                className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-teal-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <p className="text-[11px] text-slate-400">
              Sample partner offer simulated code. Use at checkout on the partner website.
            </p>

            <button
              onClick={() => setRedeemedCodeInfo(null)}
              className="w-full py-2.5 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Modal: Withdraw Confirmation */}
      {showWithdrawConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-slate-900 dark:text-white font-bold text-base">
              <ShieldAlert className="w-5 h-5 text-teal-600" />
              <span>Confirm Instant Withdrawal</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Your deposit is 100% yours. Principal is never reduced by penalties. Withdrawing will return ₹
              {withdrawAmount.toLocaleString()} to your account instantly (simulated).
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Withdrawal Amount: ₹{withdrawAmount.toLocaleString()}
              </label>
              <input
                type="range"
                min="100"
                max={wallet.principal}
                step="100"
                value={withdrawAmount}
                onChange={e => setWithdrawAmount(Number(e.target.value))}
                className="w-full accent-teal-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                <span>₹100</span>
                <span>Max: ₹{wallet.principal.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setShowWithdrawConfirm(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmWithdraw}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white cursor-pointer"
              >
                Confirm & Withdraw
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Funds */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Add Funds to Commitment Pledge
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Increasing your pledge raises your weekly reward earning cap (0.5% weekly cap). Funds remain fully withdrawable.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Amount to Add: ₹{addAmount.toLocaleString()}
              </label>
              <input
                type="range"
                min="500"
                max="5000"
                step="500"
                value={addAmount}
                onChange={e => setAddAmount(Number(e.target.value))}
                className="w-full accent-teal-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                <span>₹500</span>
                <span>₹5,000</span>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAddFunds}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white cursor-pointer"
              >
                Add ₹{addAmount.toLocaleString()}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Balances Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Commitment Pledge Card */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <WalletIcon className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                <span className="font-bold text-sm text-slate-900 dark:text-white">
                  Commitment Pledge (Principal)
                </span>
              </div>
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300">
                100% Protected
              </span>
            </div>

            <div className="text-3xl font-extrabold text-slate-900 dark:text-white mb-1">
              ₹{wallet.principal.toLocaleString()}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Your deposit is always yours. Withdrawable at any time, never reduced by penalties.
            </p>

            {/* Slider to adjust */}
            <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
              <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span>Adjust Pledge Slider</span>
                <span className="text-teal-600">₹{pledgeSlider.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min="100"
                max="10000"
                step="100"
                value={pledgeSlider}
                onChange={e => setPledgeSlider(Number(e.target.value))}
                className="w-full accent-teal-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>₹100</span>
                <span>Default: ₹2,000</span>
                <span>₹10,000</span>
              </div>
              {pledgeSlider !== wallet.principal && (
                <button
                  type="button"
                  onClick={handleUpdatePledge}
                  className="w-full mt-2 py-1.5 rounded-lg text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white cursor-pointer"
                >
                  Save New Pledge (₹{pledgeSlider.toLocaleString()})
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 mt-4">
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="flex-1 py-2 px-3 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              <span>Add Funds</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setWithdrawAmount(Math.min(500, wallet.principal));
                setShowWithdrawConfirm(true);
              }}
              disabled={wallet.principal <= 0}
              className="flex-1 py-2 px-3 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 transition-colors cursor-pointer disabled:opacity-40 flex items-center justify-center gap-1.5"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Withdraw Principal</span>
            </button>
          </div>
        </div>

        {/* Reward Balance (RC) Card */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-500" />
                <span className="font-bold text-sm text-slate-900 dark:text-white">
                  Reward Balance (RC)
                </span>
              </div>
              <span className="text-[11px] font-semibold text-slate-500">
                1 RC = ₹1 coupon value
              </span>
            </div>

            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-3xl font-extrabold text-teal-600 dark:text-teal-400">
                {wallet.rewardBalance}
              </span>
              <span className="text-sm font-semibold text-slate-400">RC</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs my-4">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 block text-[11px]">Pending this week</span>
                <span className="font-bold text-slate-900 dark:text-white text-base">
                  +{pendingThisWeek} RC
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Accrues weekly from positive points
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 block text-[11px]">Lifetime Earned</span>
                <span className="font-bold text-slate-900 dark:text-white text-base">
                  {wallet.lifetimeRewards} RC
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Redeemable in partner store
                </span>
              </div>
            </div>

            {/* Compact "This Week" Progress Bar (PRD V2 Section 4 & 11) */}
            {(() => {
              const attempts = Storage.getAttempts();
              const domains = Storage.getDomains();
              const user = Storage.getUserProfile();
              const goal = user.ownTakesWeeklyGoal || 10;
              // Calculate qualifying takes this week
              const oneWeekAgo = Date.now() - 7 * 86400000;
              const growthIds = new Set(domains.filter(d => d.isGrowth).map(d => d.id));
              const sessions = Storage.getSessions();
              const sessionDomainMap = new Map(sessions.map(s => [s.id, s.domainId]));
              const takesThisWeek = attempts.filter(a => {
                if (new Date(a.createdAt).getTime() < oneWeekAgo) return false;
                if (a.score < 40) return false;
                const domainId = sessionDomainMap.get(a.sessionId);
                return domainId ? growthIds.has(domainId) : false;
              }).length;
              const pct = Math.min(100, Math.round((takesThisWeek / goal) * 100));

              return (
                <div className="p-3 rounded-xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200/60 dark:border-teal-900/40 space-y-1.5 my-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-teal-900 dark:text-teal-200">
                      This Week: Own takes
                    </span>
                    <span className="font-bold text-teal-700 dark:text-teal-300">
                      {takesThisWeek} / {goal} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-teal-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-teal-800 dark:text-teal-400">
                    {takesThisWeek >= goal
                      ? 'Weekly goal met! Full yield unlocked.'
                      : `${goal - takesThisWeek} more qualifying take${goal - takesThisWeek === 1 ? '' : 's'} to meet weekly goal.`}
                  </p>
                </div>
              );
            })()}
          </div>

          <div className="p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/50 text-[11px] text-amber-800 dark:text-amber-300">
            Going AI-first in your growth domains reduces your reward points (at ₹0.05 per penalty point), never your pledge principal.
          </div>
        </div>
      </div>

      {/* Rewards Store: 6 Sample Partner Offers */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-teal-600" />
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Rewards Store (Sample Partner Offers)
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Learning-aligned partner perks. Separated from coaching; no logos appear in Ask or Rehearsal screens.
            </p>
          </div>
          <span className="text-xs font-bold text-teal-600">
            Balance: {wallet.rewardBalance} RC
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {coupons.map(coupon => {
            const canAfford = wallet.rewardBalance >= coupon.costRC;
            const isRedeemed = !!coupon.mockCode;

            return (
              <div
                key={coupon.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase font-bold text-slate-500">
                      {coupon.partner}
                    </span>
                    <span className="text-xs font-bold text-teal-600">
                      {coupon.costRC} RC
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-1">
                    {coupon.title}
                  </h4>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-3">
                    {coupon.discount}
                  </p>
                </div>

                <div>
                  {isRedeemed ? (
                    <div className="p-2 rounded-lg bg-teal-50 dark:bg-teal-950 border border-teal-200 dark:border-teal-800 flex items-center justify-between">
                      <span className="font-mono text-[11px] font-bold text-teal-800 dark:text-teal-300">
                        {coupon.mockCode}
                      </span>
                      <button
                        onClick={() => copyToClipboard(coupon.mockCode || '')}
                        className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleRedeem(coupon.id)}
                      disabled={!canAfford}
                      className="w-full py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white transition-colors cursor-pointer"
                    >
                      {canAfford ? `Redeem for ${coupon.costRC} RC` : `Need ${coupon.costRC - wallet.rewardBalance} more RC`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Transaction History Table */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <h3 className="font-bold text-sm text-slate-900 dark:text-white">
          Simulated Transaction History
        </h3>
        <div className="space-y-2">
          {wallet.transactions.map(tx => (
            <div
              key={tx.id}
              className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs flex items-center justify-between"
            >
              <div>
                <span className="font-semibold text-slate-900 dark:text-white capitalize">
                  {tx.type}: {tx.description}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {new Date(tx.createdAt).toLocaleDateString()}
                </span>
              </div>
              <span
                className={`font-bold ${
                  tx.type === 'deposit' || tx.type === 'accrual'
                    ? 'text-teal-600 dark:text-teal-400'
                    : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                {tx.type === 'withdraw' || tx.type === 'redeem' ? '-' : '+'}
                {tx.currency === 'INR' ? `₹${tx.amount.toLocaleString()}` : `${tx.amount} RC`}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
