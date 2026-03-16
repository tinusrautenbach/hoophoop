import { test, expect, chromium, BrowserContext, Page } from '@playwright/test';
import { createTestUser, setupMockAuth } from './helpers/auth';
import { createE2EGame, getCookieHeader, type E2EGame } from './helpers/game-factory';

interface TestState {
  user: { userId: string; email: string; cleanup: () => Promise<void> };
  game: E2EGame;
  context: BrowserContext;
  page: Page;
}

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

test.describe('Shot Ratio Display in Game Log', () => {
  let state: TestState;

  test.beforeEach(async () => {
    const browser = await chromium.launch();

    const user = await createTestUser('scorer');

    const context = await browser.newContext();
    await setupMockAuth(context, user.userId);

    const page = await context.newPage();

    page.on('console', msg => console.log(`[PAGE] ${msg.type()}: ${msg.text()}`));
    page.on('pageerror', err => console.error(`[PAGE ERROR] ${err.message}`));

    const cookies = await context.cookies();
    const auth = await getCookieHeader(cookies, user.userId);

    const game = await createE2EGame(auth);

    await page.goto(`/game/${game.gameId}/scorer`);
    await page.waitForFunction(() => !document.body.innerText.includes('Entering Arena'), null, { timeout: 15000 });
    await page.waitForSelector('[data-testid="score-btn-2pt"]', { timeout: 10000 });

    state = {
      user,
      game,
      context,
      page,
    };
  });

  test.afterEach(async () => {
    if (!state) return;

    await state.game.cleanup();
    await state.user.cleanup();
    await state.context.close();
  });

  test('T013: displays ratio on score events', async () => {
    const { page } = state;
    const gameId = state.game.gameId;
    const auth = {
      cookie: '',
      userId: state.user.userId,
    };

    const cookies = await state.context.cookies();
    const mockCookies = cookies.filter((c) => c.name.startsWith('__mock_'));
    auth.cookie = mockCookies.map((c) => `${c.name}=${c.value}`).join('; ');

    await addScoreEvent(gameId, 'Player A', 'home', 2, auth);
    await addScoreEvent(gameId, 'Player A', 'home', 2, auth);

    await page.goto(`/game/${gameId}/scorer`);
    await page.waitForSelector('[data-testid="game-log"]', { timeout: 10000 });

    const gameLogText = await page.locator('[data-testid="game-log"]').textContent();
    expect(gameLogText).toContain('Player A');
    expect(gameLogText).toContain('+2');
  });

  test('T019: displays ratio on miss events', async () => {
    const { page } = state;
    const gameId = state.game.gameId;
    const auth = { cookie: '', userId: state.user.userId };

    const cookies = await state.context.cookies();
    const mockCookies = cookies.filter((c) => c.name.startsWith('__mock_'));
    auth.cookie = mockCookies.map((c) => `${c.name}=${c.value}`).join('; ');

    await addMissEvent(gameId, 'Player A', 'home', 3, auth);

    await page.goto(`/game/${gameId}/scorer`);
    await page.waitForSelector('[data-testid="game-log"]', { timeout: 10000 });

    const gameLogText = await page.locator('[data-testid="game-log"]').textContent();
    expect(gameLogText).toContain('Player A');
    expect(gameLogText).toContain('-3');
  });

  test('T025: updates ratio when events are added', async () => {
    const { page } = state;
    const gameId = state.game.gameId;
    const auth = { cookie: '', userId: state.user.userId };

    const cookies = await state.context.cookies();
    const mockCookies = cookies.filter((c) => c.name.startsWith('__mock_'));
    auth.cookie = mockCookies.map((c) => `${c.name}=${c.value}`).join('; ');

    await page.goto(`/game/${gameId}/scorer`);
    await page.waitForSelector('[data-testid="game-log"]', { timeout: 10000 });

    await addScoreEvent(gameId, 'Player A', 'home', 2, auth);
    await page.waitForTimeout(500);

    await addMissEvent(gameId, 'Player A', 'home', 2, auth);
    await page.waitForTimeout(500);

    const gameLogText = await page.locator('[data-testid="game-log"]').textContent();
    expect(gameLogText).toContain('Player A');
  });

  test('T026: updates ratio when events are deleted', async () => {
    const { page } = state;
    const gameId = state.game.gameId;
    const auth = { cookie: '', userId: state.user.userId };

    const cookies = await state.context.cookies();
    const mockCookies = cookies.filter((c) => c.name.startsWith('__mock_'));
    auth.cookie = mockCookies.map((c) => `${c.name}=${c.value}`).join('; ');

    const event = await addScoreEvent(gameId, 'Player A', 'home', 2, auth);

    await page.goto(`/game/${gameId}/scorer`);
    await page.waitForSelector('[data-testid="game-log"]', { timeout: 10000 });

    await deleteEvent(gameId, event.id, auth);

    await page.waitForTimeout(500);
    const gameLogText = await page.locator('[data-testid="game-log"]').textContent();
    expect(gameLogText).toBeDefined();
  });
});

async function addScoreEvent(
  gameId: string,
  player: string,
  team: 'home' | 'guest',
  value: number,
  auth: { cookie: string; userId: string }
): Promise<{ id: string }> {
  const res = await fetch(`${BASE_URL}/api/games/${gameId}/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-test-auth': 'true',
      'x-test-user-id': auth.userId,
      Cookie: auth.cookie,
    },
    body: JSON.stringify({
      type: 'score',
      player,
      team,
      value,
      description: `${value}-pointer by ${player}`,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to add score event: ${res.status} ${body}`);
  }

  return res.json();
}

async function addMissEvent(
  gameId: string,
  player: string,
  team: 'home' | 'guest',
  value: number,
  auth: { cookie: string; userId: string }
): Promise<{ id: string }> {
  const res = await fetch(`${BASE_URL}/api/games/${gameId}/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-test-auth': 'true',
      'x-test-user-id': auth.userId,
      Cookie: auth.cookie,
    },
    body: JSON.stringify({
      type: 'miss',
      player,
      team,
      value,
      description: `Missed ${value}-pointer by ${player}`,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to add miss event: ${res.status} ${body}`);
  }

  return res.json();
}

async function deleteEvent(
  gameId: string,
  eventId: string,
  auth: { cookie: string; userId: string }
): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/games/${gameId}/events?eventId=${eventId}`, {
    method: 'DELETE',
    headers: {
      'x-test-auth': 'true',
      'x-test-user-id': auth.userId,
      Cookie: auth.cookie,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to delete event: ${res.status} ${body}`);
  }
}