/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AudienceType,
  ClassicAnswerData,
  CompareViewsData,
  GuidedPathData,
  TimeBudget,
  TopicSessionData,
} from '../types';

const TIMEOUT_MS = 25000;

export interface ScoreCheckpointResult {
  score: number;
  strengths: string[];
  gaps: string[];
  feedback: string;
}

export interface ScoreAttemptResult {
  score: number;
  isMeaningful: boolean;
  strengths: string[];
  gaps: string[];
}

export interface RehearsalQuestionsResult {
  questions: string[];
}

export interface ScoreRehearsalAnswerResult {
  score: number;
  feedback: string;
  followUp: string | null;
}

export interface RecallQuestionsResult {
  questions: string[];
}

export interface ScoreRecallResult {
  score: number;
  feedback: string;
}

export interface ServiceResult<T> {
  data: T | null;
  error: string | null;
  isTimeout: boolean;
}

async function postWithTimeout<T>(endpoint: string, body: any): Promise<ServiceResult<T>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort('Request timed out after 15 seconds');
  }, TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      return {
        data: null,
        error: errJson.error || `Server responded with status ${response.status}`,
        isTimeout: false,
      };
    }

    const data = await response.json();
    return { data, error: null, isTimeout: false };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const isTimeout = err?.name === 'AbortError' || String(err).includes('timed out');
    return {
      data: null,
      error: isTimeout
        ? 'AI generation exceeded 15 seconds. Please retry.'
        : (err.message || 'Network request failed'),
      isTimeout,
    };
  }
}

export const aiService = {
  // F4: Classic Answer
  async classicAnswer(question: string, domain: string): Promise<ServiceResult<ClassicAnswerData>> {
    return postWithTimeout<ClassicAnswerData>('/api/gemini/classic-answer', { question, domain });
  },

  // F5: Guided Path
  async guidedPath(
    question: string,
    domain: string,
    userLevel: string,
    timeBudget: TimeBudget
  ): Promise<ServiceResult<GuidedPathData>> {
    return postWithTimeout<GuidedPathData>('/api/gemini/guided-path', {
      question,
      domain,
      userLevel,
      timeBudget,
    });
  },

  // F3: Score Attempt
  async scoreAttempt(question: string, userAttempt: string): Promise<ServiceResult<ScoreAttemptResult>> {
    return postWithTimeout<ScoreAttemptResult>('/api/gemini/score-attempt', { question, userAttempt });
  },

  // F6: Compare Views
  async compareViews(
    question: string,
    userAttempt: string,
    aiAnswer: string
  ): Promise<ServiceResult<CompareViewsData>> {
    return postWithTimeout<CompareViewsData>('/api/gemini/compare-views', {
      question,
      userAttempt,
      aiAnswer,
    });
  },

  // F7: Rehearsal Questions
  async rehearsalQuestions(draft: string, audience: AudienceType): Promise<ServiceResult<RehearsalQuestionsResult>> {
    return postWithTimeout<RehearsalQuestionsResult>('/api/gemini/rehearsal-questions', { draft, audience });
  },

  // F7: Score Rehearsal Answer
  async scoreRehearsalAnswer(
    question: string,
    answer: string,
    audience: AudienceType
  ): Promise<ServiceResult<ScoreRehearsalAnswerResult>> {
    return postWithTimeout<ScoreRehearsalAnswerResult>('/api/gemini/score-rehearsal-answer', {
      question,
      answer,
      audience,
    });
  },

  // F8: Recall Questions
  async recallQuestions(sessionSummary: string): Promise<ServiceResult<RecallQuestionsResult>> {
    return postWithTimeout<RecallQuestionsResult>('/api/gemini/recall-questions', { sessionSummary });
  },

  // F8: Score Recall
  async scoreRecall(
    question: string,
    answer: string,
    reference: string
  ): Promise<ServiceResult<ScoreRecallResult>> {
    return postWithTimeout<ScoreRecallResult>('/api/gemini/score-recall', { question, answer, reference });
  },

  // PRD V2 Section 6: Coach Topic Session
  async topicSession(
    question: string,
    domain: string,
    userLevel: string,
    timeBudget: TimeBudget
  ): Promise<ServiceResult<TopicSessionData>> {
    return postWithTimeout<TopicSessionData>('/api/gemini/topic-session', {
      question,
      domain,
      userLevel,
      timeBudget,
    });
  },

  // PRD V2 Section 6: Score Checkpoint Answer
  async scoreCheckpoint(
    checkpointPrompt: string,
    criteria: string,
    userAnswer: string
  ): Promise<ServiceResult<ScoreCheckpointResult>> {
    return postWithTimeout<ScoreCheckpointResult>('/api/gemini/score-checkpoint', {
      checkpointPrompt,
      criteria,
      userAnswer,
    });
  },
};
