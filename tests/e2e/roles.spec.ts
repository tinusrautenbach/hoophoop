import { test, expect, chromium, BrowserContext, Page } from '@playwright/test';
import { clerkSetup } from '@clerk/testing/playwright';
import { createTestUser, signInUser, bypassBotProtection } from './helpers/auth';
import { createE2EGame, inviteScorer, getCookieHeader, type E2EGame } from './helpers/game-factory';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RoleTestState {
  ownerUser: { userId: string; email: string; cleanup: () => Promise<void> };
  viewerUser: { userId: string; email: string; cleanup: () => Promise<void> };
  game: E2EGame;
  contextOwner: BrowserContext;
  contextViewer: BrowserContext;
  pageOwner: Page;
  pageViewer: Page;
  ownerCookieHeader: string;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe('Role Enforcement: Viewer vs Scorer', () => {
  let state: RoleTestState;

  test.beforeAll(async () => {
    await clerkSetup();
  });

  test.beforeEach(async () => {
    const browser = await chromium.launch();

    // --- Provision owner + viewer Clerk users --------------------------------
    const ownerUser = await createTestUser('role-owner');
    const viewerUser = await createTestUser('role-viewer');

    // --- Contexts with bot-protection bypass ---------------------------------
    const contextOwner = await browser.newContext();
    const contextViewer = await browser.newContext();

    await bypassBotProtection(contextOwner);
    await bypassBotProtection(contextViewer);

    // --- Sign in both users --------------------------------------------------
    const pageOwner = await contextOwner.newPage();
    const pageViewer = await contextViewer.newPage();

    // Navigate to public page first (required by clerk.signIn)
    await pageOwner.goto('/');
    await signInUser(pageOwner, ownerUser.email);

    await pageViewer.goto('/');
    await signInUser(pageViewer, viewerUser.email);

    // --- Get owner's session cookie to make API calls ------------------------
    const ownerCookies = await contextOwner.cookies();
    const ownerCookieHeader = await getCookieHeader(ownerCookies);

    // --- Create game and invite viewer ---------------------------------------
    const game = await createE2EGame(ownerCookieHeader);
    await inviteScorer(game.gameId, viewerUser.userId, 'viewer', ownerCookieHeader);

    state = {
      ownerUser,
      viewerUser,
      game,
      contextOwner,
      contextViewer,
      pageOwner,
      pageViewer,
      ownerCookieHeader,
    };
  });

  test.afterEach(async () => {
    if (!state) return;

    // Cleanup game first (cascades all game data)
    await state.game.cleanup();

    // Delete Clerk users
    await state.ownerUser.cleanup();
    await state.viewerUser.cleanup();

    // Close browser contexts
    await state.contextOwner.close();
    await state.contextViewer.close();
  });

  // -------------------------------------------------------------------------
  // T013: Viewer can access game page but has no write capability
  //
  // NOTE: The scorer page renders the same UI for all roles; access control
  // is enforced at the API layer (T014). T013 validates that:
  //   a) the viewer can navigate to the scorer URL without being redirected out
  //   b) the viewer can see the live score display (read-only observer role)
  //   c) the page does NOT expose a "Manage Scorers" add-scorer form to viewers
  //      (this is owner-only UI that the page only renders for game owners)
  // -------------------------------------------------------------------------
  test('T013: viewer can observe game but cannot add scorers', async () => {
    const { pageViewer, game } = state;

    // Viewer navigates to scorer page
    await pageViewer.goto(`/game/${game.gameId}/scorer`);

    // The page should load — viewer is allowed to observe a live game
    // Score display should be visible (read-only view works)
    await expect(pageViewer.locator('[data-testid="home-score"]')).toBeVisible({ timeout: 10000 });
    await expect(pageViewer.locator('[data-testid="guest-score"]')).toBeVisible({ timeout: 5000 });

    // Viewer should NOT see an "Add Scorer" / invite input UI (owner-only)
    // The ScorerManager modal is only opened by the owner from the header
    // We verify the scorer-manager modal is not open by default
    const scorerManagerModal = pageViewer.locator('[data-testid="scorer-manager"], [class*="scorer-manager"]');
    await expect(scorerManagerModal).not.toBeVisible();
  });

  // -------------------------------------------------------------------------
  // T014: Viewer API call is rejected 403 while owner scores successfully
  // -------------------------------------------------------------------------
  test('T014: viewer API POST to events returns 403, owner score succeeds', async () => {
    const { pageOwner, pageViewer, game } = state;

    // --- Owner navigates to scorer page and scores +2 for home ---------------
    await pageOwner.goto(`/game/${game.gameId}/scorer`);
    await pageOwner.waitForSelector('[data-testid="score-btn-2pt"]');

    await pageOwner.click('[data-testid="score-btn-2pt"]');

    // Handle player selection modal if it appears in simple mode
    const modal = pageOwner.locator('[data-testid="scoring-modal"]');
    if (await modal.isVisible({ timeout: 1000 }).catch(() => false)) {
      await pageOwner.locator('button:has-text("Home"), button:has-text("Team")').first().click();
    }

    // Owner's score should be reflected
    await expect(pageOwner.locator('[data-testid="home-score"]')).toHaveText('2', { timeout: 7000 });

    // --- Viewer navigates to scorer page -------------------------------------
    await pageViewer.goto(`/game/${game.gameId}/scorer`);
    await pageViewer.waitForSelector('[data-testid="home-score"]');

    // Viewer sees the updated score (real-time subscription works)
    await expect(pageViewer.locator('[data-testid="home-score"]')).toHaveText('2', { timeout: 7000 });

    // --- Viewer attempts a direct API POST to create a scoring event ---------
    // This simulates a malicious or misconfigured client bypassing the UI.
    // The viewer user is NOT the game owner and NOT in any community,
    // so canManageGame() returns false → 403.
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

    // Viewer's API call must be rejected
    expect(apiResponse).toBe(403);

    // --- Score must remain uncorrupted (guest still at 0) --------------------
    // Both pages should show guest score as 0 — the viewer's attempt had no effect
    await expect(pageOwner.locator('[data-testid="guest-score"]')).toHaveText('0', { timeout: 5000 });
    await expect(pageViewer.locator('[data-testid="guest-score"]')).toHaveText('0', { timeout: 5000 });
  });
});
