import { createClient, Client } from 'graphql-ws';

// GraphQL WebSocket client for Hasura subscriptions
let wsClient: Client | null = null;

export function getHasuraWsClient(): Client {
  if (!wsClient) {
    const hasuraUrl = process.env.NEXT_PUBLIC_HASURA_URL || 'http://localhost:8080/v1/graphql';
    // Convert HTTP URL to WebSocket URL
    const wsUrl = hasuraUrl.replace(/^http/, 'ws');

    wsClient = createClient({
      url: wsUrl,
      connectionParams: () => {
        // Public access for now - no auth required
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
  const adminSecret = process.env.NEXT_PUBLIC_HASURA_ADMIN_SECRET || process.env.HASURA_ADMIN_SECRET;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (adminSecret) {
    headers['X-Hasura-Admin-Secret'] = adminSecret;
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
