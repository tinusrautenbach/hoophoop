import { describe, it, expect } from 'vitest';
import {
  calculatePointsTotal,
  calculateReboundsTotal,
  calculateDerivedStats,
  getDerivedStatsToCalculate,
  shouldShowDerivedStat,
  getDerivedStatComponents,
  formatStatValue,
  getStatAbbreviation,
} from '../stat-calculator';
import {
  PrimaryStatType,
  DerivedStatType,
} from '../../../types/stats';

describe('stat-calculator', () => {
  describe('calculatePointsTotal', () => {
    it('should calculate total points correctly', () => {
      expect(calculatePointsTotal(2, 3, 1)).toBe(11);
    });

    it('should return 0 when no points scored', () => {
      expect(calculatePointsTotal(0, 0, 0)).toBe(0);
    });

    it('should handle only free throws', () => {
      expect(calculatePointsTotal(5, 0, 0)).toBe(5);
    });

    it('should handle only 2-pointers', () => {
      expect(calculatePointsTotal(0, 4, 0)).toBe(8);
    });

    it('should handle only 3-pointers', () => {
      expect(calculatePointsTotal(0, 0, 3)).toBe(9);
    });
  });

  describe('calculateReboundsTotal', () => {
    it('should calculate total rebounds correctly', () => {
      expect(calculateReboundsTotal(5, 3)).toBe(8);
    });

    it('should return 0 when no rebounds', () => {
      expect(calculateReboundsTotal(0, 0)).toBe(0);
    });

    it('should handle only offensive rebounds', () => {
      expect(calculateReboundsTotal(7, 0)).toBe(7);
    });

    it('should handle only defensive rebounds', () => {
      expect(calculateReboundsTotal(0, 6)).toBe(6);
    });
  });

  describe('calculateDerivedStats', () => {
    it('should calculate all derived stats', () => {
      const input = {
        playerId: 'player-1',
        gameId: 'game-1',
        team: 'home' as const,
        points1pt: 2,
        points2pt: 3,
        points3pt: 1,
        reboundsOff: 4,
        reboundsDef: 5,
        assists: 3,
        steals: 2,
        blocks: 1,
        turnovers: 2,
        fouls: 3,
        lastUpdated: new Date(),
      };

      const result = calculateDerivedStats(input);

      expect(result.pointsTotal).toBe(11); // 2*1 + 3*2 + 1*3
      expect(result.reboundsTotal).toBe(9); // 4 + 5
    });
  });

  describe('getDerivedStatsToCalculate', () => {
    it('should return points_total when any point stat is enabled', () => {
      const enabledStats = [PrimaryStatType.POINTS_2PT];
      const result = getDerivedStatsToCalculate(enabledStats);
      expect(result).toContain(DerivedStatType.POINTS_TOTAL);
    });

    it('should return rebounds_total when any rebound stat is enabled', () => {
      const enabledStats = [PrimaryStatType.REBOUND_OFF];
      const result = getDerivedStatsToCalculate(enabledStats);
      expect(result).toContain(DerivedStatType.REBOUND_TOTAL);
    });

    it('should return both when both categories are enabled', () => {
      const enabledStats = [PrimaryStatType.POINTS_2PT, PrimaryStatType.REBOUND_DEF];
      const result = getDerivedStatsToCalculate(enabledStats);
      expect(result).toContain(DerivedStatType.POINTS_TOTAL);
      expect(result).toContain(DerivedStatType.REBOUND_TOTAL);
    });

    it('should return empty array when no relevant stats enabled', () => {
      const enabledStats = [PrimaryStatType.ASSIST, PrimaryStatType.STEAL];
      const result = getDerivedStatsToCalculate(enabledStats);
      expect(result).toHaveLength(0);
    });
  });

  describe('shouldShowDerivedStat', () => {
    it('should show points_total when point stats are enabled', () => {
      const enabledStats = [PrimaryStatType.POINTS_2PT];
      expect(shouldShowDerivedStat(DerivedStatType.POINTS_TOTAL, enabledStats)).toBe(true);
    });

    it('should show rebounds_total when rebound stats are enabled', () => {
      const enabledStats = [PrimaryStatType.REBOUND_OFF];
      expect(shouldShowDerivedStat(DerivedStatType.REBOUND_TOTAL, enabledStats)).toBe(true);
    });

    it('should not show points_total when no point stats enabled', () => {
      const enabledStats = [PrimaryStatType.ASSIST];
      expect(shouldShowDerivedStat(DerivedStatType.POINTS_TOTAL, enabledStats)).toBe(false);
    });

    it('should not show rebounds_total when no rebound stats enabled', () => {
      const enabledStats = [PrimaryStatType.STEAL];
      expect(shouldShowDerivedStat(DerivedStatType.REBOUND_TOTAL, enabledStats)).toBe(false);
    });
  });

  describe('getDerivedStatComponents', () => {
    it('should return point stats for points_total', () => {
      const result = getDerivedStatComponents(DerivedStatType.POINTS_TOTAL);
      expect(result).toContain(PrimaryStatType.POINTS_1PT);
      expect(result).toContain(PrimaryStatType.POINTS_2PT);
      expect(result).toContain(PrimaryStatType.POINTS_3PT);
    });

    it('should return rebound stats for rebounds_total', () => {
      const result = getDerivedStatComponents(DerivedStatType.REBOUND_TOTAL);
      expect(result).toContain(PrimaryStatType.REBOUND_OFF);
      expect(result).toContain(PrimaryStatType.REBOUND_DEF);
    });
  });

  describe('formatStatValue', () => {
    it('should return empty string for zero', () => {
      expect(formatStatValue(0)).toBe('');
    });

    it('should return number as string for non-zero', () => {
      expect(formatStatValue(5)).toBe('5');
      expect(formatStatValue(12)).toBe('12');
    });
  });

  describe('getStatAbbreviation', () => {
    it('should return correct abbreviations', () => {
      expect(getStatAbbreviation(PrimaryStatType.POINTS_1PT)).toBe('FT');
      expect(getStatAbbreviation(PrimaryStatType.POINTS_2PT)).toBe('2PT');
      expect(getStatAbbreviation(PrimaryStatType.POINTS_3PT)).toBe('3PT');
      expect(getStatAbbreviation(PrimaryStatType.ASSIST)).toBe('AST');
      expect(getStatAbbreviation(DerivedStatType.POINTS_TOTAL)).toBe('PTS');
    });
  });
});
