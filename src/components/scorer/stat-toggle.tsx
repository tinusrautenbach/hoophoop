'use client';

import { PrimaryStatType, STAT_FULL_NAMES, STAT_DISPLAY_NAMES } from '../../types/stats';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface StatToggleProps {
  statType: PrimaryStatType;
  enabled: boolean;
  onToggle: (statType: PrimaryStatType, enabled: boolean) => void;
  disabled?: boolean;
  hasData?: boolean;
}

export function StatToggle({
  statType,
  enabled,
  onToggle,
  disabled = false,
  hasData = false,
}: StatToggleProps) {
  const fullName = STAT_FULL_NAMES[statType];
  const abbreviation = STAT_DISPLAY_NAMES[statType];

  return (
    <button
      type="button"
      onClick={() => !disabled && onToggle(statType, !enabled)}
      disabled={disabled}
      className={cn(
        'flex items-center justify-between p-4 rounded-xl border-2 transition-all',
        'active:scale-[0.99]',
        enabled
          ? 'bg-orange-500/10 border-orange-500/50'
          : 'bg-input border-border opacity-60',
        disabled && 'cursor-not-allowed opacity-40',
        hasData && !enabled && 'border-yellow-500/50 bg-yellow-500/5'
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'w-6 h-6 rounded border-2 flex items-center justify-center transition-colors',
            enabled
              ? 'bg-orange-500 border-orange-500'
              : 'border-slate-600'
          )}
        >
          {enabled && (
            <svg
              className="w-4 h-4 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
              aria-label="Enabled"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
        </div>
        <div className="text-left">
          <div className="font-bold text-white">{fullName}</div>
          <div className="text-xs text-slate-400">{abbreviation}</div>
        </div>
      </div>
      {hasData && (
        <div className="text-xs text-yellow-500 font-medium">
          Has data
        </div>
      )}
    </button>
  );
}
