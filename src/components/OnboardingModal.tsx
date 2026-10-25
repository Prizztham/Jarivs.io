/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  Check,
  Plus,
  Coins,
  Sparkles,
} from 'lucide-react';
import { DomainItem, DomainLevel, PlanType } from '../types';
import { Storage } from '../utils/storage';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const STATIC_DOMAIN_OPTIONS = [
  'Writing and memos',
  'Decision-making',
  'Hiring and people',
  'Analysis',
  'Presenting',
  'Learning new topics',
];

// Baseline questions per domain
const BASELINE_QUESTIONS: Record<string, { q: string; options: { label: string; score: number }[] }[]> = {
  'Writing and memos': [
    {
      q: 'When writing an executive proposal, what is your primary starting point?',
      options: [
        { label: 'Prompt AI to generate full memo draft immediately', score: 1 },
        { label: 'Jot 3 core tradeoffs and target outcome before prompting', score: 3 },
        { label: 'Write the conclusion and ask AI to backfill references', score: 2 },
      ],
    },
    {
      q: 'How do you handle ambiguous requirements from leadership in a memo?',
      options: [
        { label: 'State assumptions explicitly with failure bounds', score: 3 },
        { label: 'Use broad persuasive language to cover all bases', score: 1 },
        { label: 'Deliver options with pros and cons', score: 2 },
      ],
    },
    {
      q: 'When editing AI-generated prose for high-stakes stakeholders:',
      options: [
        { label: 'Skim for grammar and flow', score: 1 },
        { label: 'Verify factual claims against primary telemetry', score: 3 },
        { label: 'Shorten paragraphs to bullet points', score: 2 },
      ],
    },
    {
      q: 'What distinguishes genuine executive communication?',
      options: [
        { label: 'High polish and academic vocabulary', score: 1 },
        { label: 'Direct ownership of risks and resource asks', score: 3 },
        { label: 'Visual diagrams and appendices', score: 2 },
      ],
    },
    {
      q: 'If an AI summary contradicts your gut instinct on client sentiment:',
      options: [
        { label: 'Trust the AI because it processed more text', score: 1 },
        { label: 'Interrogate why the AI inferred that conclusion vs yours', score: 3 },
        { label: 'Ask AI to generate an alternate neutral summary', score: 2 },
      ],
    },
  ],
  'Decision-making': [
    {
      q: 'When facing an irreversible one-way door decision:',
      options: [
        { label: 'Seek AI consensus on probability distributions', score: 2 },
        { label: 'Frame explicit pre-mortem scenarios before consulting tools', score: 3 },
        { label: 'Delegate data gathering and follow top recommendation', score: 1 },
      ],
    },
    {
      q: 'How do you calibrate your confidence level on strategic forecasts?',
      options: [
        { label: 'Base confidence on team excitement', score: 1 },
        { label: 'Track past predictions against empirical outcomes', score: 3 },
        { label: 'Rely on industry benchmarks provided by LLMs', score: 2 },
      ],
    },
    {
      q: 'A high-impact decision has conflicting signals from two senior leads. You:',
      options: [
        { label: 'Ask AI to reconcile both into a compromise', score: 1 },
        { label: 'Identify underlying premise difference and test the core assumption', score: 3 },
        { label: 'Escalate to leadership with both memos', score: 2 },
      ],
    },
    {
      q: 'When speed conflicts with depth in growth decisions:',
      options: [
        { label: 'Default to instant AI answer to keep velocity high', score: 1 },
        { label: 'Take 30 seconds to lock personal hypothesis first', score: 3 },
        { label: 'Delay decision until comprehensive data is available', score: 2 },
      ],
    },
    {
      q: 'After an unexpected decision failure:',
      options: [
        { label: 'Blame flawed data or poor model execution', score: 1 },
        { label: 'Review the original decision premise vs outcome divergence', score: 3 },
        { label: 'Quickly pivot to the next initiative', score: 2 },
      ],
    },
  ],
};

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedDomains, setSelectedDomains] = useState<string[]>([
    'Writing and memos',
    'Decision-making',
  ]);
  const [customDomainInput, setCustomDomainInput] = useState('');
  const [showAddCustom, setShowAddCustom] = useState(false);

  // Baseline answers: domain -> array of selected option index
  const [baselineAnswers, setBaselineAnswers] = useState<Record<string, number[]>>({});
  const [currentBaselineDomainIndex, setCurrentBaselineDomainIndex] = useState(0);

  // Step 3: Pledge & Plan
  const [pledgeAmount, setPledgeAmount] = useState(2000);
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('free');

  if (!isOpen) return null;

  const toggleDomain = (domain: string) => {
    if (selectedDomains.includes(domain)) {
      if (selectedDomains.length > 1) {
        setSelectedDomains(selectedDomains.filter(d => d !== domain));
      }
    } else {
      if (selectedDomains.length < 4) {
        setSelectedDomains([...selectedDomains, domain]);
      }
    }
  };

  const handleAddCustom = () => {
    if (!customDomainInput.trim()) return;
    const name = customDomainInput.trim();
    if (!selectedDomains.includes(name) && selectedDomains.length < 4) {
      setSelectedDomains([...selectedDomains, name]);
    }
    setCustomDomainInput('');
    setShowAddCustom(false);
  };

  // Determine levels from answers
  const finishOnboarding = () => {
    const existingDomains = Storage.getDomains();
    const updatedDomains: DomainItem[] = existingDomains.map(d => {
      const isGrowth = selectedDomains.includes(d.name);
      let level: DomainLevel = 'Developing';

      const answers = baselineAnswers[d.name] || [];
      if (answers.length > 0) {
        const questions = BASELINE_QUESTIONS[d.name] || BASELINE_QUESTIONS['Writing and memos'];
        const totalScore = answers.reduce((sum, optIdx, qIdx) => {
          const score = questions[qIdx]?.options[optIdx]?.score || 2;
          return sum + score;
        }, 0);
        if (totalScore >= 13) level = 'Strong';
        else if (totalScore >= 9) level = 'Developing';
        else level = 'Beginner';
      }

      return {
        ...d,
        isGrowth,
        level,
      };
    });

    // Check custom domains not in existing
    selectedDomains.forEach(domName => {
      if (!updatedDomains.some(d => d.name === domName)) {
        updatedDomains.push({
          id: `dom_cust_${Date.now()}`,
          name: domName,
          isGrowth: true,
          level: 'Developing',
          createdAt: new Date().toISOString(),
        });
      }
    });

    Storage.saveDomains(updatedDomains);

    const user = Storage.getUserProfile();
    Storage.saveUserProfile({
      ...user,
      plan: selectedPlan,
      onboardingDone: true,
    });

    // Set initial wallet pledge
    const wallet = Storage.getWallet();
    Storage.saveWallet({
      ...wallet,
      principal: pledgeAmount,
    });

    Storage.logAnalyticsEvent('onboarding_completed', {
      domains: selectedDomains,
      pledge: pledgeAmount,
      plan: selectedPlan,
    });

    onComplete();
    onClose();
  };

  const currentBaselineDomain = selectedDomains[currentBaselineDomainIndex];
  const questionsForCurrent = BASELINE_QUESTIONS[currentBaselineDomain] || BASELINE_QUESTIONS['Writing and memos'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 relative max-h-[92vh] overflow-y-auto">
        {/* Step Indicator */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-xs">
              {step}
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {step === 1 && '1. Choose Growth Domains'}
                {step === 2 && '2. Quick Baseline Calibration'}
                {step === 3 && '3. Pledge & Plan (Optional)'}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {step === 1 && 'Pick 1 to 4 areas where you want to keep your judgement sharp.'}
                {step === 2 && 'Five brief scenarios to calibrate starting baseline level.'}
                {step === 3 && 'All money is simulated. Withdraw your deposit anytime.'}
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold text-slate-400">Step {step} of 3</span>
        </div>

        {/* STEP 1: Select 1 to 4 growth domains */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800/60 text-xs text-teal-800 dark:text-teal-200">
              <span className="font-semibold">Core Principle: </span>
              In growth domains, Jarvis prompts you to think first before answers are revealed. All other domains are delegation areas and stay instant with zero penalties.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {STATIC_DOMAIN_OPTIONS.map(dom => {
                const isSelected = selectedDomains.includes(dom);
                return (
                  <button
                    key={dom}
                    type="button"
                    onClick={() => toggleDomain(dom)}
                    className={`p-3.5 rounded-xl border text-left flex items-start justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'border-teal-600 bg-teal-50/70 dark:bg-teal-950/50 text-slate-900 dark:text-white ring-1 ring-teal-500'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/30 dark:bg-slate-800/20 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="text-sm font-semibold">{dom}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {isSelected ? 'Growth domain (think-first)' : 'Delegation (instant)'}
                      </div>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
                        isSelected
                          ? 'bg-teal-600 text-white'
                          : 'border border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Custom domain */}
            {showAddCustom ? (
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="text"
                  value={customDomainInput}
                  onChange={e => setCustomDomainInput(e.target.value)}
                  placeholder="e.g. Product Strategy, Financial Modeling..."
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
                <button
                  onClick={handleAddCustom}
                  className="px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Add
                </button>
                <button
                  onClick={() => setShowAddCustom(false)}
                  className="px-2 py-2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAddCustom(true)}
                disabled={selectedDomains.length >= 4}
                className="flex items-center gap-1.5 text-xs text-teal-600 dark:text-teal-400 font-semibold hover:underline cursor-pointer disabled:opacity-40"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add custom domain ({selectedDomains.length}/4 selected)</span>
              </button>
            )}

            <div className="pt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={selectedDomains.length === 0}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white shadow-sm cursor-pointer"
              >
                <span>Continue to Baseline ({selectedDomains.length} selected)</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Quick Baseline */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-teal-600 dark:text-teal-400">
                Calibrating: {currentBaselineDomain}
              </span>
              <span>
                Domain {currentBaselineDomainIndex + 1} of {selectedDomains.length}
              </span>
            </div>

            <div className="space-y-3.5">
              {questionsForCurrent.map((item, qIdx) => {
                const currentSelection = baselineAnswers[currentBaselineDomain]?.[qIdx];
                return (
                  <div
                    key={qIdx}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800"
                  >
                    <p className="text-xs font-semibold text-slate-900 dark:text-white mb-2">
                      {qIdx + 1}. {item.q}
                    </p>
                    <div className="space-y-1.5">
                      {item.options.map((opt, optIdx) => {
                        const isChosen = currentSelection === optIdx;
                        return (
                          <button
                            key={optIdx}
                            type="button"
                            onClick={() => {
                              const currentList = [
                                ...(baselineAnswers[currentBaselineDomain] || [0, 0, 0, 0, 0]),
                              ];
                              currentList[qIdx] = optIdx;
                              setBaselineAnswers({
                                ...baselineAnswers,
                                [currentBaselineDomain]: currentList,
                              });
                            }}
                            className={`w-full text-left p-2 rounded-lg text-xs border transition-colors cursor-pointer flex items-center justify-between ${
                              isChosen
                                ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/60 text-teal-900 dark:text-teal-200 font-medium'
                                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                            }`}
                          >
                            <span>{opt.label}</span>
                            {isChosen && <Check className="w-3.5 h-3.5 text-teal-600 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  if (currentBaselineDomainIndex > 0) {
                    setCurrentBaselineDomainIndex(currentBaselineDomainIndex - 1);
                  } else {
                    setStep(1);
                  }
                }}
                className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="px-4 py-2 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                >
                  Skip quiz (use Developing)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (currentBaselineDomainIndex + 1 < selectedDomains.length) {
                      setCurrentBaselineDomainIndex(currentBaselineDomainIndex + 1);
                    } else {
                      setStep(3);
                    }
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white cursor-pointer"
                >
                  <span>
                    {currentBaselineDomainIndex + 1 < selectedDomains.length
                      ? 'Next Domain'
                      : 'Continue to Pledge'}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Pledge & Plan */}
        {step === 3 && (
          <div className="space-y-5">
            {/* Simulated pledge card */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Simulated Commitment Pledge
                  </span>
                </div>
                <span className="text-sm font-bold text-teal-600 dark:text-teal-400">
                  ₹{pledgeAmount.toLocaleString()}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
                Your pledge is simulated. It stays 100% yours and withdrawable at any moment. Going AI-first in your growth domains reduces your reward points, never your deposit.
              </p>
              <input
                type="range"
                min="100"
                max="10000"
                step="100"
                value={pledgeAmount}
                onChange={e => setPledgeAmount(Number(e.target.value))}
                className="w-full accent-teal-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>₹100</span>
                <span>Default: ₹2,000</span>
                <span>₹10,000</span>
              </div>
            </div>

            {/* Plan Choice */}
            <div>
              <label className="block text-xs font-bold text-slate-900 dark:text-white mb-2">
                Select Workspace Tier (Simulated)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedPlan('free')}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    selectedPlan === 'free'
                      ? 'border-teal-600 bg-teal-50/60 dark:bg-teal-950/40 ring-1 ring-teal-500'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/30'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">Free Plan</span>
                    <span className="text-xs font-bold text-slate-500">₹0</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Ask flow, think-first takes, 5 guided paths/wk, Progress Tracking, simulated pledge.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedPlan('plus')}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    selectedPlan === 'plus'
                      ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 ring-1 ring-indigo-500'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/30'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                      Jarvis Plus
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    </span>
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                      ₹199 / mo
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Unlimited guided paths, defend-it rehearsals, next-day teach-back, calibration analytics.
                  </p>
                </button>
              </div>
            </div>

            <div className="pt-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={finishOnboarding}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-md cursor-pointer"
              >
                <span>Enter Jarvis Workspace</span>
                <ShieldCheck className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
