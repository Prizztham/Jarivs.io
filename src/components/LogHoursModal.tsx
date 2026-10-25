/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Clock, X, Check } from 'lucide-react';
import { Storage } from '../utils/storage';

interface LogHoursModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const LogHoursModal: React.FC<LogHoursModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const [hours, setHours] = useState(2.0);
  const [type, setType] = useState<'manual_hours' | 'independent_draft' | 'topic_learned'>('manual_hours');
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    Storage.addTrackerEntry({
      id: `tr_${Date.now()}`,
      type,
      count: hours,
      note: note.trim() || undefined,
      createdAt: new Date().toISOString(),
    });

    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setNote('');
      onSaved();
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 relative space-y-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Log AI-Free Deliberation Time
            </h3>
            <p className="text-xs text-slate-500">
              Track offline whiteboarding, drafting, or customer synthesis.
            </p>
          </div>
        </div>

        {/* Activity Type */}
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Activity Type
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'manual_hours', label: 'Manual Hours' },
              { id: 'independent_draft', label: 'Draft Started' },
              { id: 'topic_learned', label: 'Topic Studied' },
            ].map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setType(t.id as any)}
                className={`p-2 rounded-lg text-xs font-semibold border text-center transition-all cursor-pointer ${
                  type === t.id
                    ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Hours / Count Slider */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-semibold">
            <span>{type === 'manual_hours' ? 'Hours Dedicated' : 'Count'}</span>
            <span className="text-teal-600 font-bold">{hours} {type === 'manual_hours' ? 'hrs' : ''}</span>
          </div>
          <input
            type="range"
            min={type === 'manual_hours' ? '0.5' : '1'}
            max={type === 'manual_hours' ? '8.0' : '5'}
            step={type === 'manual_hours' ? '0.5' : '1'}
            value={hours}
            onChange={e => setHours(Number(e.target.value))}
            className="w-full accent-teal-600 cursor-pointer"
          />
        </div>

        {/* Note */}
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            What were you thinking through? (Optional note)
          </label>
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="e.g. Whiteboarding system tradeoffs without AI..."
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white cursor-pointer"
          >
            {saved ? <Check className="w-4 h-4" /> : 'Log Entry'}
          </button>
        </div>
      </div>
    </div>
  );
};
