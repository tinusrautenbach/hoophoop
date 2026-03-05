'use client';

import { useState, useCallback } from 'react';
import {
  PrimaryStatType,
  ALL_PRIMARY_STATS,
  type GameStatConfig,
  STAT_CATEGORIES,
} from '@/types/stats';
import { StatToggle } from '@/components/scorer/stat-toggle';
import { X, Settings, AlertTriangle } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface StatConfigPanelProps {
  gameId: string;
  initialConfig?: GameStatConfig;
  onSave?: (config: GameStatConfig) => void;
  onCancel?: () => void;
  isOwner: boolean;
}

export function StatConfigPanel({
  gameId,
  initialConfig,
  onSave,
  onCancel,
  isOwner,
}: StatConfigPanelProps) {
  const [enabledStats, setEnabledStats] = useState<PrimaryStatType[]>(
    initialConfig?.enabledStats || [
      PrimaryStatType.POINTS_2PT,
      PrimaryStatType.POINTS_3PT,
      PrimaryStatType.ASSIST,
    ]
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWarning, setShowWarning] = useState(false);

  const handleToggle = useCallback((statType: PrimaryStatType, enabled: boolean) => {
    if (!isOwner) return;

    setEnabledStats((prev) => {
      if (enabled) {
        return [...prev, statType];
      } else {
        return prev.filter((s) => s !== statType);
      }
    });
    setError(null);
  }, [isOwner]);

  const handleSave = async () => {
    if (!isOwner) return;

    if (enabledStats.length === 0) {
      setError('At least one stat must be enabled');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/games/${gameId}/stat-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabledStats,
          allowCustomization: true,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || data.details?.[0] || 'Failed to save');
      }

      const config = await response.json();
      onSave?.(config);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const getCategoryStats = (category: keyof typeof STAT_CATEGORIES): PrimaryStatType[] => {
    const cats = STAT_CATEGORIES[category] as readonly PrimaryStatType[];
    return cats.filter((stat) => ALL_PRIMARY_STATS.includes(stat));
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-orange-500" />
          <h2 className="text-xl font-bold">Statistics Configuration</h2>
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

      {!isOwner && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-500" />
          <span className="text-sm text-yellow-500">
            Only the game owner can modify stat configuration
          </span>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-500">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">
            Scoring
          </h3>
          <div className="grid gap-2">
            {getCategoryStats('SCORING').map((stat) => (
              <StatToggle
                key={stat}
                statType={stat}
                enabled={enabledStats.includes(stat)}
                onToggle={handleToggle}
                disabled={!isOwner}
              />
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">
            Rebounds
          </h3>
          <div className="grid gap-2">
            {getCategoryStats('REBOUNDING').map((stat) => (
              <StatToggle
                key={stat}
                statType={stat}
                enabled={enabledStats.includes(stat)}
                onToggle={handleToggle}
                disabled={!isOwner}
              />
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">
            Defense
          </h3>
          <div className="grid gap-2">
            {getCategoryStats('DEFENSE').map((stat) => (
              <StatToggle
                key={stat}
                statType={stat}
                enabled={enabledStats.includes(stat)}
                onToggle={handleToggle}
                disabled={!isOwner}
              />
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">
            Playmaking
          </h3>
          <div className="grid gap-2">
            {getCategoryStats('PLAYMAKING').map((stat) => (
              <StatToggle
                key={stat}
                statType={stat}
                enabled={enabledStats.includes(stat)}
                onToggle={handleToggle}
                disabled={!isOwner}
              />
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">
            Other
          </h3>
          <div className="grid gap-2">
            {getCategoryStats('OTHER').map((stat) => (
              <StatToggle
                key={stat}
                statType={stat}
                enabled={enabledStats.includes(stat)}
                onToggle={handleToggle}
                disabled={!isOwner}
              />
            ))}
          </div>
        </div>
      </div>

      {isOwner && (
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
            disabled={isSaving || enabledStats.length === 0}
            className={cn(
              'flex-1 py-3 px-4 rounded-xl font-bold transition-colors',
              isSaving || enabledStats.length === 0
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-orange-600 hover:bg-orange-700 text-white'
            )}
          >
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      )}
    </div>
  );
}
