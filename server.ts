/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '2mb' }));

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Use gemini-3.1-flash-lite as primary high-throughput, low-congestion model
const PRIMARY_MODEL = 'gemini-3.1-flash-lite';
const FALLBACK_MODELS = ['gemini-flash-latest', 'gemini-3.8-flash'];

/**
 * Resilient generateContent helper that executes with minimal thinking latency
 * and automatically falls back to secondary models if primary encounters traffic spikes.
 */
async function generateJsonWithFallback(
  prompt: string,
  systemInstruction: string,
  temperature = 0.2
): Promise<any> {
  const modelsToTry = [PRIMARY_MODEL, ...FALLBACK_MODELS];
  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          temperature,
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        },
      });

      const text = response.text?.trim() || '{}';
      return JSON.parse(text);
    } catch (err: any) {
      console.warn(`Model ${model} failed or timed out (${err.message}), trying fallback...`);
      lastError = err;
    }
  }

  throw lastError || new Error('All models exhausted');
}

const GLOBAL_SYSTEM_INSTRUCTION = `You are Jarvis, an honest, healthy AI workspace assistant that helps users delegate work while keeping their own critical judgement sharp.
Global prompt rules:
- Be honest and specific; never flatter or patronize.
- Name specific strengths and specific gaps clearly.
- State uncertainty explicitly when assumptions are unverified.
- Keep responses concise, high-signal, and executive-ready.
- Output MUST BE VALID JSON ONLY matching the requested structure.
- Never invent URLs or fake sources; if no verified URL exists, leave url as null and provide a clean searchQuery.`;

// 1. Classic Answer (F4)
app.post('/api/gemini/classic-answer', async (req: Request, res: Response) => {
  try {
    const { question, domain } = req.body;
    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const prompt = `Domain: ${domain || 'General professional'}
Question / Task: ${question}

Provide an authoritative, clear answer while identifying key assumptions and conditions where this answer may fail.
Return JSON with this schema:
{
  "answer": "Clear, concise, high quality professional answer or memo draft (2-4 paragraphs max)",
  "confidencePct": 85,
  "assumptions": ["List 2-4 critical assumptions underlying this answer"],
  "mayBeWrongIf": ["List 2-3 specific conditions under which this recommendation fails or does not apply"]
}`;

    const parsed = await generateJsonWithFallback(prompt, GLOBAL_SYSTEM_INSTRUCTION, 0.2);
    return res.json(parsed);
  } catch (err: any) {
    console.error('Error in classic-answer:', err);
    return res.status(500).json({ error: err.message || 'Failed to generate classic answer' });
  }
});

// 2. Guided Path (F5)
app.post('/api/gemini/guided-path', async (req: Request, res: Response) => {
  try {
    const { question, domain, userLevel, timeBudget } = req.body;
    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const prompt = `Domain: ${domain || 'General'}
User Proficiency Level in this domain: ${userLevel || 'Developing'}
Time Budget: ${timeBudget || '5m'}
Question / Problem: ${question}

Construct a 5-level hint ladder and a resources panel (2 to 4 items) tailored to this user.
The 5 levels must be:
Level 1: a nudge (points attention in the right direction without giving the answer)
Level 2: a guiding question (prompts the user to consider the key tradeoff or metric)
Level 3: a framework or checklist (a 3-4 bullet structure or decision heuristic)
Level 4: a partial answer (a scaffolded outline with key sections started)
Level 5: the full answer (the complete recommended synthesis)

Return JSON with this schema:
{
  "levels": [
    { "type": "nudge", "text": "..." },
    { "type": "guiding_question", "text": "..." },
    { "type": "framework", "text": "..." },
    { "type": "partial_answer", "text": "..." },
    { "type": "full_answer", "text": "..." }
  ],
  "resources": [
    {
      "title": "Short title of real article, framework, or concept",
      "type": "concept" | "article" | "video",
      "why": "One-line reason why this will strengthen their long-term judgement",
      "searchQuery": "Recommended search terms to research this topic",
      "url": null
    }
  ]
}`;

    const parsed = await generateJsonWithFallback(prompt, GLOBAL_SYSTEM_INSTRUCTION, 0.3);
    return res.json(parsed);
  } catch (err: any) {
    console.error('Error in guided-path:', err);
    return res.status(500).json({ error: err.message || 'Failed to generate guided path' });
  }
});

// 3. Score Attempt (F3) - Anti-Gaming
app.post('/api/gemini/score-attempt', async (req: Request, res: Response) => {
  try {
    const { question, userAttempt } = req.body;
    if (!userAttempt) {
      return res.status(400).json({ error: 'User attempt is required' });
    }

    const prompt = `Original Question / Challenge:
"${question || 'Unspecified'}"

User's Attempt / First Take:
"${userAttempt}"

Strict anti-gaming rules:
- Score must strictly evaluate relevance, logic, and substance.
- If the user merely copied the question, typed random gibberish ("asdf", "lkjfsdf"), filler words ("test test test", "I don't know please tell me"), or wrote an evasive non-answer:
  "isMeaningful" MUST be false and "score" MUST be below 40 (0-39).
- If the user made a sincere, relevant attempt showing independent reasoning:
  "isMeaningful" is true, and "score" is between 40 and 100 based on clarity and depth.
- Strengths and gaps must be specific and direct. Never flatter.

Return JSON with this schema:
{
  "score": number, // 0 to 100
  "isMeaningful": boolean,
  "strengths": ["1-2 concise strengths"],
  "gaps": ["1-2 concise gaps or blindspots to address"]
}`;

    const parsed = await generateJsonWithFallback(prompt, GLOBAL_SYSTEM_INSTRUCTION, 0.1);
    return res.json(parsed);
  } catch (err: any) {
    console.error('Error in score-attempt:', err);
    return res.status(500).json({ error: err.message || 'Failed to evaluate attempt' });
  }
});

// 2b. Topic Session (PRD V2 Section 6: Coach learning session)
app.post('/api/gemini/topic-session', async (req: Request, res: Response) => {
  try {
    const { question, domain, userLevel, timeBudget } = req.body;
    if (!question) {
      return res.status(400).json({ error: 'Question / Topic is required' });
    }

    const prompt = `Domain: ${domain || 'General professional'}
User Level: ${userLevel || 'Developing'}
Time Budget: ${timeBudget || '5m'}
User Topic / Question: "${question}"

PRD V2 Requirements:
- A topic is more than one question. Build a topic session with 2-3 sequential learning questions/checkpoints (e.g. Checkpoint 1: Core Problem & Diagnosis; Checkpoint 2: Tradeoff & Edge Cases; Checkpoint 3: Execution & Long-term impact).
- Each checkpoint must have a prompt, clear evaluation criteria, a 5-level progressive hint ladder, and curated study resources.
- Within each checkpoint, hints MUST be progressive:
  Level 1 (nudge): subtle pointer in the right direction without spoiling the answer.
  Level 2 (guiding_question): prompts user to consider key tradeoff/metric.
  Level 3 (framework): 3-4 bullet checklist or structured heuristic.
  Level 4 (partial_answer): scaffolded outline.
  Level 5 (full_answer): complete authoritative synthesis.
- Provide both relevant article/official-document resources and video resources (including YouTube where available).
- NEVER invent fake URLs. Set url to a real YouTube search URL (e.g. "https://www.youtube.com/results?search_query=...") or null with clean searchQuery.

Return JSON matching this schema:
{
  "topicName": "Concise 3-5 word topic name",
  "overview": "Brief 1-2 sentence overview of why this topic matters",
  "checkpoints": [
    {
      "checkpointNumber": 1,
      "prompt": "Specific first question or scenario prompt",
      "criteria": "Key criteria to look for in the user answer",
      "hints": [
        { "type": "nudge", "text": "..." },
        { "type": "guiding_question", "text": "..." },
        { "type": "framework", "text": "..." },
        { "type": "partial_answer", "text": "..." },
        { "type": "full_answer", "text": "..." }
      ],
      "resources": [
        {
          "title": "Title of article or guide",
          "source": "e.g. Harvard Business Review or Official Docs",
          "type": "article",
          "why": "Why this strengthens judgement",
          "searchQuery": "Search query",
          "url": null
        },
        {
          "title": "Title of relevant video or lecture",
          "source": "YouTube",
          "type": "video",
          "why": "Visual walkthrough of core concept",
          "searchQuery": "YouTube search query",
          "url": "https://www.youtube.com/results?search_query=..."
        }
      ]
    }
  ]
}`;

    const parsed = await generateJsonWithFallback(prompt, GLOBAL_SYSTEM_INSTRUCTION, 0.3);
    return res.json(parsed);
  } catch (err: any) {
    console.error('Error in topic-session:', err);
    return res.status(500).json({ error: err.message || 'Failed to construct topic session' });
  }
});

// 2c. Score Checkpoint (PRD V2 Section 6: Coach score out of 10)
app.post('/api/gemini/score-checkpoint', async (req: Request, res: Response) => {
  try {
    const { checkpointPrompt, criteria, userAnswer } = req.body;
    if (!userAnswer) {
      return res.status(400).json({ error: 'User answer is required' });
    }

    const prompt = `Checkpoint Challenge:
"${checkpointPrompt}"

Evaluation Criteria:
"${criteria || 'Sound reasoning, risk awareness, and actionable insight'}"

User Answer:
"${userAnswer}"

PRD V2 Requirements:
- Assess the user's answer against clear task criteria.
- Show a transparent score out of 10 (e.g. 7 or 8.5/10).
- Do not present the score as an objective measure of general intelligence, but rather task adherence and depth.
- Identify 1-2 specific strengths and 1-2 specific gaps or blind spots.
- Be honest, direct, and constructive. Never flatter.

Return JSON matching this schema:
{
  "score": 8, // number from 0 to 10
  "strengths": ["1-2 concise strengths"],
  "gaps": ["1-2 concise areas to sharpen"],
  "feedback": "2-3 sentence honest assessment"
}`;

    const parsed = await generateJsonWithFallback(prompt, GLOBAL_SYSTEM_INSTRUCTION, 0.2);
    return res.json(parsed);
  } catch (err: any) {
    console.error('Error in score-checkpoint:', err);
    return res.status(500).json({ error: err.message || 'Failed to evaluate checkpoint answer' });
  }
});

// 4. Compare Views (F6)
app.post('/api/gemini/compare-views', async (req: Request, res: Response) => {
  try {
    const { question, userAttempt, aiAnswer } = req.body;

    const prompt = `Question:
"${question}"

User's Independent Attempt:
"${userAttempt}"

AI's Baseline Answer:
"${aiAnswer}"

Compare the two views impartially with 4 specific lists:
1. Where we agree: shared conclusions, principles, or tradeoffs.
2. Where we differ: divergent priorities, assumptions, or proposed actions.
3. What you caught that the AI missed: real nuances, context, domain instincts, or risks the user identified that the AI overlooked. If the user caught nothing extra, state plainly: ["You did not identify unique aspects beyond the baseline."].
4. What the AI caught that you missed: blindspots, edge cases, or details in the AI answer omitted by the user.
5. suggestedMerge: a cohesive synthesis marrying the user's authentic voice and context with the AI's structure.

Return JSON with this schema:
{
  "agree": ["string"],
  "differ": ["string"],
  "userCaught": ["string"],
  "aiCaught": ["string"],
  "suggestedMerge": "string"
}`;

    const parsed = await generateJsonWithFallback(prompt, GLOBAL_SYSTEM_INSTRUCTION, 0.2);
    return res.json(parsed);
  } catch (err: any) {
    console.error('Error in compare-views:', err);
    return res.status(500).json({ error: err.message || 'Failed to compare views' });
  }
});

// 5. Rehearsal Questions (F7)
app.post('/api/gemini/rehearsal-questions', async (req: Request, res: Response) => {
  try {
    const { draft, audience } = req.body;
    if (!draft) {
      return res.status(400).json({ error: 'Draft text is required' });
    }

    const prompt = `Draft / Decision / Proposal to Defend:
"${draft}"

Audience: ${audience || 'Senior leader'}

Play a skeptical, sharp reviewer representing this audience. Formulate exactly three probing questions, designed to stress-test the proposal's assumptions, ROI, risk mitigations, and execution feasibility.
Questions should not be generic; they must cite specifics from the draft.

Return JSON with this schema:
{
  "questions": [
    "First piercing question",
    "Second piercing question",
    "Third piercing question"
  ]
}`;

    const parsed = await generateJsonWithFallback(prompt, GLOBAL_SYSTEM_INSTRUCTION, 0.3);
    return res.json(parsed);
  } catch (err: any) {
    console.error('Error in rehearsal-questions:', err);
    return res.status(500).json({ error: err.message || 'Failed to generate rehearsal questions' });
  }
});

// 6. Score Rehearsal Answer (F7)
app.post('/api/gemini/score-rehearsal-answer', async (req: Request, res: Response) => {
  try {
    const { question, answer, audience } = req.body;
    if (!answer) {
      return res.status(400).json({ error: 'Answer is required' });
    }

    const prompt = `Audience Context: ${audience || 'Senior leader'}
Reviewer's Question:
"${question}"

User's Spoken / Written Defense:
"${answer}"

Evaluate the defense. Score out of 100 based on credibility, specificity, risk ownership, and clarity.
Provide brief, direct feedback (2 sentences) and either a targeted follow-up question if a vulnerability remains, or null if adequately defended.

Return JSON with this schema:
{
  "score": number, // 0 to 100
  "feedback": "Concise, honest feedback highlighting defensibility and gaps",
  "followUp": "Optional follow-up question or null"
}`;

    const parsed = await generateJsonWithFallback(prompt, GLOBAL_SYSTEM_INSTRUCTION, 0.2);
    return res.json(parsed);
  } catch (err: any) {
    console.error('Error in score-rehearsal-answer:', err);
    return res.status(500).json({ error: err.message || 'Failed to score rehearsal answer' });
  }
});

// 7. Recall Questions (F8)
app.post('/api/gemini/recall-questions', async (req: Request, res: Response) => {
  try {
    const { sessionSummary } = req.body;
    if (!sessionSummary) {
      return res.status(400).json({ error: 'Session summary is required' });
    }

    const prompt = `Yesterday's Decision / Topic:
"${sessionSummary}"

Create three short questions to test whether the user truly internalized the reasoning, tradeoffs, and application of this decision (not mere rote memory).
Include counterfactuals or scenario variations (e.g., "What would change if the budget were halved?", "How would you defend this to a skeptical stakeholder?").

Return JSON with this schema:
{
  "questions": [
    "Application question 1",
    "Counterfactual scenario question 2",
    "Tradeoff reasoning question 3"
  ]
}`;

    const parsed = await generateJsonWithFallback(prompt, GLOBAL_SYSTEM_INSTRUCTION, 0.3);
    return res.json(parsed);
  } catch (err: any) {
    console.error('Error in recall-questions:', err);
    return res.status(500).json({ error: err.message || 'Failed to generate recall questions' });
  }
});

// 8. Score Recall (F8)
app.post('/api/gemini/score-recall', async (req: Request, res: Response) => {
  try {
    const { question, answer, reference } = req.body;
    if (!answer) {
      return res.status(400).json({ error: 'Answer is required' });
    }

    const prompt = `Original Decision Reference:
"${reference || ''}"

Teach-Back Question:
"${question}"

User's Explanation:
"${answer}"

Evaluate whether the user demonstrated sound comprehension and reasoned application.
Score out of 100 (60+ is sound/correct). Provide 1-2 sentences of feedback.

Return JSON with this schema:
{
  "score": number, // 0 to 100
  "feedback": "Concise feedback on the soundness of reasoning"
}`;

    const parsed = await generateJsonWithFallback(prompt, GLOBAL_SYSTEM_INSTRUCTION, 0.2);
    return res.json(parsed);
  } catch (err: any) {
    console.error('Error in score-recall:', err);
    return res.status(500).json({ error: err.message || 'Failed to score recall' });
  }
});

// Development / Production static and SPA middleware
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Jarvis full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
