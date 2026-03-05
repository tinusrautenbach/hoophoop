import { describe, it, expect } from 'vitest';
import {
  createInitialPlayerStats,
  aggregateStatEvent,
  reverseStatEvent,
  aggregateAllPlayerStats,
  getTeamTotals,
  filterEventsByStatType,
  getUniqueStatTypes,
} from '../stat-aggregator';
import { PrimaryStatType, type PlayerStatEvent } from '../../../types/stats';

describe('stat-aggregator', () => {
  const mockGameId = 'game-123';

  describe('createInitialPlayerStats', () => {
    it('should create initial stats with all zeros', () => {
      const stats = createInitialPlayerStats('player-1', mockGameId, 'home');

      expect(stats.playerId).toBe('player-1');
      expect(stats.gameId).toBe(mockGameId);
      expect(stats.team).toBe('home');
      expect(stats.points1pt).toBe(0);
      expect(stats.points2pt).toBe(0);
      expect(stats.points3pt).toBe(0);
      expect(stats.reboundsOff).toBe(0);
      expect(stats.reboundsDef).toBe(0);
      expect(stats.assists).toBe(0);
      expect(stats.steals).toBe(0);
      expect(stats.blocks).toBe(0);
      expect(stats.turnovers).toBe(0);
      expect(stats.fouls).toBe(0);
      expect(stats.pointsTotal).toBe(0);
      expect(stats.reboundsTotal).toBe(0);
    });
  });

  describe('aggregateStatEvent', () => {
    it('should aggregate points_1pt correctly', () => {
      const initial = createInitialPlayerStats('player-1', mockGameId, 'home');
      const event: PlayerStatEvent = {
        id: 'event-1',
        gameId: mockGameId,
        playerId: 'player-1',
        team: 'home',
        type: 'stat',
        statType: PrimaryStatType.POINTS_1PT,
        value: 2,
        period: 1,
        clockAt: 600,
        createdAt: new Date(),
        version: 1,
      };

      const result = aggregateStatEvent(initial, event);

      expect(result.points1pt).toBe(2);
      expect(result.pointsTotal).toBe(2);
    });

    it('should aggregate points_2pt correctly', () => {
      const initial = createInitialPlayerStats('player-1', mockGameId, 'home');
      const event: PlayerStatEvent = {
        id: 'event-1',
        gameId: mockGameId,
        playerId: 'player-1',
        team: 'home',
        type: 'stat',
        statType: PrimaryStatType.POINTS_2PT,
        value: 3,
        period: 1,
        clockAt: 600,
        createdAt: new Date(),
        version: 1,
      };

      const result = aggregateStatEvent(initial, event);

      expect(result.points2pt).toBe(3);
      expect(result.pointsTotal).toBe(6);
    });

    it('should aggregate points_3pt correctly', () => {
      const initial = createInitialPlayerStats('player-1', mockGameId, 'home');
      const event: PlayerStatEvent = {
        id: 'event-1',
        gameId: mockGameId,
        playerId: 'player-1',
        team: 'home',
        type: 'stat',
        statType: PrimaryStatType.POINTS_3PT,
        value: 2,
        period: 1,
        clockAt: 600,
        createdAt: new Date(),
        version: 1,
      };

      const result = aggregateStatEvent(initial, event);

      expect(result.points3pt).toBe(2);
      expect(result.pointsTotal).toBe(6);
    });

    it('should aggregate rebounds correctly', () => {
      const initial = createInitialPlayerStats('player-1', mockGameId, 'home');
      const event1: PlayerStatEvent = {
        id: 'event-1',
        gameId: mockGameId,
        playerId: 'player-1',
        team: 'home',
        type: 'stat',
        statType: PrimaryStatType.REBOUND_OFF,
        value: 3,
        period: 1,
        clockAt: 600,
        createdAt: new Date(),
        version: 1,
      };
      const event2: PlayerStatEvent = {
        id: 'event-2',
        gameId: mockGameId,
        playerId: 'player-1',
        team: 'home',
        type: 'stat',
        statType: PrimaryStatType.REBOUND_DEF,
        value: 2,
        period: 1,
        clockAt: 600,
        createdAt: new Date(),
        version: 1,
      };

      let result = aggregateStatEvent(initial, event1);
      result = aggregateStatEvent(result, event2);

      expect(result.reboundsOff).toBe(3);
      expect(result.reboundsDef).toBe(2);
      expect(result.reboundsTotal).toBe(5);
    });

    it('should aggregate other stats correctly', () => {
      const initial = createInitialPlayerStats('player-1', mockGameId, 'home');
      const events: PlayerStatEvent[] = [
        {
          id: 'event-1',
          gameId: mockGameId,
          playerId: 'player-1',
          team: 'home',
          type: 'stat',
          statType: PrimaryStatType.ASSIST,
          value: 4,
          period: 1,
          clockAt: 600,
          createdAt: new Date(),
          version: 1,
        },
        {
          id: 'event-2',
          gameId: mockGameId,
          playerId: 'player-1',
          team: 'home',
          type: 'stat',
          statType: PrimaryStatType.STEAL,
          value: 2,
          period: 1,
          clockAt: 600,
          createdAt: new Date(),
          version: 1,
        },
        {
          id: 'event-3',
          gameId: mockGameId,
          playerId: 'player-1',
          team: 'home',
          type: 'stat',
          statType: PrimaryStatType.BLOCK,
          value: 1,
          period: 1,
          clockAt: 600,
          createdAt: new Date(),
          version: 1,
        },
        {
          id: 'event-4',
          gameId: mockGameId,
          playerId: 'player-1',
          team: 'home',
          type: 'stat',
          statType: PrimaryStatType.TURNOVER,
          value: 3,
          period: 1,
          clockAt: 600,
          createdAt: new Date(),
          version: 1,
        },
        {
          id: 'event-5',
          gameId: mockGameId,
          playerId: 'player-1',
          team: 'home',
          type: 'stat',
          statType: PrimaryStatType.FOUL,
          value: 2,
          period: 1,
          clockAt: 600,
          createdAt: new Date(),
          version: 1,
        },
      ];

      let result = initial;
      for (const event of events) {
        result = aggregateStatEvent(result, event);
      }

      expect(result.assists).toBe(4);
      expect(result.steals).toBe(2);
      expect(result.blocks).toBe(1);
      expect(result.turnovers).toBe(3);
      expect(result.fouls).toBe(2);
    });
  });

  describe('reverseStatEvent', () => {
    it('should reverse a stat event correctly', () => {
      const initial = createInitialPlayerStats('player-1', mockGameId, 'home');
      const event: PlayerStatEvent = {
        id: 'event-1',
        gameId: mockGameId,
        playerId: 'player-1',
        team: 'home',
        type: 'stat',
        statType: PrimaryStatType.POINTS_2PT,
        value: 2,
        period: 1,
        clockAt: 600,
        createdAt: new Date(),
        version: 1,
      };

      let result = aggregateStatEvent(initial, event);
      expect(result.points2pt).toBe(2);

      result = reverseStatEvent(result, event);
      expect(result.points2pt).toBe(0);
      expect(result.pointsTotal).toBe(0);
    });

    it('should not go below zero when reversing', () => {
      const initial = createInitialPlayerStats('player-1', mockGameId, 'home');
      const event: PlayerStatEvent = {
        id: 'event-1',
        gameId: mockGameId,
        playerId: 'player-1',
        team: 'home',
        type: 'stat',
        statType: PrimaryStatType.ASSIST,
        value: 5,
        period: 1,
        clockAt: 600,
        createdAt: new Date(),
        version: 1,
      };

      const result = reverseStatEvent(initial, event);
      expect(result.assists).toBe(0);
    });
  });

  describe('aggregateAllPlayerStats', () => {
    it('should aggregate stats for multiple players', () => {
      const events: PlayerStatEvent[] = [
        {
          id: 'event-1',
          gameId: mockGameId,
          playerId: 'player-1',
          team: 'home',
          type: 'stat',
          statType: PrimaryStatType.POINTS_2PT,
          value: 2,
          period: 1,
          clockAt: 600,
          createdAt: new Date(),
          version: 1,
        },
        {
          id: 'event-2',
          gameId: mockGameId,
          playerId: 'player-2',
          team: 'guest',
          type: 'stat',
          statType: PrimaryStatType.POINTS_3PT,
          value: 1,
          period: 1,
          clockAt: 600,
          createdAt: new Date(),
          version: 1,
        },
      ];

      const result = aggregateAllPlayerStats(events, mockGameId);

      expect(result.size).toBe(2);
      expect(result.get('player-1')?.points2pt).toBe(2);
      expect(result.get('player-2')?.points3pt).toBe(1);
    });

    it('should return empty map for no events', () => {
      const result = aggregateAllPlayerStats([], mockGameId);
      expect(result.size).toBe(0);
    });

    it('should filter out non-stat events', () => {
      const events: PlayerStatEvent[] = [
        {
          id: 'event-1',
          gameId: mockGameId,
          playerId: 'player-1',
          team: 'home',
          type: 'stat',
          statType: undefined as unknown as PrimaryStatType,
          value: 1,
          period: 1,
          clockAt: 600,
          createdAt: new Date(),
          version: 1,
        },
      ];

      const result = aggregateAllPlayerStats(events, mockGameId);
      expect(result.size).toBe(0);
    });
  });

  describe('getTeamTotals', () => {
    it('should calculate team totals correctly', () => {
      const playerStats = [
        createInitialPlayerStats('player-1', mockGameId, 'home'),
        createInitialPlayerStats('player-2', mockGameId, 'home'),
      ];

      // Manually set some stats
      playerStats[0].points2pt = 2;
      playerStats[0].pointsTotal = 4;
      playerStats[0].reboundsOff = 3;
      playerStats[0].reboundsTotal = 5;
      playerStats[0].assists = 2;

      playerStats[1].points2pt = 3;
      playerStats[1].pointsTotal = 6;
      playerStats[1].reboundsDef = 2;
      playerStats[1].reboundsTotal = 2;
      playerStats[1].assists = 4;

      const totals = getTeamTotals(playerStats);

      expect(totals.points2pt).toBe(5);
      expect(totals.pointsTotal).toBe(10);
      expect(totals.reboundsTotal).toBe(7);
      expect(totals.assists).toBe(6);
    });

    it('should handle empty array', () => {
      const totals = getTeamTotals([]);
      expect(totals.pointsTotal).toBe(0);
      expect(totals.reboundsTotal).toBe(0);
    });
  });

  describe('filterEventsByStatType', () => {
    it('should filter events by stat type', () => {
      const events: PlayerStatEvent[] = [
        {
          id: 'event-1',
          gameId: mockGameId,
          playerId: 'player-1',
          team: 'home',
          type: 'stat',
          statType: PrimaryStatType.POINTS_2PT,
          value: 1,
          period: 1,
          clockAt: 600,
          createdAt: new Date(),
          version: 1,
        },
        {
          id: 'event-2',
          gameId: mockGameId,
          playerId: 'player-1',
          team: 'home',
          type: 'stat',
          statType: PrimaryStatType.ASSIST,
          value: 1,
          period: 1,
          clockAt: 600,
          createdAt: new Date(),
          version: 1,
        },
      ];

      const result = filterEventsByStatType(events, PrimaryStatType.ASSIST);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('event-2');
    });
  });

  describe('getUniqueStatTypes', () => {
    it('should return unique stat types', () => {
      const events: PlayerStatEvent[] = [
        {
          id: 'event-1',
          gameId: mockGameId,
          playerId: 'player-1',
          team: 'home',
          type: 'stat',
          statType: PrimaryStatType.POINTS_2PT,
          value: 1,
          period: 1,
          clockAt: 600,
          createdAt: new Date(),
          version: 1,
        },
        {
          id: 'event-2',
          gameId: mockGameId,
          playerId: 'player-1',
          team: 'home',
          type: 'stat',
          statType: PrimaryStatType.POINTS_2PT,
          value: 1,
          period: 1,
          clockAt: 600,
          createdAt: new Date(),
          version: 1,
        },
        {
          id: 'event-3',
          gameId: mockGameId,
          playerId: 'player-1',
          team: 'home',
          type: 'stat',
          statType: PrimaryStatType.ASSIST,
          value: 1,
          period: 1,
          clockAt: 600,
          createdAt: new Date(),
          version: 1,
        },
      ];

      const result = getUniqueStatTypes(events);

      expect(result).toHaveLength(2);
      expect(result).toContain(PrimaryStatType.POINTS_2PT);
      expect(result).toContain(PrimaryStatType.ASSIST);
    });
  });
});
