import { describe, it, expect } from 'vitest';
import {
  validateEnabledStats,
  validateScorerFocus,
  isValidPrimaryStatType,
  getDefaultStatFocus,
  createDefaultGameStatConfig,
  DEFAULT_ENABLED_STATS,
} from '../../lib/stats/stat-types';
import {
  PrimaryStatType,
} from '../../types/stats';

describe('stat-types', () => {
  describe('validateEnabledStats', () => {
    it('should validate valid stat array', () => {
      const result = validateEnabledStats(['points_2pt', 'points_3pt', 'assist']);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty array', () => {
      const result = validateEnabledStats([]);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('At least one stat must be enabled');
    });

    it('should reject invalid stat types', () => {
      const result = validateEnabledStats(['points_2pt', 'invalid_stat']);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid stat types');
    });

    it('should reject duplicate stats', () => {
      const result = validateEnabledStats(['points_2pt', 'points_2pt']);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Duplicate stats are not allowed');
    });
  });

  describe('validateScorerFocus', () => {
    const enabledStats = [PrimaryStatType.POINTS_2PT, PrimaryStatType.POINTS_3PT, PrimaryStatType.ASSIST];

    it('should validate valid focus (1-3 stats)', () => {
      const result = validateScorerFocus(['points_2pt', 'assist'], enabledStats);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty focus', () => {
      const result = validateScorerFocus([], enabledStats);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Stat focus must contain 1-3 stats');
    });

    it('should reject more than 3 stats', () => {
      const result = validateScorerFocus(
        ['points_1pt', 'points_2pt', 'points_3pt', 'assist'],
        [PrimaryStatType.POINTS_1PT, PrimaryStatType.POINTS_2PT, PrimaryStatType.POINTS_3PT, PrimaryStatType.ASSIST]
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Stat focus must contain 1-3 stats');
    });

    it('should reject disabled stats', () => {
      const result = validateScorerFocus(['points_2pt', 'steal'], enabledStats);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Stats not enabled for this game');
    });

    it('should reject duplicate stats in focus', () => {
      const result = validateScorerFocus(['points_2pt', 'points_2pt'], enabledStats);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Duplicate stats are not allowed in focus');
    });
  });

  describe('isValidPrimaryStatType', () => {
    it('should return true for valid stats', () => {
      expect(isValidPrimaryStatType('points_2pt')).toBe(true);
      expect(isValidPrimaryStatType('assist')).toBe(true);
    });

    it('should return false for invalid stats', () => {
      expect(isValidPrimaryStatType('invalid')).toBe(false);
      expect(isValidPrimaryStatType('')).toBe(false);
    });
  });

  describe('getDefaultStatFocus', () => {
    it('should return first 3 enabled stats', () => {
      const stats = [
        PrimaryStatType.POINTS_2PT,
        PrimaryStatType.POINTS_3PT,
        PrimaryStatType.ASSIST,
        PrimaryStatType.STEAL,
      ];
      const result = getDefaultStatFocus(stats);
      expect(result).toHaveLength(3);
      expect(result).toEqual([
        PrimaryStatType.POINTS_2PT,
        PrimaryStatType.POINTS_3PT,
        PrimaryStatType.ASSIST,
      ]);
    });

    it('should return fewer if less than 3 available', () => {
      const stats = [PrimaryStatType.POINTS_2PT, PrimaryStatType.ASSIST];
      const result = getDefaultStatFocus(stats);
      expect(result).toHaveLength(2);
    });
  });

  describe('createDefaultGameStatConfig', () => {
    it('should create config with default values', () => {
      const config = createDefaultGameStatConfig('game-123', 'user-456');
      expect(config.gameId).toBe('game-123');
      expect(config.enabledStats).toEqual(DEFAULT_ENABLED_STATS);
      expect(config.allowCustomization).toBe(true);
      expect(config.trackFullHistory).toBe(false);
      expect(config.createdBy).toBe('user-456');
    });
  });
});
