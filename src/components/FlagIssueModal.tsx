/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Flag, X, Check } from 'lucide-react';
import { FlagType } from '../types';
import { Storage } from '../utils/storage';

interface FlagIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  domainId: string;
  sessionId?: string;
  questionText?: string;
  aiSnippet?: string;
  onFlagSaved?: () => void;
}

export const FlagIssueModal: React.FC<FlagIssueModalProps> = ({
  isOpen,
  onClose,
  domainId,
  sessionId,
  questionText,
  aiSnippet,
  onFlagSaved,
}) => {
  const [selectedType, setSelectedType] = useState<FlagType>('wrong_assumption');
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);

  if (!isOpen) return null;

  const flagOptions: { type: FlagType; label: string; desc: string }[] = [
    {
      type: 'wrong_assumption',
      label: 'Wrong Assumption',
      desc: 'AI assumed incorrect constraints, resources, or premises.',
    },
    {
      type: 'missed_context',
      label: 'Missed Context',
      desc: 'Omitted organizational dynamics, unspoken rules, or past history.',
    },
    {
      type: 'wrong_fact',
      label: 'Wrong Fact',
      desc: 'Factual inaccuracy, outdated standard, or flawed claim.',
    },
    {
      type: 'tone_mismatch',
      label: 'Tone Mismatch',
      desc: 'Overly sycophantic, too academic, defensive, or robotic.',
    },
  ];

  const handleSave = () => {
    if (!note.trim()) return;

    Storage.addLogEntry({
      id: `flag_${Date.now()}`,
      domainId: domainId || 'dom_writing',
      sessionId,
      questionText,
      aiSnippet: aiSnippet?.slice(0, 150),
      type: selectedType,
      note: note.trim(),
      createdAt: new Date().toISOString(),
    });

    Storage.logAnalyticsEvent('ai_flagged', {
      type: selectedType,
      domainId,
    });

    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setNote('');
      onFlagSaved?.();
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Flag className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Flag an AI Issue</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              User-reported gaps help calibrate your judgement and train your radar.
            </p>
          </div>
        </div>

        {/* Snippet Preview if present */}
        {aiSnippet && (
          <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 italic">
            "{aiSnippet.slice(0, 160)}..."
          </div>
        )}

        {/* Flag Type Selection */}
        <div className="space-y-2 mb-4">
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
            Issue Category
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {flagOptions.map(opt => (
              <button
                key={opt.type}
                type="button"
                onClick={() => setSelectedType(opt.type)}
                className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                  selectedType === opt.type
                    ? 'border-amber-500 bg-amber-500/10 text-amber-900 dark:text-amber-200'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="text-xs font-semibold">{opt.label}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                  {opt.desc}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Note Textarea */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            What did the AI miss or get wrong?
          </label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="e.g. Assumed our client has Q3 budget when corporate freeze is in effect..."
            rows={3}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!note.trim() || saved}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white shadow-sm transition-colors cursor-pointer"
          >
            {saved ? (
              <>
                <Check className="w-4 h-4" />
                <span>Saved to AI Log</span>
              </>
            ) : (
              'Save Flag'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
