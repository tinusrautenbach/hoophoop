// Mock server auth to avoid Clerk initialization errors in dev
export async function auth() {
    return {
        userId: 'user_mock_123',
        sessionId: 'sess_mock_123',
    };
}
