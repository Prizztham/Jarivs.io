/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const MOTIVATIONAL_LINES: string[] = [
  "Your first draft is your fingerprint.",
  "Speed is for tasks. Judgement is for decisions.",
  "The best question you ask today is your own.",
  "A quick take anchors your intuition before the AI speaks.",
  "Delegation without deliberation is abdication.",
  "Think first, polish second.",
  "Your mental model is the anchor; AI is the sail.",
  "Conviction isn't knowing everything—it's having weighed the premise.",
  "The agent crafts the phrasing, but you own the outcome.",
  "Thirty seconds of independent thought saves hours of defending later.",
  "Train your intuition like a muscle: test it against reality.",
  "Own the reasoning, and leadership will trust the conclusion.",
  "When you make the call yourself, your confidence is earned.",
  "The sharpest leaders know where to automate and where to deliberate."
];

export function getRandomQuote(): string {
  const index = Math.floor(Math.random() * MOTIVATIONAL_LINES.length);
  return MOTIVATIONAL_LINES[index];
}
