/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Shield,
  X,
  Send,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { AudienceType, Rehearsal } from '../types';
import { aiService } from '../services/aiService';
import { Storage } from '../utils/storage';
import { calculateRehearsalPoints } from '../utils/rules';

interface RehearsalModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDraft?: string;
  onCompleted?: () => void;
  onSelectCoachTopic?: (topic: string) => void;
}

export const RehearsalModal: React.FC<RehearsalModalProps> = ({
  isOpen,
  onClose,
  initialDraft = '',
  onCompleted,
  onSelectCoachTopic,
}) => {
  const [draft, setDraft] = useState(initialDraft);
  const [audience, setAudience] = useState<AudienceType>('Senior leader');
  const [step, setStep] = useState<'input' | 'questioning' | 'summary'>('input');

  // Question state
  const [questions, setQuestions] = useState<string[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [answers, setAnswers] = useState<string[]>([]);
  const [scores, setScores] = useState<number[]>([]);
  const [feedbacks, setFeedbacks] = useState<string[]>([]);
  const [followUp, setFollowUp] = useState<string | null>(null);
  const [hasFollowUpBeenAnswered, setHasFollowUpBeenAnswered] = useState(false);
  const [pointsClaimed, setPointsClaimed] = useState(false);
  const [suggestedTopics, setSuggestedTopics] = useState<string[]>([]);

  // Loading & error state with 15s retry
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const audiences: AudienceType[] = ['Senior leader', 'Peer', 'Client', 'Team'];

  const startRehearsal = async () => {
    if (!draft.trim()) return;
    setIsLoading(true);
    setErrorMessage(null);

    const result = await aiService.rehearsalQuestions(draft.trim(), audience);
    setIsLoading(false);

    if (result.error || !result.data?.questions?.length) {
      setErrorMessage(result.error || 'Failed to start rehearsal. Please try again.');
      return;
    }

    // Strictly ensure exactly 3 questions
    const qList = result.data.questions.slice(0, 3);
    while (qList.length < 3) {
      qList.push(`What is the primary risk mitigation or rollback plan for this proposal?`);
    }

    setQuestions(qList);
    setCurrentQIndex(0);
    setAnswers([]);
    setScores([]);
    setFeedbacks([]);
    setCurrentAnswer('');
    setFollowUp(null);
    setHasFollowUpBeenAnswered(false);
    setPointsClaimed(false);
    setStep('questioning');
  };

  const submitAnswer = async () => {
    if (!currentAnswer.trim()) return;
    setIsLoading(true);
    setErrorMessage(null);

    const isAnsweringFollowUp = Boolean(followUp);
    const activeQuestion = followUp || questions[currentQIndex];
    const result = await aiService.scoreRehearsalAnswer(activeQuestion, currentAnswer.trim(), audience);
    setIsLoading(false);

    if (result.error || !result.data) {
      setErrorMessage(result.error || 'Evaluation timed out or failed. Please retry.');
      return;
    }

    const newAnswers = [...answers, currentAnswer.trim()];
    const newScores = [...scores, result.data.score];
    const newFeedbacks = [...feedbacks, result.data.feedback];

    setAnswers(newAnswers);
    setScores(newScores);
    setFeedbacks(newFeedbacks);
    setCurrentAnswer('');

    // If initial question had a follow-up and we haven't answered a follow-up yet for this question:
    if (!isAnsweringFollowUp && result.data.followUp) {
      setFollowUp(result.data.followUp);
      setHasFollowUpBeenAnswered(false);
      return;
    }

    // Reset follow-up state
    setFollowUp(null);
    setHasFollowUpBeenAnswered(false);

    // Strictly 3 primary questions: indices 0, 1, 2
    if (currentQIndex + 1 < 3) {
      setCurrentQIndex(currentQIndex + 1);
    } else {
      // Rehearsal complete! Transition immediately to summary screen.
      const totalScore = newScores.reduce((a, b) => a + b, 0);
      const avgScore = Math.round(totalScore / newScores.length);

      // Generate suggested coach topics based on draft and vulnerable area
      const coachTopics = [
        `Risk mitigation & trade-off framing for ${audience.toLowerCase()}s`,
        `Quantifying blast radius & edge-case mitigations`,
      ];
      setSuggestedTopics(coachTopics);

      if (!pointsClaimed) {
        setPointsClaimed(true);
        const rehearsalRecord: Rehearsal = {
          id: `reh_${Date.now()}`,
          draftText: draft,
          audience,
          questions,
          answers: newAnswers,
          scores: newScores,
          feedbacks: newFeedbacks,
          avgScore,
          suggestedCoachTopics: coachTopics,
          pointsAwarded: true,
          completedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        };
        Storage.addRehearsal(rehearsalRecord);

        const pointsEarned = calculateRehearsalPoints(avgScore);
        Storage.addPointEvent({
          id: `pt_reh_${Date.now()}`,
          type: 'rehearsal_completed',
          points: pointsEarned,
          description: `Defend-it rehearsal (${audience}) scored ${avgScore}/100`,
          createdAt: new Date().toISOString(),
        });

        Storage.logAnalyticsEvent('rehearsal_completed', {
          audience,
          avgScore,
          points: pointsEarned,
        });
      }

      setStep('summary');
      onCompleted?.();
    }
  };

  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const isPassed = avg >= 60;

  // Find strongest and weakest
  let strongestIdx = 0;
  let weakestIdx = 0;
  scores.forEach((s, i) => {
    if (s > scores[strongestIdx]) strongestIdx = i;
    if (s < scores[weakestIdx]) weakestIdx = i;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Defend-It Rehearsal
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Face a sceptical reviewer before presenting to leadership, clients, or peers.
            </p>
          </div>
        </div>

        {/* Error message banner */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={step === 'input' ? startRehearsal : submitAnswer}
              className="px-2.5 py-1 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* STEP 1: Input draft & Audience */}
        {step === 'input' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Who will you be defending this to?
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {audiences.map(aud => (
                  <button
                    key={aud}
                    type="button"
                    onClick={() => setAudience(aud)}
                    className={`py-2 px-3 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer ${
                      audience === aud
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-semibold'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {aud}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Paste your proposal, memo, or key decision
              </label>
              <textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder="e.g. Proposing that we freeze all non-critical feature releases for 30 days to clear architectural technical debt..."
                rows={5}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={startRehearsal}
                disabled={!draft.trim() || isLoading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white shadow-sm transition-colors cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Preparing Skeptical Reviewer...</span>
                  </>
                ) : (
                  <>
                    <span>Start Rehearsal (3 Questions)</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Questioning */}
        {step === 'questioning' && (
          <div className="space-y-5">
            {/* Progress indicator */}
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium text-indigo-600 dark:text-indigo-400">
                Audience: {audience}
              </span>
              <span>
                Question {currentQIndex + 1} of 3
              </span>
            </div>

            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${((currentQIndex + (followUp ? 0.5 : 0)) / 3) * 100}%` }}
              />
            </div>

            {/* Sceptical Question Card */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div className="text-xs uppercase tracking-wider font-semibold text-indigo-600 dark:text-indigo-400 mb-1.5">
                {followUp ? 'Follow-Up Challenge' : `Sceptical Reviewer asks:`}
              </div>
              <p className="text-sm font-medium text-slate-900 dark:text-white leading-relaxed">
                "{followUp || questions[currentQIndex]}"
              </p>
            </div>

            {/* Previous feedback snippet if follow-up */}
            {followUp && feedbacks.length > 0 && (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                <span className="font-semibold">Initial take scored {scores[scores.length - 1]}/100: </span>
                {feedbacks[feedbacks.length - 1]}
              </div>
            )}

            {/* Answer Input */}
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Your Spoken / Written Defense
              </label>
              <textarea
                value={currentAnswer}
                onChange={e => setCurrentAnswer(e.target.value)}
                placeholder="Defend your position with specific evidence, tradeoffs, and risks acknowledged..."
                rows={4}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Submit answer */}
            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-slate-400">
                Tip: Direct acknowledgement of tradeoffs scores higher than deflection.
              </div>
              <button
                type="button"
                onClick={submitAnswer}
                disabled={!currentAnswer.trim() || isLoading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white shadow-sm transition-colors cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Reviewing defense...</span>
                  </>
                ) : (
                  <>
                    <span>Submit Defense</span>
                    <Send className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Summary */}
        {step === 'summary' && (
          <div className="space-y-6">
            <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50/50 via-white to-teal-50/50 dark:from-slate-800/50 dark:via-slate-900 dark:to-teal-950/20 border border-indigo-100 dark:border-indigo-900/40 text-center">
              <div
                className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3 ${
                  isPassed
                    ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400'
                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                }`}
              >
                {isPassed ? <CheckCircle2 className="w-8 h-8" /> : <AlertTriangle className="w-8 h-8" />}
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                {avg}/100 Defensibility Score
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {isPassed
                  ? `Passed the ${audience} readiness threshold (60+). Earned +20 points!`
                  : `Below 60 pass threshold. Earned +8 points for testing your reasoning.`}
              </p>
            </div>

            {/* Answer Breakdown */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Evaluation Breakdown
              </h4>

              {questions.map((q, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-900 dark:text-white">
                      Q{idx + 1}: {q}
                    </span>
                    <span
                      className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                        (scores[idx] || 0) >= 70
                          ? 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300'
                          : (scores[idx] || 0) >= 50
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                      }`}
                    >
                      {scores[idx] || 0}/100
                    </span>
                  </div>
                  <div className="text-slate-600 dark:text-slate-300 mt-1 italic">
                    "{feedbacks[idx] || 'Defense analyzed.'}"
                  </div>
                </div>
              ))}
            </div>

            {/* Strongest & Weakest Callout */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800/60">
                <span className="font-bold text-teal-800 dark:text-teal-300">Strongest Argument:</span>
                <p className="text-slate-700 dark:text-slate-300 mt-0.5">
                  Question {strongestIdx + 1} ({scores[strongestIdx] || 0}/100). Clear evidence and tradeoff awareness.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60">
                <span className="font-bold text-amber-800 dark:text-amber-300">Most Vulnerable Area:</span>
                <p className="text-slate-700 dark:text-slate-300 mt-0.5">
                  Question {weakestIdx + 1} ({scores[weakestIdx] || 0}/100). Focus on quantifying edge case impact.
                </p>
              </div>
            </div>

            {/* Suggested Coach Topics (PRD V2 Section 5 & 11) */}
            {suggestedTopics.length > 0 && (
              <div className="p-3.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/60">
                <div className="flex items-center gap-2 text-xs font-semibold text-indigo-900 dark:text-indigo-300 mb-2">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  <span>Suggested Topics to Explore in Coach</span>
                </div>
                <div className="space-y-1.5">
                  {suggestedTopics.map((topic, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        onClose();
                        onSelectCoachTopic?.(topic);
                      }}
                      className="w-full text-left flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-800 border border-indigo-100 dark:border-indigo-900 hover:border-indigo-400 dark:hover:border-indigo-600 transition-colors cursor-pointer group text-xs"
                    >
                      <span className="font-medium text-slate-800 dark:text-slate-200">{topic}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-indigo-500 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  setStep('input');
                  setQuestions([]);
                  setAnswers([]);
                  setScores([]);
                  setFeedbacks([]);
                }}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Re-test with new audience</span>
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSelectCoachTopic?.(`Defending against ${audience} review`);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/50 hover:bg-teal-100 dark:hover:bg-teal-900/60 transition-colors cursor-pointer"
                >
                  Explore in Coach Ladder
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
