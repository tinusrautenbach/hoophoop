import { BrowserContext, Page } from '@playwright/test';

let mockUserCounter = 0;

const MOCK_USERS = [
  { userId: 'user_e2e_owner_001', email: 'e2e-owner@test.com', firstName: 'E2E', lastName: 'Owner' },
  { userId: 'user_e2e_scorer_002', email: 'e2e-scorer@test.com', firstName: 'E2E', lastName: 'Scorer' },
  { userId: 'user_e2e_viewer_003', email: 'e2e-viewer@test.com', firstName: 'E2E', lastName: 'Viewer' },
];

export async function createTestUser(
  _role: 'owner' | 'scorer' | 'viewer'
): Promise<{ userId: string; email: string; cleanup: () => Promise<void> }> {
  mockUserCounter++;
  const userIndex = (mockUserCounter - 1) % 3;
  const mockUser = MOCK_USERS[userIndex];

  return {
    userId: mockUser.userId,
    email: mockUser.email,
    cleanup: async () => {
      console.log(`[E2E Auth] Test complete for user ${mockUser.userId}`);
    },
  };
}

function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function createMockToken(userId: string): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const payload = base64UrlEncode(JSON.stringify({
    sub: userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    'https://hasura.io/jwt/claims': {
      'x-hasura-user-id': userId,
      'x-hasura-default-role': 'user',
      'x-hasura-allowed-roles': ['user'],
    },
  }));
  return `${header}.${payload}.`;
}

export async function setupMockAuth(context: BrowserContext, userId: string): Promise<void> {
  const mockToken = createMockToken(userId);

  await context.setExtraHTTPHeaders({
    'x-test-auth': 'true',
    'x-test-user-id': userId,
  });

  await context.addCookies([
    {
      name: '__mock_auth',
      value: 'true',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
    },
    {
      name: '__mock_user_id',
      value: userId,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
    },
    {
      name: '__mock_token',
      value: mockToken,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
    },
  ]);

  await context.addInitScript(
    ({ token, userId }: { token: string; userId: string }) => {
      (window as unknown as { __mockAuthToken?: string; __mockUserId?: string }).__mockAuthToken = token;
      (window as unknown as { __mockAuthToken?: string; __mockUserId?: string }).__mockUserId = userId;
    },
    { token: mockToken, userId }
  );
}

export async function bypassBotProtection(context: BrowserContext): Promise<void> {
  await context.setExtraHTTPHeaders({
    'x-test-auth': 'true',
  });
}

export async function signInUser(page: Page, email: string): Promise<void> {
  const user = MOCK_USERS.find(u => u.email === email);
  if (!user) {
    throw new Error(`Mock user not found for email: ${email}`);
  }

  await page.context().addCookies([
    {
      name: '__mock_auth',
      value: 'true',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
    },
    {
      name: '__mock_user_id',
      value: user.userId,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
    },
  ]);
}

export async function signOutUser(page: Page): Promise<void> {
  await page.context().clearCookies();
}

export async function setupClerk(): Promise<void> {
  console.log('[E2E] Using mock authentication (Clerk bypassed)');
}

export async function getCookieHeader(cookies: Array<{ name: string; value: string }>): Promise<string> {
  return cookies.map(c => `${c.name}=${c.value}`).join('; ');
}
