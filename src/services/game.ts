export type GameState = {
    id: string;
    ownerId: string;
    homeTeamName: string;
    guestTeamName: string;
    status: 'scheduled' | 'live' | 'final';
    currentPeriod: number;
    clockSeconds: number;
    homeScore: number;
    guestScore: number;
    homeFouls: number;
    guestFouls: number;
    possession?: 'home' | 'guest';
    createdAt: Date;
    updatedAt: Date;
};

export const calculateScore = (
    currentState: Partial<GameState>,
    team: 'home' | 'guest',
    points: number
): Partial<GameState> => {
    if (team === 'home') {
        return { ...currentState, homeScore: (currentState.homeScore || 0) + points };
    } else {
        return { ...currentState, guestScore: (currentState.guestScore || 0) + points };
    }
};
