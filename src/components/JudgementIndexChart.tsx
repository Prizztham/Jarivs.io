/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { PointEvent } from '../types';
import { calculateJudgementIndex } from '../utils/rules';

interface JudgementIndexChartProps {
  pointEvents: PointEvent[];
  height?: number;
  showRangeSelector?: boolean;
}

export const JudgementIndexChart: React.FC<JudgementIndexChartProps> = ({
  pointEvents,
  height = 180,
  showRangeSelector = true,
}) => {
  const [range, setRange] = useState<'7d' | '30d' | 'all'>('30d');
  const [selectedPoint, setSelectedPoint] = useState<{
    date: string;
    index: number;
    description: string;
    points: number;
  } | null>(null);

  // Filter events by range
  const filteredEvents = useMemo(() => {
    const now = Date.now();
    const sorted = [...pointEvents].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    if (range === '7d') {
      const cutoff = now - 7 * 86400000;
      return sorted.filter(e => new Date(e.createdAt).getTime() >= cutoff);
    }
    if (range === '30d') {
      const cutoff = now - 30 * 86400000;
      return sorted.filter(e => new Date(e.createdAt).getTime() >= cutoff);
    }
    return sorted;
  }, [pointEvents, range]);

  // Compute curve points
  const chartData = useMemo(() => {
    let currentIndex = 100;
    const history: Array<{ date: string; index: number; description: string; points: number }> = [
      {
        date: 'Start',
        index: 100,
        description: 'Baseline starting Judgement Index',
        points: 0,
      },
    ];

    filteredEvents.forEach(evt => {
      currentIndex = calculateJudgementIndex(currentIndex, evt.points);
      history.push({
        date: new Date(evt.createdAt).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        }),
        index: currentIndex,
        description: evt.description,
        points: evt.points,
      });
    });

    return history;
  }, [filteredEvents]);

  const latestIndex = chartData.length > 0 ? chartData[chartData.length - 1].index : 100;
  const startIndex = chartData[0]?.index || 100;
  const delta = Math.round((latestIndex - startIndex) * 10) / 10;
  const isUp = delta >= 0;

  // Chart dimensions & coordinates
  const paddingX = 24;
  const paddingY = 20;
  const width = 500;

  const minVal = Math.min(50, ...chartData.map(d => d.index)) - 5;
  const maxVal = Math.max(110, ...chartData.map(d => d.index)) + 5;
  const rangeVal = Math.max(1, maxVal - minVal);

  const getX = (idx: number) => {
    if (chartData.length <= 1) return paddingX;
    return paddingX + (idx / (chartData.length - 1)) * (width - paddingX * 2);
  };

  const getY = (val: number) => {
    return height - paddingY - ((val - minVal) / rangeVal) * (height - paddingY * 2);
  };

  const pointsSvg = chartData.map((d, i) => `${getX(i)},${getY(d.index)}`).join(' ');

  // Gradient area requires path command 'M' followed by 'L' coordinates
  const areaSvg = chartData.length > 0
    ? `M ${getX(0)},${getY(chartData[0].index)} ${chartData.slice(1).map((d, i) => `L ${getX(i + 1)},${getY(d.index)}`).join(' ')} L ${getX(chartData.length - 1)},${height - paddingY} L ${getX(0)},${height - paddingY} Z`
    : '';

  // Colors: teal for up, muted amber for down
  const strokeColor = isUp ? '#0d9488' : '#d97706';
  const fillGradientId = isUp ? 'tealGrad' : 'amberGrad';

  return (
    <div className="w-full">
      {/* Header Info */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {latestIndex}
            </span>
            <span
              className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                isUp
                  ? 'bg-teal-500/10 text-teal-700 dark:text-teal-300'
                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
              }`}
            >
              {isUp ? `+${delta}` : delta} ({range})
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Judgement Index (Floor: 50.0)
          </p>
        </div>

        {showRangeSelector && (
          <div className="flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-600 dark:text-slate-400">
            {(['7d', '30d', 'all'] as const).map(r => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer uppercase ${
                  range === r
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
                    : 'hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* SVG Chart */}
      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible select-none"
        >
          <defs>
            <linearGradient id="tealGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0d9488" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#0d9488" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="amberGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d97706" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#d97706" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Calm horizontal grid lines */}
          {[minVal, minVal + rangeVal / 2, maxVal].map((val, idx) => (
            <line
              key={idx}
              x1={paddingX}
              y1={getY(val)}
              x2={width - paddingX}
              y2={getY(val)}
              stroke="currentColor"
              strokeDasharray="3 3"
              className="text-slate-200 dark:text-slate-800"
              strokeWidth="1"
            />
          ))}

          {/* Area under curve */}
          <path d={areaSvg} fill={`url(#${fillGradientId})`} />

          {/* Stroke line */}
          <polyline
            fill="none"
            stroke={strokeColor}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={pointsSvg}
          />

          {/* Data Points */}
          {chartData.map((d, i) => {
            const cx = getX(i);
            const cy = getY(d.index);
            const isSelected = selectedPoint?.description === d.description && selectedPoint?.index === d.index;
            return (
              <g key={i}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={isSelected ? '5' : '3.5'}
                  fill={strokeColor}
                  className="cursor-pointer hover:scale-125 transition-transform"
                  onClick={() => setSelectedPoint(d)}
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Selected event detail callout */}
      {selectedPoint && (
        <div className="mt-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs flex items-center justify-between">
          <div>
            <span className="font-semibold text-slate-900 dark:text-white">
              {selectedPoint.date}:{' '}
            </span>
            <span className="text-slate-600 dark:text-slate-300">
              {selectedPoint.description}
            </span>
          </div>
          <div className="shrink-0 font-bold ml-2">
            <span
              className={
                selectedPoint.points >= 0
                  ? 'text-teal-600 dark:text-teal-400'
                  : 'text-amber-600 dark:text-amber-400'
              }
            >
              {selectedPoint.points > 0 ? `+${selectedPoint.points}` : selectedPoint.points} pts
            </span>
            <span className="text-slate-400 font-normal ml-1">
              ({selectedPoint.index} JI)
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
