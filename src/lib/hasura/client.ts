import { createClient, Client } from 'graphql-ws';

// GraphQL WebSocket client for Hasura subscriptions
let wsClient: Client | null = null;

// Token getter — injected by the app after Clerk initializes
let tokenGetter: (() => Promise<string | null>) | null = null;

/**
 * Register a function that returns the current Clerk session token.
 * Call this once from the root of the app (e.g. in a layout or provider)
 * after Clerk is ready.
 */
export function registerTokenGetter(getter: () => Promise<string | null>): void {
  tokenGetter = getter;
  // Do NOT dispose the existing ws client here — subscriptions already set up by the
  // useHasuraGame hook would be orphaned on the old client. The connectionParams callback
  // closes over `tokenGetter` by reference, so any new WS connection (after the current one
  // drops or reconnects) will automatically use the updated token.
}

async function getToken(): Promise<string | null> {
  if (tokenGetter) {
    const token = await tokenGetter();
    if (token) return token;
  }

  if (typeof window !== 'undefined') {
    const mockToken = (window as unknown as { __mockAuthToken?: string }).__mockAuthToken;
    if (mockToken) {
      return mockToken;
    }
  }

  return null;
}

function extractUserIdFromJwt(token: string): string | null {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return decoded.sub || decoded['x-hasura-user-id'] || null;
  } catch {
    return null;
  }
}

function getMockUserId(): string | null {
  if (typeof window !== 'undefined') {
    const mockId = (window as unknown as { __mockUserId?: string }).__mockUserId;
    if (mockId) {
      return mockId;
    }
  }
  return null;
}

export function getHasuraWsClient(): Client {
  if (!wsClient) {
    const hasuraUrl = process.env.NEXT_PUBLIC_HASURA_URL || 'http://localhost:8080/v1/graphql';
    // Convert HTTP URL to WebSocket URL
    const wsUrl = hasuraUrl.replace(/^http/, 'ws');

    wsClient = createClient({
      url: wsUrl,
      connectionParams: async () => {
        const token = await getToken();
        const isMockToken = token && token.includes('eyJhbGciOiJub25lI');
        const adminSecret = process.env.NEXT_PUBLIC_HASURA_ADMIN_SECRET;

        if (isMockToken && adminSecret) {
          return {
            'X-Hasura-Admin-Secret': adminSecret,
            'X-Hasura-User-Id': getMockUserId() || 'anonymous',
            'X-Hasura-Role': 'user',
          };
        }

        if (token && !isMockToken && adminSecret) {
          const userId = extractUserIdFromJwt(token);
          return {
            'X-Hasura-Admin-Secret': adminSecret,
            ...(userId ? { 'X-Hasura-User-Id': userId, 'X-Hasura-Role': 'user' } : {}),
          };
        }

        if (token && !isMockToken) {
          return { Authorization: `Bearer ${token}` };
        }

        return {};
      },
      retryAttempts: Infinity,
      retryWait: async (retries) => {
        // Exponential backoff with max 5 seconds
        const delay = Math.min(1000 * Math.pow(2, retries), 5000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      },
      on: {
        connected: () => {
          console.log('[Hasura] WebSocket connected');
        },
        closed: (event) => {
          console.log('[Hasura] WebSocket closed:', event);
        },
        error: (error) => {
          console.error('[Hasura] WebSocket error:', error);
        },
      },
    });
  }

  return wsClient;
}

// GraphQL query/mutation client using fetch
export async function graphqlRequest<T = unknown>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const hasuraUrl = process.env.NEXT_PUBLIC_HASURA_URL || 'http://localhost:8080/v1/graphql';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const token = await getToken();
  const isMockToken = token && token.includes('eyJhbGciOiJub25lI');
  const adminSecret = process.env.NEXT_PUBLIC_HASURA_ADMIN_SECRET;
  const serverHasuraSecret = process.env.HASURA_ADMIN_SECRET;

  if (!token && (adminSecret || serverHasuraSecret)) {
    headers['X-Hasura-Admin-Secret'] = (adminSecret || serverHasuraSecret)!;
    headers['X-Hasura-Role'] = 'user';
  } else if (isMockToken && adminSecret) {
    headers['X-Hasura-Admin-Secret'] = adminSecret;
    headers['X-Hasura-User-Id'] = getMockUserId() || 'anonymous';
    headers['X-Hasura-Role'] = 'user';
  } else if (token && !isMockToken && adminSecret) {
    const userId = extractUserIdFromJwt(token);
    headers['X-Hasura-Admin-Secret'] = adminSecret;
    if (userId) {
      headers['X-Hasura-User-Id'] = userId;
      headers['X-Hasura-Role'] = 'user';
    }
  } else if (token && !isMockToken) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(hasuraUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  if (!response.ok) {
    throw new Error(`GraphQL request failed: ${response.statusText}`);
  }

  const result = await response.json();

  if (result.errors) {
    throw new Error(result.errors[0]?.message || 'GraphQL error');
  }

  return result.data as T;
}

// Close WebSocket connection (useful for cleanup)
export function closeHasuraConnection(): void {
  if (wsClient) {
    wsClient.dispose();
    wsClient = null;
  }
}
