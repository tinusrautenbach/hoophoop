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
  // Reset the ws client so it reconnects with fresh auth on next use
  if (wsClient) {
    wsClient.dispose();
    wsClient = null;
  }
}

async function getToken(): Promise<string | null> {
  if (tokenGetter) {
    return tokenGetter();
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
        if (token) {
          return {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          };
        }
        // No token — connect as anonymous (read-only public game data only)
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

  // Prefer user JWT over admin secret — admin secret is a server-side fallback only
  const token = await getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else {
    // Server-side usage (e.g. scripts, migrations) — never expose in client bundle
    const adminSecret =
      typeof window === 'undefined'
        ? process.env.HASURA_ADMIN_SECRET
        : undefined;
    if (adminSecret) {
      headers['X-Hasura-Admin-Secret'] = adminSecret;
    }
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
