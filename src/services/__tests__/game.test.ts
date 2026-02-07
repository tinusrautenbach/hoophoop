import { describe, it, expect } from 'vitest';
import { calculateScore, GameState } from '../game';

describe('Game Service', () => {
    it('should correctly add 2 points to home team', () => {
        const initialState: GameState = {
            homeScore: 10,
            guestScore: 10,
            homeFouls: 0,
            guestFouls: 0,
            homeTeamName: 'Home',
            guestTeamName: 'Guest',
            status: 'live',
            currentPeriod: 1,
            clockSeconds: 600,
            possession: 'home',
            id: 'test',
            createdAt: new Date(),
            updatedAt: new Date(),
            ownerId: 'test'
        };

        const newState = calculateScore(initialState, 'home', 2);
        expect(newState.homeScore).toBe(12);
        expect(newState.guestScore).toBe(10);
    });

    it('should correctly add 3 points to guest team', () => {
        const initialState: GameState = {
            homeScore: 10,
            guestScore: 10,
            homeFouls: 0,
            guestFouls: 0,
            homeTeamName: 'Home',
            guestTeamName: 'Guest',
            status: 'live',
            currentPeriod: 1,
            clockSeconds: 600,
            possession: 'home',
            id: 'test',
            createdAt: new Date(),
            updatedAt: new Date(),
            ownerId: 'test'
        };

        const newState = calculateScore(initialState, 'guest', 3);
        expect(newState.homeScore).toBe(10);
        expect(newState.guestScore).toBe(13);
    });
});
