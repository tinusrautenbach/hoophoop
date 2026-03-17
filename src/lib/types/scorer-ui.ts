/**
 * UI State Types for Scorer Page UX Improvements
 */

export type PointsType = 1 | 2 | 3;

export type Team = 'home' | 'guest';

export type MutationType = 'score' | 'foul' | 'timeout' | 'sub';

export type ExpirationTrigger = 'substitution' | 'timeout' | 'period_end';

export interface LastScorerState {
  playerId: string | null;
  playerName: string | null;
  team: Team | null;
  points: PointsType | null;
  timestamp: number;
}

export interface PendingMutation {
  id: string;
  type: MutationType;
  target: string;
  startedAt: number;
}

export interface MutationFeedbackState {
  pending: Set<string>;
  lastSuccess: { type: string; timestamp: number } | null;
  lastError: { type: string; message: string } | null;
}

export type ClearTrigger = 'substitution' | 'timeout' | 'period_end' | 'team_change';