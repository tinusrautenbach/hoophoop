import { BrowserContext, Page } from '@playwright/test';
import { clerkSetup, setupClerkTestingToken, clerk } from '@clerk/testing/playwright';
import { createClerkClient } from '@clerk/backend';

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY ?? '',
});

/**
 * Call once in globalSetup or test.beforeAll to initialise the Clerk
 * testing-token machinery.  Safe to call multiple times.
 */
export async function setupClerk(): Promise<void> {
  await clerkSetup();
}

/**
 * Creates a real Clerk user for use in a single test run.
 * Returns the userId and a cleanup function that deletes the user.
 *
 * Email uses the format: `e2e-<prefix>-<timestamp>+clerk_test@hoophoop.invalid`
 * The `+clerk_test` suffix enables the email-code strategy in Clerk test mode.
 */
export async function createTestUser(
  emailPrefix: string
): Promise<{ userId: string; email: string; cleanup: () => Promise<void> }> {
  const email = `e2e-${emailPrefix}-${Date.now()}+clerk_test@example.com`;

  const user = await clerkClient.users.createUser({
    emailAddress: [email],
    password: 'E2eT3st!$Rand0m#99xZ',
    firstName: 'E2E',
    lastName: 'Test',
  });

  return {
    userId: user.id,
    email,
    cleanup: async () => {
      try {
        await clerkClient.users.deleteUser(user.id);
      } catch (err) {
        console.warn(`[E2E Auth] Failed to delete test user ${user.id}:`, err);
      }
    },
  };
}

/**
 * Signs in a Clerk user into the given Playwright page using the ticket strategy.
 * The page must have already called page.goto() to a public (non-protected) route
 * before this function is called.
 *
 * Uses `clerk.signIn` with `emailAddress` which internally creates a sign-in
 * token via the backend API and uses the ticket strategy - no UI interaction needed.
 */
export async function signInUser(page: Page, email: string): Promise<void> {
  await clerk.signIn({ page, emailAddress: email });
}

/**
 * Bypasses Clerk bot protection on the given browser context by injecting
 * a testing token as an extra HTTP header.  Call this once per context
 * before navigating to any protected page.
 */
export async function bypassBotProtection(context: BrowserContext): Promise<void> {
  await setupClerkTestingToken({ context });
}

/**
 * Signs a user out of the given Playwright page.
 */
export async function signOutUser(page: Page): Promise<void> {
  await clerk.signOut({ page });
}