/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertCircle, Clock, ZapOff } from 'lucide-react';
import { Storage } from '../utils/storage';

interface BannerProps {
  urgentActiveUntil?: number;
  onDisableUrgent?: () => void;
}

export const Banner: React.FC<BannerProps> = ({ urgentActiveUntil, onDisableUrgent }) => {
  const isUrgent = urgentActiveUntil && urgentActiveUntil > Date.now();
  const minutesLeft = isUrgent ? Math.max(1, Math.ceil((urgentActiveUntil - Date.now()) / 60000)) : 0;

  return (
    <div className="w-full flex flex-col">
      {/* Required persistent simulated funds banner */}
      <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-700 dark:text-amber-300 px-4 py-1.5 text-xs sm:text-sm font-medium flex items-center justify-center gap-2">
        <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <span>Prototype: simulated funds, no real money.</span>
      </div>

      {/* Urgent override active banner if enabled */}
      {isUrgent && (
        <div className="bg-teal-500/15 border-b border-teal-500/30 text-teal-800 dark:text-teal-200 px-4 py-1.5 text-xs sm:text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-teal-600 dark:text-teal-400 animate-pulse" />
            <span>Urgent Override active: AI locks disabled for the next {minutesLeft} minutes (no penalties).</span>
          </div>
          {onDisableUrgent && (
            <button
              onClick={onDisableUrgent}
              className="text-xs underline hover:text-teal-900 dark:hover:text-teal-100 cursor-pointer"
            >
              Re-enable locks
            </button>
          )}
        </div>
      )}
    </div>
  );
};
