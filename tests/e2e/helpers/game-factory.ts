const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export interface E2EGame {
  gameId: string;
  cleanup: () => Promise<void>;
}

interface MockAuthHeaders {
  cookie: string;
  userId: string;
}

export async function createE2EGame(mockAuth: MockAuthHeaders): Promise<E2EGame> {
  const createRes = await fetch(`${BASE_URL}/api/games`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-test-auth': 'true',
      'x-test-user-id': mockAuth.userId,
      Cookie: mockAuth.cookie,
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

  const patchRes = await fetch(`${BASE_URL}/api/games/${gameId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-test-auth': 'true',
      'x-test-user-id': mockAuth.userId,
      Cookie: mockAuth.cookie,
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
          headers: {
            'x-test-auth': 'true',
            'x-test-user-id': mockAuth.userId,
            Cookie: mockAuth.cookie,
          },
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

export async function inviteScorer(
  gameId: string,
  userId: string,
  role: 'co_scorer' | 'viewer',
  ownerAuth: MockAuthHeaders
): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/games/${gameId}/scorers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-test-auth': 'true',
      'x-test-user-id': ownerAuth.userId,
      Cookie: ownerAuth.cookie,
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

export async function getCookieHeader(
  cookieJar: Array<{ name: string; value: string }>,
  userId: string
): Promise<MockAuthHeaders> {
  const mockCookies = cookieJar.filter((c) =>
    c.name.startsWith('__mock_')
  );
  const cookieString = mockCookies.map((c) => `${c.name}=${c.value}`).join('; ');
  return {
    cookie: cookieString,
    userId,
  };
}
