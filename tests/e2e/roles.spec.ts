import { test, expect, chromium, BrowserContext, Page } from '@playwright/test';
import { createTestUser, setupMockAuth } from './helpers/auth';
import { createE2EGame, inviteScorer, getCookieHeader, type E2EGame } from './helpers/game-factory';

interface RoleTestState {
  ownerUser: { userId: string; email: string; cleanup: () => Promise<void> };
  viewerUser: { userId: string; email: string; cleanup: () => Promise<void> };
  game: E2EGame;
  contextOwner: BrowserContext;
  contextViewer: BrowserContext;
  pageOwner: Page;
  pageViewer: Page;
  ownerAuth: { cookie: string; userId: string };
}

test.describe('Role Enforcement: Viewer vs Scorer', () => {
  let state: RoleTestState;

  test.beforeEach(async () => {
    const browser = await chromium.launch();

    const ownerUser = await createTestUser('owner');
    const viewerUser = await createTestUser('viewer');

    const contextOwner = await browser.newContext();
    const contextViewer = await browser.newContext();

    await setupMockAuth(contextOwner, ownerUser.userId);
    await setupMockAuth(contextViewer, viewerUser.userId);

    const pageOwner = await contextOwner.newPage();
    const pageViewer = await contextViewer.newPage();

    const ownerCookies = await contextOwner.cookies();
    const ownerAuth = await getCookieHeader(ownerCookies, ownerUser.userId);

    const game = await createE2EGame(ownerAuth);
    await inviteScorer(game.gameId, viewerUser.userId, 'viewer', ownerAuth);

    state = {
      ownerUser,
      viewerUser,
      game,
      contextOwner,
      contextViewer,
      pageOwner,
      pageViewer,
      ownerAuth,
    };
  });

  test.afterEach(async () => {
    if (!state) return;

    await state.game.cleanup();
    await state.ownerUser.cleanup();
    await state.viewerUser.cleanup();
    await state.contextOwner.close();
    await state.contextViewer.close();
  });

  test('T013: viewer can observe game but cannot add scorers', async () => {
    const { pageViewer, game } = state;

    await pageViewer.goto(`/game/${game.gameId}/scorer`);
    await pageViewer.waitForFunction(() => !document.body.innerText.includes('Entering Arena'), null, { timeout: 15000 });

    await expect(pageViewer.locator('[data-testid="home-score"]')).toBeVisible({ timeout: 10000 });
    await expect(pageViewer.locator('[data-testid="guest-score"]')).toBeVisible({ timeout: 5000 });

    const scorerManagerModal = pageViewer.locator('[data-testid="scorer-manager"], [class*="scorer-manager"]');
    await expect(scorerManagerModal).not.toBeVisible();
  });

  test('T014: viewer API POST to events returns 403, owner score succeeds', async () => {
    const { pageOwner, pageViewer, game } = state;

    await pageOwner.goto(`/game/${game.gameId}/scorer`);
    await pageOwner.waitForFunction(() => !document.body.innerText.includes('Entering Arena'), null, { timeout: 15000 });
    await pageOwner.waitForSelector('[data-testid="score-btn-2pt"]');

    await pageOwner.click('[data-testid="score-btn-2pt"]');
    await pageOwner.waitForSelector('[data-testid="scoring-modal"]', { timeout: 5000 });
    await pageOwner.waitForTimeout(300);
    await pageOwner.click('[data-testid="team-home-btn"]', { force: true });

    await expect(pageOwner.locator('[data-testid="home-score"]')).toHaveText('2', { timeout: 10000 });
    await pageOwner.waitForTimeout(3000);

    await pageViewer.goto(`/game/${game.gameId}/scorer`);
    await pageViewer.waitForFunction(() => !document.body.innerText.includes('Entering Arena'), null, { timeout: 15000 });
    await pageViewer.waitForSelector('[data-testid="home-score"]');
    await expect(pageViewer.locator('[data-testid="home-score"]')).toHaveText('2', { timeout: 15000 });

    const apiResponse = await pageViewer.evaluate(
      async ({ gameId }: { gameId: string }) => {
        const res = await fetch(`/api/games/${gameId}/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'score',
            team: 'guest',
            value: 50,
            description: 'Unauthorized viewer score attempt',
          }),
        });
        return res.status;
      },
      { gameId: game.gameId }
    );

    expect(apiResponse).toBe(403);

    await expect(pageOwner.locator('[data-testid="guest-score"]')).toHaveText('0', { timeout: 5000 });
    await expect(pageViewer.locator('[data-testid="guest-score"]')).toHaveText('0', { timeout: 5000 });
  });
});
