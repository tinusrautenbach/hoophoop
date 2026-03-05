import { test, expect, chromium, BrowserContext, Page } from '@playwright/test';
import { clerkSetup } from '@clerk/testing/playwright';
import { createTestUser, signInUser, bypassBotProtection } from './helpers/auth';
import { createE2EGame, inviteScorer, getCookieHeader, type E2EGame } from './helpers/game-factory';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TestState {
  ownerUser: { userId: string; email: string; cleanup: () => Promise<void> };
  scorerUser: { userId: string; email: string; cleanup: () => Promise<void> };
  game: E2EGame;
  contextOwner: BrowserContext;
  contextScorer: BrowserContext;
  pageOwner: Page;
  pageScorer: Page;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe('Multi-Scorer: Concurrent WebSocket Scoring', () => {
  let state: TestState;

  test.beforeAll(async () => {
    await clerkSetup();
  });

  test.beforeEach(async () => {
    const browser = await chromium.launch();

    // --- Provision two Clerk users ------------------------------------------
    const ownerUser = await createTestUser('owner');
    const scorerUser = await createTestUser('scorer');

    // --- Contexts with bot-protection bypass ---------------------------------
    const contextOwner = await browser.newContext();
    const contextScorer = await browser.newContext();

    await bypassBotProtection(contextOwner);
    await bypassBotProtection(contextScorer);

    // --- Sign in both users --------------------------------------------------
    const pageOwner = await contextOwner.newPage();
    const pageScorer = await contextScorer.newPage();

    // Navigate to the public home page first (required by clerk.signIn)
    await pageOwner.goto('/');
    await signInUser(pageOwner, ownerUser.email);

    await pageScorer.goto('/');
    await signInUser(pageScorer, scorerUser.email);

    // --- Get owner's session cookie to make API calls ------------------------
    const ownerCookies = await contextOwner.cookies();
    const ownerCookieHeader = await getCookieHeader(ownerCookies);

    // --- Create game and invite scorer ---------------------------------------
    const game = await createE2EGame(ownerCookieHeader);
    await inviteScorer(game.gameId, scorerUser.userId, 'co_scorer', ownerCookieHeader);

    // --- Navigate both contexts to the scorer page ---------------------------
    await pageOwner.goto(`/game/${game.gameId}/scorer`);
    await pageScorer.goto(`/game/${game.gameId}/scorer`);

    // Wait for the scoring interface to be ready on both pages
    await pageOwner.waitForSelector('[data-testid="score-btn-2pt"]');
    await pageScorer.waitForSelector('[data-testid="score-btn-2pt"]');

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

    // Cleanup game first (cascades all game data)
    await state.game.cleanup();

    // Delete Clerk users
    await state.ownerUser.cleanup();
    await state.scorerUser.cleanup();

    // Close browser contexts
    await state.contextOwner.close();
    await state.contextScorer.close();
  });

  // -------------------------------------------------------------------------
  // T009: Simultaneous score updates converge
  // -------------------------------------------------------------------------
  test('T009: simultaneous score updates converge on both pages', async () => {
    const { pageOwner, pageScorer } = state;

    // Both scorers press their buttons simultaneously
    await Promise.all([
      pageOwner.click('[data-testid="score-btn-2pt"]'),
      pageScorer.click('[data-testid="score-btn-3pt"]'),
    ]);

    // After scoring in simple mode, a player-selection modal may appear.
    // Dismiss by clicking the first available player or the "Team" option.
    // If a modal appears, select the team-score option or first roster entry.
    const ownerModal = pageOwner.locator('[data-testid="scoring-modal"], [data-testid="score-btn-team"]');
    const scorerModal = pageScorer.locator('[data-testid="scoring-modal"], [data-testid="score-btn-team"]');

    // Handle modal if it appears (roster-less game scores directly without modal)
    if (await ownerModal.count() > 0) {
      // Click the first available team button in the modal
      await pageOwner.locator('button:has-text("Home"), button:has-text("Team")').first().click();
    }
    if (await scorerModal.count() > 0) {
      await pageScorer.locator('button:has-text("Guest"), button:has-text("Team")').first().click();
    }

    // Owner scored +2 for home — both pages should reflect this
    await expect(pageOwner.locator('[data-testid="home-score"]')).toHaveText('2', { timeout: 5000 });
    await expect(pageScorer.locator('[data-testid="home-score"]')).toHaveText('2', { timeout: 5000 });

    // Scorer scored +3 for guest — both pages should reflect this
    await expect(pageOwner.locator('[data-testid="guest-score"]')).toHaveText('3', { timeout: 5000 });
    await expect(pageScorer.locator('[data-testid="guest-score"]')).toHaveText('3', { timeout: 5000 });
  });

  // -------------------------------------------------------------------------
  // T010: Foul recorded by Scorer A appears on Scorer B
  // -------------------------------------------------------------------------
  test('T010: foul recorded by owner propagates to scorer page', async () => {
    const { pageOwner, pageScorer } = state;

    // Get initial home foul count from Scorer B
    const initialText = await pageScorer.locator('[data-testid="home-fouls"]').innerText();
    const initialFouls = parseInt(initialText.trim(), 10);

    // Owner records a home foul
    await pageOwner.click('[data-testid="foul-btn-home"]');

    // If a player selection modal appears, handle it
    const foulModal = pageOwner.locator('button:has-text("Home Foul"), [data-testid="foul-player-select"]');
    if (await foulModal.count() > 0) {
      // Select first player in the roster selection
      await pageOwner.locator('[class*="roster"], button[class*="player"]').first().click();
    }

    // Scorer B should see the incremented foul count within 5s
    const expectedFouls = (initialFouls + 1).toString();
    await expect(pageScorer.locator('[data-testid="home-fouls"]')).toHaveText(expectedFouls, {
      timeout: 5000,
    });

    // Owner's own page should also reflect it
    await expect(pageOwner.locator('[data-testid="home-fouls"]')).toHaveText(expectedFouls, {
      timeout: 5000,
    });
  });

  // -------------------------------------------------------------------------
  // T011: Event deletion propagates across browsers
  // -------------------------------------------------------------------------
  test('T011: event deletion by owner propagates to scorer page', async () => {
    const { pageOwner, pageScorer } = state;

    // Owner records a +2 home score
    await pageOwner.click('[data-testid="score-btn-2pt"]');

    // Handle player selection modal if present
    const modal = pageOwner.locator('[data-testid="scoring-modal"]');
    if (await modal.isVisible({ timeout: 1000 }).catch(() => false)) {
      await pageOwner.locator('button:has-text("Home"), button:has-text("Team")').first().click();
    }

    // Wait for both pages to show the score update
    await expect(pageOwner.locator('[data-testid="home-score"]')).toHaveText('2', { timeout: 5000 });
    await expect(pageScorer.locator('[data-testid="home-score"]')).toHaveText('2', { timeout: 5000 });

    // Owner deletes the event from the game log
    // The game log shows events with a delete button (trash icon)
    const deleteButton = pageOwner.locator(
      '[data-testid="game-log"] button[aria-label="Delete event"], [class*="game-log"] button[class*="delete"], button[aria-label*="delete"], button[title*="delete"]'
    ).first();

    // If a dedicated delete button isn't present, look for the event entry and right-click or use the log UI
    if (await deleteButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await deleteButton.click();
      // Confirm deletion if a confirmation dialog appears
      const confirmBtn = pageOwner.locator('button:has-text("Confirm"), button:has-text("Delete"), button:has-text("Yes")');
      if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await confirmBtn.click();
      }
    } else {
      // Hover over the most recent event in the log to reveal delete controls
      const latestEvent = pageOwner.locator('[class*="game-log"] [class*="event"], [class*="GameLog"] li').first();
      await latestEvent.hover();
      const revealedDelete = latestEvent.locator('button[class*="delete"], button[aria-label*="delete"], button svg[class*="trash"], button svg').first();
      await revealedDelete.click();
    }

    // After deletion, both pages should show score back to 0
    await expect(pageOwner.locator('[data-testid="home-score"]')).toHaveText('0', { timeout: 5000 });
    await expect(pageScorer.locator('[data-testid="home-score"]')).toHaveText('0', { timeout: 5000 });
  });
});
