import { useConvexGame } from './use-convex-game';

export const useSocket = (gameId: string) => {
  const convexGame = useConvexGame(gameId);

  return {
    socket: null,
    isConnected: convexGame.isConnected,
    emit: () => {},
    on: () => {},
    off: () => {},
  };
};
