const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export interface E2EGame {
  gameId: string;
  cleanup: () => Promise<void>;
}

/**
 * Creates an [E2E-TEST] game via the REST API, owned by the given user.
 * The game name is prefixed with [E2E-TEST] so the globalSetup cleanup
 * script can identify and remove it before each test run.
 *
 * The game is immediately PATCHed to `live` status so the scoring UI renders.
 *
 * @param ownerCookieHeader - The Cookie header value (e.g. "__session=<token>")
 *   for the owner user.  The factory makes real HTTP calls to the app.
 */
export async function createE2EGame(ownerCookieHeader: string): Promise<E2EGame> {
  const createRes = await fetch(`${BASE_URL}/api/games`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: ownerCookieHeader,
    },
    body: JSON.stringify({
      name: `[E2E-TEST] Concurrent Scoring ${Date.now()}`,
      homeTeamName: 'Home',
      guestTeamName: 'Guest',
      mode: 'simple',
      visibility: 'private',
    }),
  });

  if (!createRes.ok) {
    const body = await createRes.text();
    throw new Error(`[E2E GameFactory] Failed to create game: ${createRes.status} ${body}`);
  }

  const game = (await createRes.json()) as { id: string };
  const gameId = game.id;

  // Transition game to `live` so the scorer UI shows buttons
  const patchRes = await fetch(`${BASE_URL}/api/games/${gameId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Cookie: ownerCookieHeader,
    },
    body: JSON.stringify({ status: 'live' }),
  });

  if (!patchRes.ok) {
    const body = await patchRes.text();
    throw new Error(`[E2E GameFactory] Failed to set game live: ${patchRes.status} ${body}`);
  }

  return {
    gameId,
    cleanup: async () => {
      try {
        const deleteRes = await fetch(`${BASE_URL}/api/games/${gameId}`, {
          method: 'DELETE',
          headers: { Cookie: ownerCookieHeader },
        });
        if (!deleteRes.ok) {
          console.warn(`[E2E GameFactory] Failed to delete game ${gameId}: ${deleteRes.status}`);
        }
      } catch (err) {
        console.warn(`[E2E GameFactory] Error during game cleanup for ${gameId}:`, err);
      }
    },
  };
}

/**
 * Invites a user to a game as a scorer with the specified role.
 *
 * Uses `POST /api/games/[id]/scorers` to add the userId directly.
 *
 * @param gameId - The game to invite the user to.
 * @param userId - The Clerk userId to invite.
 * @param role - 'co_scorer' or 'viewer'.
 * @param ownerCookieHeader - Cookie header for the game owner.
 */
export async function inviteScorer(
  gameId: string,
  userId: string,
  role: 'co_scorer' | 'viewer',
  ownerCookieHeader: string
): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/games/${gameId}/scorers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: ownerCookieHeader,
    },
    body: JSON.stringify({ userId, role }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `[E2E GameFactory] Failed to invite scorer ${userId} as ${role}: ${res.status} ${body}`
    );
  }
}

/**
 * Extracts all Clerk-related cookies from a Playwright BrowserContext's
 * cookie jar and returns them as a Cookie header string.
 * Clerk's server-side middleware requires both __session and __client_uat
 * (plus __clerk_db_jwt if present) to authenticate requests correctly.
 */
export async function getCookieHeader(
  cookieJar: Array<{ name: string; value: string }>
): Promise<string> {
  const clerkCookieNames = ['__session', '__client_uat', '__clerk_db_jwt'];
  const relevantCookies = cookieJar.filter((c) =>
    clerkCookieNames.some((name) => c.name === name || c.name.startsWith(name + '_'))
  );
  if (!relevantCookies.some((c) => c.name === '__session' || c.name.startsWith('__session_'))) {
    throw new Error('[E2E GameFactory] No __session cookie found in context');
  }
  return relevantCookies.map((c) => `${c.name}=${c.value}`).join('; ');
}
