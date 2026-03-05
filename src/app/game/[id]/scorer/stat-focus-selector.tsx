'use client';

import { useState, useCallback } from 'react';
import {
  PrimaryStatType,
  STAT_FULL_NAMES,
  STAT_DISPLAY_NAMES,
} from '@/types/stats';
import { Target, Check, X } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface StatFocusSelectorProps {
  enabledStats: PrimaryStatType[];
  currentFocus: PrimaryStatType[];
  onSave: (focus: PrimaryStatType[]) => void;
  onCancel?: () => void;
  maxStats?: number;
}

export function StatFocusSelector({
  enabledStats,
  currentFocus,
  onSave,
  onCancel,
  maxStats = 3,
}: StatFocusSelectorProps) {
  const [selectedStats, setSelectedStats] = useState<PrimaryStatType[]>(currentFocus);
  const [isSaving, setIsSaving] = useState(false);

  const handleToggle = useCallback((stat: PrimaryStatType) => {
    setSelectedStats((prev) => {
      if (prev.includes(stat)) {
        return prev.filter((s) => s !== stat);
      }
      if (prev.length >= maxStats) {
        return prev;
      }
      return [...prev, stat];
    });
  }, [maxStats]);

  const handleSave = async () => {
    if (selectedStats.length === 0) return;
    setIsSaving(true);
    await onSave(selectedStats);
    setIsSaving(false);
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-orange-500" />
          <h2 className="text-xl font-bold">My Stat Focus</h2>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <p className="text-sm text-slate-400">
        Select {maxStats} stats you want as quick-access buttons. Other stats will be available via &quot;More Stats&quot;.
      </p>

      <div className="space-y-2">
        {enabledStats.map((stat) => {
          const isSelected = selectedStats.includes(stat);
          const isDisabled = !isSelected && selectedStats.length >= maxStats;

          return (
            <button
              type="button"
              key={stat}
              onClick={() => !isDisabled && handleToggle(stat)}
              disabled={isDisabled}
              className={cn(
                'w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all',
                'active:scale-[0.99]',
                isSelected
                  ? 'bg-orange-500/10 border-orange-500/50'
                  : 'bg-input border-border',
                isDisabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'w-6 h-6 rounded border-2 flex items-center justify-center transition-colors',
                    isSelected
                      ? 'bg-orange-500 border-orange-500'
                      : 'border-slate-600'
                  )}
                >
                  {isSelected && (
                    <Check className="w-4 h-4 text-white" aria-label="Selected" />
                  )}
                </div>
                <div className="text-left">
                  <div className="font-bold text-white">
                    {STAT_FULL_NAMES[stat]}
                  </div>
                  <div className="text-xs text-slate-400">
                    {STAT_DISPLAY_NAMES[stat]}
                  </div>
                </div>
              </div>
              {isSelected && (
                <span className="text-xs font-bold text-orange-500">
                  #{selectedStats.indexOf(stat) + 1}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex gap-3 pt-4 border-t border-border">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 px-4 bg-muted hover:bg-slate-700 rounded-xl font-bold transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || selectedStats.length === 0}
          className={cn(
            'flex-1 py-3 px-4 rounded-xl font-bold transition-colors',
            isSaving || selectedStats.length === 0
              ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
              : 'bg-orange-600 hover:bg-orange-700 text-white'
          )}
        >
          {isSaving ? 'Saving...' : `Save Focus (${selectedStats.length}/${maxStats})`}
        </button>
      </div>
    </div>
  );
}
