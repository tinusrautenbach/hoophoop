'use client';

import { type PlayerGameStats, type PrimaryStatType, STAT_DISPLAY_NAMES } from '@/types/stats';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface PlayerStatsProps {
  stats: PlayerGameStats;
  enabledStats: PrimaryStatType[];
  showDerived?: boolean;
  className?: string;
}

export function PlayerStats({
  stats,
  enabledStats,
  showDerived = true,
  className,
}: PlayerStatsProps) {
  const enabledSet = new Set(enabledStats);

  const formatValue = (value: number): string => {
    return value === 0 ? '-' : value.toString();
  };

  const shouldShowStat = (statType: PrimaryStatType): boolean => {
    return enabledSet.has(statType);
  };

  return (
    <div className={cn('grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2', className)}>
      {/* Points */}
      {shouldShowStat('points_1pt' as PrimaryStatType) && (
        <div className="text-center">
          <div className="text-xs text-slate-500">{STAT_DISPLAY_NAMES['points_1pt']}</div>
          <div className="font-bold text-white">{formatValue(stats.points1pt)}</div>
        </div>
      )}
      {shouldShowStat('points_2pt' as PrimaryStatType) && (
        <div className="text-center">
          <div className="text-xs text-slate-500">{STAT_DISPLAY_NAMES['points_2pt']}</div>
          <div className="font-bold text-white">{formatValue(stats.points2pt)}</div>
        </div>
      )}
      {shouldShowStat('points_3pt' as PrimaryStatType) && (
        <div className="text-center">
          <div className="text-xs text-slate-500">{STAT_DISPLAY_NAMES['points_3pt']}</div>
          <div className="font-bold text-white">{formatValue(stats.points3pt)}</div>
        </div>
      )}
      {showDerived && (shouldShowStat('points_1pt' as PrimaryStatType) || shouldShowStat('points_2pt' as PrimaryStatType) || shouldShowStat('points_3pt' as PrimaryStatType)) && (
        <div className="text-center">
          <div className="text-xs text-slate-500">{STAT_DISPLAY_NAMES['points_total']}</div>
          <div className="font-bold text-orange-500">{stats.pointsTotal}</div>
        </div>
      )}

      {/* Rebounds */}
      {shouldShowStat('rebound_off' as PrimaryStatType) && (
        <div className="text-center">
          <div className="text-xs text-slate-500">{STAT_DISPLAY_NAMES['rebound_off']}</div>
          <div className="font-bold text-white">{formatValue(stats.reboundsOff)}</div>
        </div>
      )}
      {shouldShowStat('rebound_def' as PrimaryStatType) && (
        <div className="text-center">
          <div className="text-xs text-slate-500">{STAT_DISPLAY_NAMES['rebound_def']}</div>
          <div className="font-bold text-white">{formatValue(stats.reboundsDef)}</div>
        </div>
      )}
      {showDerived && (shouldShowStat('rebound_off' as PrimaryStatType) || shouldShowStat('rebound_def' as PrimaryStatType)) && (
        <div className="text-center">
          <div className="text-xs text-slate-500">{STAT_DISPLAY_NAMES['rebound_total']}</div>
          <div className="font-bold text-orange-500">{stats.reboundsTotal}</div>
        </div>
      )}

      {/* Other stats */}
      {shouldShowStat('assist' as PrimaryStatType) && (
        <div className="text-center">
          <div className="text-xs text-slate-500">{STAT_DISPLAY_NAMES['assist']}</div>
          <div className="font-bold text-white">{formatValue(stats.assists)}</div>
        </div>
      )}
      {shouldShowStat('steal' as PrimaryStatType) && (
        <div className="text-center">
          <div className="text-xs text-slate-500">{STAT_DISPLAY_NAMES['steal']}</div>
          <div className="font-bold text-white">{formatValue(stats.steals)}</div>
        </div>
      )}
      {shouldShowStat('block' as PrimaryStatType) && (
        <div className="text-center">
          <div className="text-xs text-slate-500">{STAT_DISPLAY_NAMES['block']}</div>
          <div className="font-bold text-white">{formatValue(stats.blocks)}</div>
        </div>
      )}
      {shouldShowStat('turnover' as PrimaryStatType) && (
        <div className="text-center">
          <div className="text-xs text-slate-500">{STAT_DISPLAY_NAMES['turnover']}</div>
          <div className="font-bold text-white">{formatValue(stats.turnovers)}</div>
        </div>
      )}
      {shouldShowStat('foul' as PrimaryStatType) && (
        <div className="text-center">
          <div className="text-xs text-slate-500">{STAT_DISPLAY_NAMES['foul']}</div>
          <div className="font-bold text-white">{formatValue(stats.fouls)}</div>
        </div>
      )}
    </div>
  );
}
