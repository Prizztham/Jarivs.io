/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  BrainCircuit,
  X,
  Send,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { Recall, SpacedRevisitQuiz } from '../types';
import { aiService } from '../services/aiService';
import { Storage } from '../utils/storage';

interface RecallModalProps {
  isOpen: boolean;
  onClose: () => void;
  recall?: Recall;
  quiz?: SpacedRevisitQuiz;
  onCompleted?: () => void;
}

export const RecallModal: React.FC<RecallModalProps> = ({
  isOpen,
  onClose,
  recall,
  quiz,
  onCompleted,
}) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [answers, setAnswers] = useState<string[]>([]);
  const [scores, setScores] = useState<number[]>([]);
  const [feedbacks, setFeedbacks] = useState<string[]>([]);
  const [step, setStep] = useState<'questions' | 'summary'>('questions');
  const [pointsClaimed, setPointsClaimed] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Normalize data between quiz or recall
  const topicName = quiz?.topicName || recall?.sessionQuestion || 'Strategic Decision';
  const domainName = quiz?.domainName || recall?.domainName || 'Growth Domain';
  const daysAgo = quiz?.daysAgoLearned ?? 3;
  const questionsList: string[] = (quiz?.questions || recall?.questions || []).map(
    (q: { question: string }) => q.question
  );
  const currentQ = questionsList[currentIdx] || '';

  const submitCurrentAnswer = async () => {
    if (!currentAnswer.trim()) return;
    setIsLoading(true);
    setErrorMessage(null);

    const result = await aiService.scoreRecall(
      currentQ,
      currentAnswer.trim(),
      topicName
    );
    setIsLoading(false);

    if (result.error || !result.data) {
      setErrorMessage(result.error || 'Evaluation timed out or failed. Please retry.');
      return;
    }

    const nextAnswers = [...answers, currentAnswer.trim()];
    const nextScores = [...scores, result.data.score];
    const nextFeedbacks = [...feedbacks, result.data.feedback];

    setAnswers(nextAnswers);
    setScores(nextScores);
    setFeedbacks(nextFeedbacks);
    setCurrentAnswer('');

    if (currentIdx + 1 < questionsList.length) {
      setCurrentIdx(currentIdx + 1);
    } else {
      // Finished all questions!
      const soundCount = nextScores.filter(s => s >= 60).length;
      const passed = soundCount >= 2;
      const points = passed ? 10 : 0;

      // Identify aspects to revisit for any questions scoring < 60
      const aspectsToRevisit: string[] = [];
      questionsList.forEach((q: string, i: number) => {
        if ((nextScores[i] || 0) < 60) {
          aspectsToRevisit.push(`Review core trade-offs on: "${q.slice(0, 60)}..."`);
        }
      });

      if (quiz) {
        const updatedQuiz: SpacedRevisitQuiz = {
          ...quiz,
          completedAt: new Date().toISOString(),
          passed,
          score: Math.round(nextScores.reduce((a, b) => a + b, 0) / nextScores.length),
          aspectsToRevisit,
          pointsAwarded: true,
          questions: quiz.questions.map((q, i) => ({
            ...q,
            userAnswer: nextAnswers[i],
            score: nextScores[i],
            feedback: nextFeedbacks[i],
            needsLook: (nextScores[i] || 0) < 60,
          })),
        };
        Storage.updateSpacedQuiz(updatedQuiz);
      } else if (recall) {
        const updatedRecall: Recall = {
          ...recall,
          completedAt: new Date().toISOString(),
          passed,
          questions: recall.questions.map((q: any, i: number) => ({
            ...q,
            userAnswer: nextAnswers[i],
            score: nextScores[i],
            feedback: nextFeedbacks[i],
          })),
        };
        Storage.updateRecall(updatedRecall);
      }

      if (points > 0 && !pointsClaimed) {
        setPointsClaimed(true);
        Storage.addPointEvent({
          id: `pt_sq_${Date.now()}`,
          type: 'spaced_quiz_completed',
          points,
          description: `Spaced revisit quiz completed (${soundCount}/3 sound reasoning)`,
          createdAt: new Date().toISOString(),
        });
      }

      Storage.logAnalyticsEvent('spaced_quiz_completed', {
        topicName,
        soundCount,
        passed,
      });

      setStep('summary');
      onCompleted?.();
    }
  };

  const soundCount = scores.filter(s => s >= 60).length;
  const isPassed = soundCount >= 2;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
            <BrainCircuit className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Spaced Revisit Quiz
              </h2>
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300">
                {domainName}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Revisiting topic learnt {daysAgo} days ago to test long-term retention.
            </p>
          </div>
        </div>

        {/* Topic reference banner */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 mb-5 text-xs text-slate-600 dark:text-slate-300">
          <span className="font-semibold text-slate-900 dark:text-white">Topic: </span>
          "{topicName}"
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={submitCurrentAnswer}
              className="px-2.5 py-1 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* STEP 1: Questions */}
        {step === 'questions' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Reasoning & Application Check</span>
              <span>
                Question {currentIdx + 1} of {questionsList.length}
              </span>
            </div>

            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-teal-600 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${((currentIdx) / questionsList.length) * 100}%` }}
              />
            </div>

            {/* Current Question */}
            <div className="p-4 rounded-xl bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200/60 dark:border-teal-800/50">
              <p className="text-sm font-semibold text-slate-900 dark:text-white leading-relaxed">
                "{currentQ}"
              </p>
            </div>

            {/* Answer Input */}
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Your Answer (Explain the reasoning, not just recall)
              </label>
              <textarea
                value={currentAnswer}
                onChange={e => setCurrentAnswer(e.target.value)}
                placeholder="Explain what principles guided your call and how you would adapt if conditions shifted..."
                rows={4}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={submitCurrentAnswer}
                disabled={!currentAnswer.trim() || isLoading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white shadow-sm transition-colors cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Evaluating reasoning...</span>
                  </>
                ) : (
                  <>
                    <span>Submit & Next</span>
                    <Send className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Summary */}
        {step === 'summary' && (
          <div className="space-y-5 text-center">
            <div
              className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl mx-auto ${
                isPassed
                  ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
              }`}
            >
              {isPassed ? <CheckCircle2 className="w-8 h-8" /> : <AlertTriangle className="w-8 h-8" />}
            </div>

            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                {soundCount}/{questionsList.length} Sound Explanations
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {isPassed
                  ? 'Successfully passed retention check! +10 points awarded.'
                  : 'Needs deeper reasoning. Review the aspects below to reinforce your grasp.'}
              </p>
            </div>

            {/* Answer breakdown */}
            <div className="space-y-2.5 text-left text-xs max-h-56 overflow-y-auto">
              {questionsList.map((q: string, idx: number) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800"
                >
                  <div className="flex items-center justify-between font-semibold text-slate-900 dark:text-white mb-1">
                    <span>Q{idx + 1}: {q}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                        (scores[idx] || 0) >= 60
                          ? 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      }`}
                    >
                      {scores[idx] || 0}/100
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 italic">
                    "{feedbacks[idx] || 'Reasoning logged.'}"
                  </p>
                </div>
              ))}
            </div>

            {/* Aspects to Revisit if any answer scored < 60 */}
            {scores.some(s => s < 60) && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-left text-xs">
                <span className="font-bold text-amber-800 dark:text-amber-300 block mb-1">
                  Aspects to Revisit:
                </span>
                <ul className="list-disc list-inside space-y-1 text-slate-700 dark:text-slate-300">
                  {questionsList.map((q: string, idx: number) => {
                    if ((scores[idx] || 0) < 60) {
                      return (
                        <li key={idx}>
                          Re-explore: {q.slice(0, 70)}...
                        </li>
                      );
                    }
                    return null;
                  })}
                </ul>
              </div>
            )}

            <div className="pt-3 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-teal-600 hover:bg-teal-700 text-white cursor-pointer"
              >
                Close & Return
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
