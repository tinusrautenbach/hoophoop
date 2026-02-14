/**
 * Minutes tracking utilities for basketball box score
 */

export type EventType = 'score' | 'foul' | 'timeout' | 'sub' | 'turnover' | 'block' | 'steal' | 'rebound_off' | 'rebound_def' | 'period_start' | 'period_end' | 'clock_start' | 'clock_stop' | 'undo' | 'miss';

export type GameEvent = {
    id: string;
    type: EventType;
    period: number;
    clockAt: number;
    team: 'home' | 'guest';
    player?: string;
    value?: number;
    metadata?: {
        points?: number;
        shotType?: '2pt' | '3pt' | 'ft';
        made?: boolean;
    };
    description: string;
};

export type RosterEntry = {
    id: string;
    name: string;
    number: string;
    team: 'home' | 'guest';
    points: number;
    fouls: number;
    isActive: boolean;
};

export type PlayerMinutes = {
    [playerName: string]: number;
};

/**
 * Calculates the minutes played for each player based on substitution events.
 * 
 * @param events - Array of game events including substitutions, period starts/ends
 * @param roster - Array of roster entries for the team
 * @param periodLength - Length of each period in seconds (default: 600 = 10 minutes)
 * @param currentPeriod - The current period number (for handling players still on court)
 * @returns Object mapping player names to minutes played
 */
export function calculatePlayerMinutes(
    events: GameEvent[],
    roster: RosterEntry[],
    periodLength: number = 600,
    currentPeriod: number = 1
): PlayerMinutes {
    // Initialize minutes for all roster players to 0
    const playerMinutes: PlayerMinutes = {};
    roster.forEach(player => {
        playerMinutes[player.name] = 0;
    });

    // Track when each player is on the court
    // Maps player name to { period: number, clockAt: number } or null if not on court
    const playerOnCourt: { [key: string]: { period: number; clockAt: number } | null } = {};
    roster.forEach(player => {
        playerOnCourt[player.name] = null;
    });

    // Filter and sort events by time (oldest first)
    // Events are sorted by period ascending, then by clockAt descending (higher clockAt = earlier in period)
    const sortedEvents = [...events].sort((a, b) => {
        if (a.period !== b.period) return a.period - b.period;
        return b.clockAt - a.clockAt;
    });

    sortedEvents.forEach(event => {
        if (event.type === 'period_start') {
            // At period start, any active player starts playing
            roster.filter(p => p.isActive).forEach(p => {
                playerOnCourt[p.name] = { period: event.period, clockAt: periodLength };
            });
            return;
        }
        
        if (event.type === 'period_end') {
            // At period end, all players stop playing
            Object.keys(playerOnCourt).forEach(name => {
                if (playerOnCourt[name]) {
                    const startTime = playerOnCourt[name]!;
                    // Calculate from when they started playing to period end
                    const timeOnCourt = startTime.clockAt - event.clockAt;
                    playerMinutes[name] += timeOnCourt / 60;
                    playerOnCourt[name] = null;
                }
            });
            return;
        }
        
        // For substitution events, we need a player name
        const playerName = event.player;
        if (!playerName || !playerMinutes.hasOwnProperty(playerName)) return;
        
        if (event.type === 'sub') {
            // Handle substitutions - check description for "In" or "Benched"
            const isSubbingIn = event.description?.includes(' In') || event.description?.endsWith(' In');
            const isSubbingOut = event.description?.includes(' Benched') || event.description?.endsWith(' Benched');

            if (isSubbingIn && !playerOnCourt[playerName]) {
                // Player entering the court
                playerOnCourt[playerName] = { period: event.period, clockAt: event.clockAt };
            } else if (isSubbingOut && playerOnCourt[playerName]) {
                // Player leaving the court
                const startTime = playerOnCourt[playerName]!;
                if (startTime.period === event.period) {
                    const timeOnCourt = startTime.clockAt - event.clockAt;
                    playerMinutes[playerName] += timeOnCourt / 60;
                }
                playerOnCourt[playerName] = null;
            }
        }
    });

    // Handle players still on court at game end
    // Find the last clock value in the current period, or use 0 if no events
    let lastClockInCurrentPeriod = 0;
    for (let i = sortedEvents.length - 1; i >= 0; i--) {
        if (sortedEvents[i].period === currentPeriod) {
            lastClockInCurrentPeriod = sortedEvents[i].clockAt;
            break;
        }
    }
    
    Object.keys(playerOnCourt).forEach(name => {
        if (playerOnCourt[name]) {
            const startTime = playerOnCourt[name]!;
            if (startTime.period === currentPeriod) {
                // If player is still on court, calculate from their start time to the last event
                // or to period end (0) if the last event is when they subbed in
                const endClock = lastClockInCurrentPeriod < startTime.clockAt 
                    ? lastClockInCurrentPeriod  // Game ended before period end
                    : 0;  // Played until period end
                const timeOnCourt = startTime.clockAt - endClock;
                playerMinutes[name] += timeOnCourt / 60;
            }
            playerOnCourt[name] = null;
        }
    });

    // Round minutes to 1 decimal place
    Object.keys(playerMinutes).forEach(name => {
        playerMinutes[name] = Math.round(playerMinutes[name] * 10) / 10;
    });

    return playerMinutes;
}

/**
 * Validates that the minutes calculation is reasonable.
 * Total minutes across all players should not exceed periodLength * currentPeriod.
 * 
 * @param playerMinutes - Object mapping player names to minutes
 * @param periodLength - Length of each period in seconds
 * @param currentPeriod - Current period number
 * @returns Object with validation result and any error messages
 */
export function validateMinutes(
    playerMinutes: PlayerMinutes,
    periodLength: number = 600,
    currentPeriod: number = 1
): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const maxPossibleMinutes = (periodLength / 60) * currentPeriod;
    
    const totalMinutes = Object.values(playerMinutes).reduce((sum, mins) => sum + mins, 0);
    
    // Total minutes should not exceed max possible (5 players * period minutes)
    const maxTotalMinutes = 5 * maxPossibleMinutes;
    if (totalMinutes > maxTotalMinutes + 0.1) { // Small tolerance for rounding
        errors.push(`Total minutes (${totalMinutes.toFixed(1)}) exceeds maximum possible (${maxTotalMinutes.toFixed(1)})`);
    }
    
    // No individual player should exceed max possible minutes
    Object.entries(playerMinutes).forEach(([name, minutes]) => {
        if (minutes > maxPossibleMinutes + 0.1) {
            errors.push(`Player ${name} has ${minutes.toFixed(1)} minutes, exceeding maximum possible (${maxPossibleMinutes.toFixed(1)})`);
        }
        if (minutes < 0) {
            errors.push(`Player ${name} has negative minutes (${minutes.toFixed(1)})`);
        }
    });
    
    return {
        isValid: errors.length === 0,
        errors
    };
}
