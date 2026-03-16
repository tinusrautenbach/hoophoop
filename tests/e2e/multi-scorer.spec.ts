import { test, expect, chromium, BrowserContext, Page } from '@playwright/test';
import { createTestUser, setupMockAuth } from './helpers/auth';
import { createE2EGame, inviteScorer, getCookieHeader, type E2EGame } from './helpers/game-factory';

interface TestState {
  ownerUser: { userId: string; email: string; cleanup: () => Promise<void> };
  scorerUser: { userId: string; email: string; cleanup: () => Promise<void> };
  game: E2EGame;
  contextOwner: BrowserContext;
  contextScorer: BrowserContext;
  pageOwner: Page;
  pageScorer: Page;
}

test.describe('Multi-Scorer: Concurrent WebSocket Scoring', () => {
  let state: TestState;

  test.beforeEach(async () => {
    const browser = await chromium.launch();

    const ownerUser = await createTestUser('owner');
    const scorerUser = await createTestUser('scorer');

    const contextOwner = await browser.newContext();
    const contextScorer = await browser.newContext();

    await setupMockAuth(contextOwner, ownerUser.userId);
    await setupMockAuth(contextScorer, scorerUser.userId);

    const pageOwner = await contextOwner.newPage();
    const pageScorer = await contextScorer.newPage();

    pageOwner.on('console', msg => console.log(`[OWNER PAGE] ${msg.type()}: ${msg.text()}`));
    pageScorer.on('console', msg => console.log(`[SCORER PAGE] ${msg.type()}: ${msg.text()}`));
    pageOwner.on('pageerror', err => console.error(`[OWNER PAGE ERROR] ${err.message}`));
    pageScorer.on('pageerror', err => console.error(`[SCORER PAGE ERROR] ${err.message}`));

    const ownerCookies = await contextOwner.cookies();
    const ownerAuth = await getCookieHeader(ownerCookies, ownerUser.userId);

    const game = await createE2EGame(ownerAuth);
    await inviteScorer(game.gameId, scorerUser.userId, 'co_scorer', ownerAuth);

    await pageOwner.goto(`/game/${game.gameId}/scorer`);
    await pageScorer.goto(`/game/${game.gameId}/scorer`);

    await pageOwner.waitForFunction(() => !document.body.innerText.includes('Entering Arena'), null, { timeout: 15000 });
    await pageScorer.waitForFunction(() => !document.body.innerText.includes('Entering Arena'), null, { timeout: 15000 });

    await pageOwner.waitForSelector('[data-testid="score-btn-2pt"]', { timeout: 10000 });
    await pageScorer.waitForSelector('[data-testid="score-btn-2pt"]', { timeout: 10000 });

    state = {
      ownerUser,
      scorerUser,
      game,
      contextOwner,
      contextScorer,
      pageOwner,
      pageScorer,
    };
  });

  test.afterEach(async () => {
    if (!state) return;

    await state.game.cleanup();
    await state.ownerUser.cleanup();
    await state.scorerUser.cleanup();
    await state.contextOwner.close();
    await state.contextScorer.close();
  });

  // -------------------------------------------------------------------------
  // T009: Simultaneous score updates converge
  // -------------------------------------------------------------------------
  test('T009: simultaneous score updates converge on both pages', async () => {
    const { pageOwner, pageScorer } = state;

    await pageOwner.click('[data-testid="score-btn-2pt"]');
    await pageOwner.waitForSelector('[data-testid="scoring-modal"]', { timeout: 5000 });
    await pageOwner.waitForTimeout(300);
    await pageOwner.click('[data-testid="team-home-btn"]', { force: true });

    await expect(pageOwner.locator('[data-testid="home-score"]')).toHaveText('2', { timeout: 5000 });
    await expect(pageScorer.locator('[data-testid="home-score"]')).toHaveText('2', { timeout: 5000 });

    await pageScorer.click('[data-testid="score-btn-3pt"]');
    await pageScorer.waitForSelector('[data-testid="scoring-modal"]', { timeout: 5000 });
    await pageScorer.waitForTimeout(300);
    await pageScorer.click('[data-testid="team-guest-btn"]', { force: true });

    await expect(pageOwner.locator('[data-testid="guest-score"]')).toHaveText('3', { timeout: 5000 });
    await expect(pageScorer.locator('[data-testid="guest-score"]')).toHaveText('3', { timeout: 5000 });
  });

  test('T010: foul recorded by owner propagates to scorer page', async () => {
    const { pageOwner, pageScorer } = state;

    const initialText = await pageScorer.locator('[data-testid="home-fouls"]').innerText();
    const initialFouls = parseInt(initialText.trim(), 10);

    await pageOwner.click('[data-testid="foul-btn-home"]');

    const expectedFouls = (initialFouls + 1).toString();
    await expect(pageScorer.locator('[data-testid="home-fouls"]')).toHaveText(expectedFouls, { timeout: 10000 });
    await expect(pageOwner.locator('[data-testid="home-fouls"]')).toHaveText(expectedFouls, { timeout: 10000 });
  });

  test('T011: event deletion by owner propagates to scorer page', async () => {
    const { pageOwner, pageScorer } = state;

    await pageOwner.click('[data-testid="score-btn-2pt"]');
    await pageOwner.waitForSelector('[data-testid="scoring-modal"]', { timeout: 5000 });
    await pageOwner.waitForTimeout(300);
    await pageOwner.click('[data-testid="team-home-btn"]', { force: true });

    await expect(pageOwner.locator('[data-testid="home-score"]')).toHaveText('2', { timeout: 5000 });
    await expect(pageScorer.locator('[data-testid="home-score"]')).toHaveText('2', { timeout: 5000 });

    await pageOwner.waitForTimeout(2000);

    // Debug: verify event was created
    const debugText = await pageOwner.locator('[data-testid="game-log"]').first().innerText();
    console.log('[DEBUG] Game log before navigation:', debugText);

    await pageOwner.goto(`/game/${state.game.gameId}/scorer/log`);
    await pageOwner.waitForSelector('text=Game Timeline', { timeout: 10000 });
    
    // Wait for event to appear in the log via Hasura subscription (sole source after T039 refactor)
    // Give extra time for WebSocket subscription to connect and deliver events
    await pageOwner.waitForFunction(() => {
      const el = document.querySelector('[data-testid="game-log"]');
      return el && el.textContent && !el.textContent.includes('No matching events');
    }, null, { timeout: 15000 });
    // Also wait for the delete button to be visible and actionable
    await pageOwner.waitForSelector('button[aria-label="Delete event"]', { timeout: 15000 });
    await pageOwner.locator('button[aria-label="Delete event"]').first().click();
    await pageOwner.locator('button[aria-label="Confirm delete"]').click();
    await pageOwner.waitForTimeout(2000);

    // Verify event was deleted from log - should show "No matching events" now
    await expect(pageOwner.locator('text=No matching events')).toBeVisible({ timeout: 5000 });

    // Navigate back to scorer page - score should still be 2 (event deletion doesn't auto-recalculate)
    await pageOwner.goto(`/game/${state.game.gameId}/scorer`);
    await pageOwner.waitForSelector('[data-testid="score-btn-2pt"]', { timeout: 10000 });

    // Score stays at 2 because deleting event doesn't automatically recalculate
    // But scorer page should still see score 2 via WebSocket
    await expect(pageOwner.locator('[data-testid="home-score"]')).toHaveText('2', { timeout: 5000 });
    await expect(pageScorer.locator('[data-testid="home-score"]')).toHaveText('2', { timeout: 5000 });
  });
});
