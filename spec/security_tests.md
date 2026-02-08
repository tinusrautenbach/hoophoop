# Security Testing Plan - Basketball Scoring Application

## Executive Summary

This document outlines a comprehensive, repeatable security testing plan for the basketball scoring web application. The plan covers all critical security domains including authentication, authorization, API security, data protection, and infrastructure security.

**Test Execution Frequency:**
- **Full Security Audit**: Monthly
- **Automated Security Tests**: Every commit (CI/CD)
- **Penetration Testing**: Quarterly
- **Dependency Scanning**: Weekly

---

## 1. Application Overview

**Technology Stack:**
- Next.js 16.1.6 (App Router)
- TypeScript 5 with Strict Mode
- PostgreSQL 16 with Drizzle ORM
- Socket.IO 4.8.3 (WebSocket real-time)
- Clerk Authentication (@clerk/nextjs)
- Docker containerization

**Key Security Components:**
- REST API endpoints (20+ routes)
- WebSocket real-time events
- Multi-user role system (admin, scorer, viewer)
- Resource ownership model
- Community-based access control

---

## 2. Security Test Categories

### 2.1 Authentication & Authorization Tests

#### 2.1.1 Authentication Bypass Testing

**Objective:** Verify that all protected routes require valid authentication

**Test Cases:**
```typescript
// Test: Unauthenticated access to protected endpoints
const protectedEndpoints = [
  { method: 'POST', url: '/api/teams', data: { name: 'Test' } },
  { method: 'POST', url: '/api/games', data: { homeTeamId: 1, awayTeamId: 2 } },
  { method: 'POST', url: '/api/communities', data: { name: 'Test' } },
  { method: 'PATCH', url: '/api/games/123', data: { score: 10 } },
  { method: 'DELETE', url: '/api/teams/123' },
  { method: 'POST', url: '/api/athletes', data: { firstName: 'John' } },
];

// Expected: All return 401 Unauthorized
```

**Checks:**
- [ ] POST /api/teams without auth -> 401
- [ ] POST /api/games without auth -> 401
- [ ] POST /api/communities without auth -> 401
- [ ] PATCH /api/games/[id] without auth -> 401
- [ ] DELETE /api/teams/[id] without auth -> 401
- [ ] POST /api/athletes without auth -> 401
- [ ] GET /api/teams (list) without auth -> 401 (if required)
- [ ] WebSocket connection without auth -> Rejected

#### 2.1.2 Mock Authentication Security

**Objective:** Ensure mock auth cannot be enabled in production

**Test Cases:**
```typescript
// Test: Verify production uses real Clerk auth
process.env.NODE_ENV = 'production';
process.env.NEXT_PUBLIC_USE_MOCK_AUTH = 'true'; // Attempt to enable mock

// Expected: Application should refuse to start or ignore mock setting
```

**Checks:**
- [ ] Mock auth rejected in production environment
- [ ] Environment variable cannot override in production
- [ ] Real Clerk keys required for startup in production
- [ ] Test credentials detected and blocked

#### 2.1.3 Resource Ownership Verification

**Objective:** Users can only access/modify their own resources

**Test Cases:**
```typescript
// Test: User A attempts to modify User B's resources
const userA = { userId: 'user_a_123', token: 'token_a' };
const userB = { userId: 'user_b_456', token: 'token_b' };

// Create resource as User B
const teamB = await createTeam(userB.token, { name: 'User B Team' });

// Attempt to modify as User A
const response = await fetch(`/api/teams/${teamB.id}`, {
  method: 'PATCH',
  headers: { Authorization: `Bearer ${userA.token}` },
  body: JSON.stringify({ name: 'Hacked' })
});

// Expected: 403 Forbidden
```

**Test Resources:**
- [ ] Teams (GET, PATCH, DELETE)
- [ ] Games (GET, PATCH, DELETE)
- [ ] Communities (GET, PATCH, DELETE)
- [ ] Athletes (GET, PATCH, DELETE)
- [ ] Game events (POST, PATCH, DELETE)
- [ ] Roster members (POST, DELETE)
- [ ] Community members (DELETE)

#### 2.1.4 Role-Based Access Control (RBAC)

**Objective:** Verify role permissions are enforced

**Test Cases:**
```typescript
// Community roles: admin, scorer, viewer
const communityTests = [
  { role: 'viewer', action: 'DELETE /api/communities/[id]', expect: 403 },
  { role: 'viewer', action: 'PATCH /api/communities/[id]', expect: 403 },
  { role: 'scorer', action: 'DELETE /api/communities/[id]', expect: 403 },
  { role: 'viewer', action: 'DELETE /api/communities/[id]/members/[id]', expect: 403 },
];

// Game scorer roles: owner, co_scorer, viewer
const gameScorerTests = [
  { role: 'viewer', action: 'timer-control', expect: 'rejected' },
  { role: 'co_scorer', action: 'timer-control', expect: 'allowed' },
  { role: 'viewer', action: 'add-event', expect: 'rejected' },
];
```

**Checks:**
- [ ] Viewer cannot delete communities
- [ ] Viewer cannot modify community settings
- [ ] Only admin can remove members
- [ ] Only owner can delete community
- [ ] Game viewers cannot control timer
- [ ] Game viewers cannot add events
- [ ] Co-scorers can add events
- [ ] Only owner can add/remove scorers

#### 2.1.5 Session Management

**Objective:** Verify secure session handling

**Test Cases:**
```typescript
// Test: Session expiration
const expiredToken = generateExpiredToken();
const response = await fetch('/api/teams', {
  headers: { Authorization: `Bearer ${expiredToken}` }
});
// Expected: 401 Unauthorized

// Test: Token revocation
await revokeToken(validToken);
const response2 = await fetch('/api/teams', {
  headers: { Authorization: `Bearer ${validToken}` }
});
// Expected: 401 Unauthorized
```

**Checks:**
- [ ] Expired tokens rejected
- [ ] Revoked tokens rejected
- [ ] Session timeout enforced
- [ ] Concurrent session limits (if applicable)
- [ ] Secure session storage (httpOnly, secure, sameSite)

---

### 2.2 API Security Tests

#### 2.2.1 Rate Limiting

**Objective:** Prevent API abuse and DoS attacks

**Test Cases:**
```typescript
// Test: Rapid request detection
const burstRequests = Array(100).fill(null).map(() => 
  fetch('/api/teams', { method: 'GET' })
);
const responses = await Promise.all(burstRequests);

// Check for rate limiting responses (429 Too Many Requests)
const rateLimited = responses.filter(r => r.status === 429);
// Expected: >50% should be rate limited after threshold

// Test: Authentication endpoint protection
const authAttempts = Array(20).fill(null).map((_, i) => 
  fetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: `user${i}@test.com`, password: 'wrong' })
  })
);
// Expected: Account lockout or progressive delays after N attempts
```

**Rate Limits to Test:**
- [ ] General API: 100 requests per minute per user
- [ ] Authentication: 5 attempts per minute per IP
- [ ] Game events: 60 per minute per game (prevent spam)
- [ ] Team/Community creation: 10 per hour per user
- [ ] WebSocket connections: 10 per minute per IP

#### 2.2.2 Input Validation & Sanitization

**Objective:** Prevent injection attacks and malformed data

**Test Cases:**
```typescript
// SQL Injection Tests
const sqlInjectionPayloads = [
  "'; DROP TABLE users; --",
  "' OR '1'='1",
  "'; DELETE FROM games WHERE '1'='1",
  "1; SELECT * FROM users",
  "admin'--",
  "' OR 1=1#",
];

// Test each endpoint with SQL injection
for (const payload of sqlInjectionPayloads) {
  await testEndpoint('/api/teams', { name: payload });
  await testEndpoint('/api/games', { description: payload });
  await testEndpoint('/api/communities', { name: payload });
}
// Expected: No database errors, data sanitized or rejected

// XSS Injection Tests
const xssPayloads = [
  '<script>alert("xss")</script>',
  '<img src=x onerror=alert("xss")>',
  'javascript:alert("xss")',
  '<svg onload=alert("xss")>',
  '\\" onclick=alert("xss")',
];

// Test stored XSS
for (const payload of xssPayloads) {
  const response = await fetch('/api/teams', {
    method: 'POST',
    body: JSON.stringify({ name: payload, description: payload })
  });
  const data = await response.json();
  
  // Retrieve and verify content is escaped
  const getResponse = await fetch(`/api/teams/${data.id}`);
  const team = await getResponse.json();
  // Expected: Script tags escaped/removed, not executed
}
```

**Injection Points to Test:**
- [ ] Team name, description
- [ ] Athlete firstName, lastName
- [ ] Game notes, description
- [ ] Community name, description
- [ ] Player jersey numbers
- [ ] Search query parameters
- [ ] URL path parameters (ID values)

#### 2.2.3 Mass Assignment Prevention

**Objective:** Prevent users from modifying unauthorized fields

**Test Cases:**
```typescript
// Test: Attempt to modify read-only fields
const maliciousPayload = {
  name: 'Valid Name',
  ownerId: 'hacker_user_id', // Should be ignored
  createdAt: '2020-01-01', // Should be ignored
  id: 99999, // Should be ignored
  score: 1000, // Attempt to modify game score directly
};

const response = await fetch('/api/teams', {
  method: 'POST',
  body: JSON.stringify(maliciousPayload)
});

// Verify: ownerId should be set to authenticated user, not payload
const createdTeam = await response.json();
assert(createdTeam.ownerId === authenticatedUserId);
assert(createdTeam.id !== 99999);
```

**Fields to Protect:**
- [ ] ownerId on all resources
- [ ] createdAt, updatedAt timestamps
- [ ] id fields (auto-generated)
- [ ] Internal status fields
- [ ] Score fields (should only update via events)

#### 2.2.4 API Endpoint Enumeration

**Objective:** Prevent information disclosure through error messages

**Test Cases:**
```typescript
// Test: Invalid endpoint error messages
const response = await fetch('/api/nonexistent-endpoint');
// Expected: Generic 404, no stack trace or internal details

// Test: Invalid resource IDs
const response2 = await fetch('/api/teams/999999999');
// Expected: 404 Not Found, not "database connection error" or SQL details

// Test: Method not allowed
const response3 = await fetch('/api/teams', { method: 'PUT' });
// Expected: 405 Method Not Allowed, minimal error details
```

**Error Handling Checks:**
- [ ] No stack traces in production responses
- [ ] No SQL error messages exposed
- [ ] No internal path disclosure
- [ ] Consistent error response format
- [ ] Sensitive data not included in errors

---

### 2.3 WebSocket (Socket.IO) Security Tests

#### 2.3.1 Connection Authentication

**Objective:** Verify WebSocket connections require authentication

**Test Cases:**
```typescript
// Test: Unauthenticated connection attempt
const socket = io('ws://localhost:3000');
await new Promise((resolve) => {
  socket.on('connect_error', (error) => {
    assert(error.message.includes('authentication'));
    resolve();
  });
});

// Test: Invalid token
const socket2 = io('ws://localhost:3000', {
  auth: { token: 'invalid_token' }
});
// Expected: Connection rejected
```

**Checks:**
- [ ] Unauthenticated connections rejected
- [ ] Invalid tokens rejected
- [ ] Expired tokens rejected
- [ ] Authentication required before joining rooms

#### 2.3.2 Room Authorization

**Objective:** Users can only join authorized game rooms

**Test Cases:**
```typescript
// Test: Join game without permission
const socket = authenticatedSocket(userA);
socket.emit('join-game', { gameId: gameB.id }); // User A not authorized for Game B
// Expected: join-error event or rejection

// Test: Listen to other users' games
socket.emit('join-game', { gameId: gameC.id }); // Not a scorer or member
// Expected: Rejected or spectator-only mode enforced
```

**Checks:**
- [ ] Cannot join arbitrary game rooms
- [ ] Game membership verified on join
- [ ] Spectator role enforced (view-only)
- [ ] Room isolation maintained (no cross-game data)

#### 2.3.3 Event Authorization

**Objective:** Only authorized users can send game control events

**Test Cases:**
```typescript
// Test: Unauthorized timer control
const viewerSocket = authenticatedSocket(gameViewer);
viewerSocket.emit('timer-control', { gameId: game.id, action: 'start' });
// Expected: Event rejected, no broadcast

// Test: Unauthorized game state modification
const spectatorSocket = authenticatedSocket(spectator);
spectatorSocket.emit('update-game', { gameId: game.id, score: 100 });
// Expected: Event rejected

// Test: Event spoofing (wrong game ID)
const scorerSocket = authenticatedSocket(scorer);
scorerSocket.emit('add-event', { gameId: otherGame.id, type: 'score' });
// Expected: Rejected (cannot modify other games)
```

**Events to Test:**
- [ ] timer-control (start, stop)
- [ ] update-game
- [ ] add-event
- [ ] undo-event (if implemented)
- [ ] update-score

#### 2.3.4 Rate Limiting (WebSocket)

**Objective:** Prevent event spam and DoS via WebSocket

**Test Cases:**
```typescript
// Test: Event flooding
const socket = authenticatedSocket(scorer);
for (let i = 0; i < 1000; i++) {
  socket.emit('add-event', { gameId: game.id, type: 'score' });
}
// Expected: Rate limit applied, connection throttled or disconnected

// Test: Connection flooding
for (let i = 0; i < 50; i++) {
  const s = authenticatedSocket(user);
  s.emit('join-game', { gameId: game.id });
}
// Expected: Connection limit enforced per user/IP
```

**Limits:**
- [ ] Max 60 events per minute per game per user
- [ ] Max 10 concurrent connections per user
- [ ] Max 1000 events per game total (flood protection)

---

### 2.4 Data Protection Tests

#### 2.4.1 Sensitive Data Exposure

**Objective:** Ensure sensitive data is not exposed in API responses

**Test Cases:**
```typescript
// Test: User data exposure
const response = await fetch('/api/teams/123');
const team = await response.json();
// Verify: No user emails, passwords, internal IDs exposed
assert(!team.ownerEmail);
assert(!team.internalNotes);

// Test: Community member list
const response2 = await fetch('/api/communities/123/members');
const members = await response2.json();
// Verify: Minimal user data, no sensitive fields
for (const member of members) {
  assert(!member.userEmail);
  assert(!member.userPhone);
}
```

**Data to Protect:**
- [ ] User email addresses
- [ ] Clerk user IDs (internal)
- [ ] Database connection strings
- [ ] Secret keys and tokens
- [ ] Server-side error details
- [ ] Internal system paths

#### 2.4.2 Data Integrity Tests

**Objective:** Ensure data consistency and prevent corruption

**Test Cases:**
```typescript
// Test: Concurrent modification
const game = await createGame(user, { homeScore: 0 });

// Simultaneous updates
const update1 = fetch(`/api/games/${game.id}`, {
  method: 'PATCH',
  body: JSON.stringify({ homeScore: 10 })
});
const update2 = fetch(`/api/games/${game.id}`, {
  method: 'PATCH',
  body: JSON.stringify({ homeScore: 20 })
});

await Promise.all([update1, update2]);
const finalGame = await fetch(`/api/games/${game.id}`).then(r => r.json());
// Expected: Consistent state (one update applied, other rejected or sequential)

// Test: Foreign key constraints
await fetch('/api/games', {
  method: 'POST',
  body: JSON.stringify({ homeTeamId: 999999, awayTeamId: 888888 })
});
// Expected: 400 Bad Request - invalid team IDs
```

**Integrity Checks:**
- [ ] Foreign key constraint enforcement
- [ ] Transaction rollback on errors
- [ ] Optimistic locking (version numbers)
- [ ] Data type validation
- [ ] Required field enforcement

---

### 2.5 Infrastructure Security Tests

#### 2.5.1 Security Headers

**Objective:** Verify security headers are present and correct

**Test Cases:**
```typescript
const response = await fetch('/');
const headers = response.headers;

// Required Security Headers
assert(headers.get('X-Content-Type-Options') === 'nosniff');
assert(headers.get('X-Frame-Options') === 'DENY' || headers.get('X-Frame-Options') === 'SAMEORIGIN');
assert(headers.get('X-XSS-Protection') === '1; mode=block');
assert(headers.get('Referrer-Policy') === 'strict-origin-when-cross-origin');
assert(headers.get('Content-Security-Policy'));
assert(headers.get('Strict-Transport-Security')); // HSTS

// API Response Headers
const apiResponse = await fetch('/api/teams');
assert(!apiResponse.headers.get('X-Powered-By')); // No server info disclosure
assert(apiResponse.headers.get('Cache-Control')); // Appropriate caching
```

**Required Headers:**
- [ ] Content-Security-Policy
- [ ] X-Content-Type-Options: nosniff
- [ ] X-Frame-Options: DENY
- [ ] X-XSS-Protection: 1; mode=block
- [ ] Strict-Transport-Security (HSTS)
- [ ] Referrer-Policy: strict-origin-when-cross-origin
- [ ] Permissions-Policy
- [ ] Remove: X-Powered-By, Server fingerprints

#### 2.5.2 HTTPS Enforcement

**Objective:** Ensure all traffic uses HTTPS in production

**Test Cases:**
```typescript
// Test: HTTP request redirect
const httpResponse = await fetch('http://production-site.com/', { redirect: 'manual' });
assert(httpResponse.status === 301 || httpResponse.status === 308);
assert(httpResponse.headers.get('location').startsWith('https://'));

// Test: HSTS header
const httpsResponse = await fetch('https://production-site.com/');
const hsts = httpsResponse.headers.get('Strict-Transport-Security');
assert(hsts.includes('max-age='));
assert(hsts.includes('includeSubDomains'));
```

**Checks:**
- [ ] HTTP to HTTPS redirect (301/308)
- [ ] HSTS with max-age >= 31536000 (1 year)
- [ ] includeSubDomains directive
- [ ] No mixed content warnings
- [ ] Secure cookies (Secure, HttpOnly, SameSite)

#### 2.5.3 CORS Configuration

**Objective:** Verify CORS policy is restrictive

**Test Cases:**
```typescript
// Test: Cross-origin request from unauthorized domain
const corsResponse = await fetch('https://evil-site.com', {
  method: 'OPTIONS',
  headers: {
    'Origin': 'https://evil-site.com',
    'Access-Control-Request-Method': 'POST'
  }
});
// Expected: No Access-Control-Allow-Origin header or not matching evil-site

// Test: Allowed origins
const allowedResponse = await fetch('https://production-site.com', {
  method: 'OPTIONS',
  headers: {
    'Origin': 'https://app.yourdomain.com',
    'Access-Control-Request-Method': 'POST'
  }
});
// Expected: Access-Control-Allow-Origin matches request
```

**CORS Policy:**
- [ ] Specific allowed origins (not '*')
- [ ] Allowed methods limited to required (GET, POST, PATCH, DELETE)
- [ ] Credentials not exposed to all origins
- [ ] Preflight requests handled correctly
- [ ] No sensitive data in CORS-exposed headers

#### 2.5.4 Secret Management

**Objective:** Verify secrets are properly protected

**Test Cases:**
```typescript
// Test: Environment variable exposure
const response = await fetch('/api/debug'); // If exists
// Expected: 404 or no secret exposure

// Test: Client-side secret leakage
const html = await fetch('/').then(r => r.text());
assert(!html.includes('CLERK_SECRET_KEY'));
assert(!html.includes('DATABASE_URL'));
assert(!html.includes('sk_test_')); // No secret keys in client
assert(!html.includes('postgres://')); // No DB URLs

// Test: Source map exposure
const sourceMap = await fetch('/_next/static/...js.map');
// Expected: 404 or access denied in production
```

**Secret Checks:**
- [ ] No secrets in client-side code
- [ ] No secrets in API responses
- [ ] No secrets in error messages
- [ ] Environment variables not exposed
- [ ] Source maps disabled in production
- [ ] Debug endpoints disabled
- [ ] No hardcoded credentials

---

### 2.6 Dependency Security Tests

#### 2.6.1 Vulnerability Scanning

**Objective:** Identify known vulnerabilities in dependencies

**Commands:**
```bash
# NPM audit
npm audit --audit-level=moderate

# Alternative tools
yarn audit
pnpm audit

# Snyk scanning
npx snyk test

# OWASP Dependency Check
npx dependency-check --project bball --scan ./
```

**Checks:**
- [ ] No high or critical severity vulnerabilities
- [ ] Dependencies updated within 30 days
- [ ] No deprecated packages
- [ ] License compliance verified
- [ ] Supply chain security (verified publishers)

#### 2.6.2 Dependency Confusion Prevention

**Objective:** Prevent dependency confusion attacks

**Checks:**
- [ ] `.npmrc` with scope registry definitions
- [ ] No internal package names on public registry
- [ ] Lock files (package-lock.json) committed
- [ ] Integrity hashes verified
- [ ] Private registry configured for internal packages

---

## 3. Security Test Implementation

### 3.1 Test File Structure

Create the following test files:

```
src/
├── security/
│   ├── __tests__/
│   │   ├── authentication.test.ts      # Auth bypass, session tests
│   │   ├── authorization.test.ts     # RBAC, ownership tests
│   │   ├── api-security.test.ts        # Rate limiting, input validation
│   │   ├── websocket-security.test.ts  # Socket.IO security
│   │   ├── data-protection.test.ts     # Sensitive data exposure
│   │   └── infrastructure.test.ts      # Headers, HTTPS, CORS
│   ├── utils/
│   │   ├── security-helpers.ts         # Test utilities
│   │   └── attack-payloads.ts          # Injection payloads
│   └── config/
│       └── security-config.ts          # Test configuration
```

### 3.2 Test Utilities

**security-helpers.ts:**
```typescript
export async function testAuthBypass(
  method: string, 
  endpoint: string, 
  data?: object
): Promise<boolean> {
  const response = await fetch(endpoint, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: data ? JSON.stringify(data) : undefined
  });
  return response.status === 401;
}

export async function testSqlInjection(
  endpoint: string,
  field: string,
  method: string = 'POST'
): Promise<boolean> {
  const payloads = [
    "'; DROP TABLE users; --",
    "' OR '1'='1",
    "1; SELECT * FROM users",
  ];
  
  for (const payload of payloads) {
    const response = await fetch(endpoint, {
      method,
      body: JSON.stringify({ [field]: payload })
    });
    
    const text = await response.text();
    if (text.includes('SQL') || text.includes('syntax')) {
      return false; // SQL error exposed
    }
  }
  return true;
}

export async function testRateLimit(
  endpoint: string,
  requests: number,
  windowMs: number
): Promise<{ limited: number; total: number }> {
  const start = Date.now();
  const promises = Array(requests).fill(null).map(() => 
    fetch(endpoint)
  );
  
  const responses = await Promise.all(promises);
  const limited = responses.filter(r => r.status === 429).length;
  
  return { limited, total: requests };
}

export function generateExpiredToken(): string {
  // Generate token with past expiration
  return 'expired_token_test';
}

export function createAuthenticatedSocket(
  token: string, 
  gameId: string
): Socket {
  return io('ws://localhost:3000', {
    auth: { token },
    query: { gameId }
  });
}
```

**attack-payloads.ts:**
```typescript
export const SQL_INJECTION_PAYLOADS = [
  "'; DROP TABLE users; --",
  "' OR '1'='1",
  "' OR 1=1--",
  "' OR '1'='1' --",
  "'; DELETE FROM games WHERE '1'='1",
  "1 UNION SELECT * FROM users",
  "admin'--",
  "' OR 1=1#",
  "'; TRUNCATE TABLE teams; --",
];

export const XSS_PAYLOADS = [
  '<script>alert("xss")</script>',
  '<img src=x onerror=alert("xss")>',
  'javascript:alert("xss")',
  '<svg onload=alert("xss")>',
  '\\" onclick=alert("xss")',
  '<iframe src=javascript:alert("xss")>',
  '<body onload=alert("xss")>',
];

export const NOSQL_INJECTION_PAYLOADS = [
  '{ "$gt": "" }',
  '{ "$ne": null }',
  '{ "$regex": ".*" }',
];

export const PATH_TRAVERSAL_PAYLOADS = [
  '../../../etc/passwd',
  '..\\..\\..\\windows\\system32\\config\\sam',
  '....//....//....//etc/passwd',
  '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
];

export const COMMAND_INJECTION_PAYLOADS = [
  '; cat /etc/passwd',
  '| whoami',
  '$(id)',
  '`ls -la`',
  '|| dir',
];
```

### 3.3 Automated Security Test Suite

**security-test-suite.ts:**
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { testAuthBypass, testSqlInjection, testRateLimit } from './utils/security-helpers';

// Configuration
const API_BASE = process.env.TEST_API_URL || 'http://localhost:3000';
const WS_BASE = process.env.TEST_WS_URL || 'ws://localhost:3000';

// Test data
const testUsers = {
  userA: { id: 'user_a_test', token: 'token_a_test' },
  userB: { id: 'user_b_test', token: 'token_b_test' },
  admin: { id: 'admin_test', token: 'token_admin_test' },
};

describe('Security Test Suite', () => {
  beforeAll(async () => {
    // Setup test database
    // Create test users and resources
  });

  afterAll(async () => {
    // Cleanup test data
  });

  describe('Authentication Tests', () => {
    it('should reject unauthenticated requests to protected endpoints', async () => {
      const endpoints = [
        { method: 'POST', url: `${API_BASE}/api/teams` },
        { method: 'POST', url: `${API_BASE}/api/games` },
        { method: 'POST', url: `${API_BASE}/api/communities` },
      ];

      for (const endpoint of endpoints) {
        const isBlocked = await testAuthBypass(
          endpoint.method, 
          endpoint.url, 
          { name: 'test' }
        );
        expect(isBlocked).toBe(true);
      }
    });

    it('should enforce resource ownership', async () => {
      // Create resource as User B
      const teamB = await createTeam(testUsers.userB.token, { name: 'User B Team' });

      // Attempt to modify as User A
      const response = await fetch(`${API_BASE}/api/teams/${teamB.id}`, {
        method: 'PATCH',
        headers: { 
          'Authorization': `Bearer ${testUsers.userA.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: 'Hacked' })
      });

      expect(response.status).toBe(403);
    });
  });

  describe('Input Validation Tests', () => {
    it('should prevent SQL injection in all input fields', async () => {
      const endpoints = [
        { url: `${API_BASE}/api/teams`, field: 'name' },
        { url: `${API_BASE}/api/communities`, field: 'name' },
        { url: `${API_BASE}/api/athletes`, field: 'firstName' },
      ];

      for (const endpoint of endpoints) {
        const isSecure = await testSqlInjection(endpoint.url, endpoint.field);
        expect(isSecure).toBe(true);
      }
    });

    it('should sanitize XSS payloads', async () => {
      const xssPayload = '<script>alert("xss")</script>';
      
      const response = await fetch(`${API_BASE}/api/teams`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${testUsers.userA.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: xssPayload })
      });

      const team = await response.json();
      expect(team.name).not.toContain('<script>');
    });
  });

  describe('Rate Limiting Tests', () => {
    it('should enforce rate limits on API endpoints', async () => {
      const { limited, total } = await testRateLimit(
        `${API_BASE}/api/teams`,
        150,
        60000
      );

      expect(limited).toBeGreaterThan(0);
      expect(limited / total).toBeGreaterThan(0.3);
    });
  });

  describe('Infrastructure Security Tests', () => {
    it('should have required security headers', async () => {
      const response = await fetch(`${API_BASE}/`);
      const headers = response.headers;

      expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(headers.get('X-Frame-Options')).toMatch(/DENY|SAMEORIGIN/);
      expect(headers.get('Content-Security-Policy')).toBeTruthy();
    });

    it('should not expose sensitive information in errors', async () => {
      const response = await fetch(`${API_BASE}/api/teams/999999999`);
      const text = await response.text();

      expect(text).not.toContain('SQL');
      expect(text).not.toContain('database');
      expect(text).not.toContain('syntax');
      expect(text).not.toContain('stack');
    });
  });
});
```

---

## 4. Security Test Execution

### 4.1 Running Security Tests

**Local Development:**
```bash
# Run all security tests
npm run test:security

# Run specific security test category
npm run test:security:auth
npm run test:security:api
npm run test:security:websocket

# Run with coverage
npm run test:security -- --coverage

# Run in CI mode
npm run test:security -- --run
```

**Package.json scripts:**
```json
{
  "scripts": {
    "test:security": "vitest run src/security/__tests__",
    "test:security:auth": "vitest run src/security/__tests__/authentication.test.ts",
    "test:security:api": "vitest run src/security/__tests__/api-security.test.ts",
    "test:security:watch": "vitest src/security/__tests__",
    "security:audit": "npm audit --audit-level=moderate",
    "security:scan": "npx snyk test && npm audit"
  }
}
```

### 4.2 CI/CD Integration

**GitHub Actions Workflow (.github/workflows/security.yml):**
```yaml
name: Security Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]
  schedule:
    # Run daily at 2 AM
    - cron: '0 2 * * *'

jobs:
  security-tests:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run database migrations
      run: npm run db:migrate
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/bball
    
    - name: Run security tests
      run: npm run test:security
      env:
        NODE_ENV: test
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/bball
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: ${{ secrets.CLERK_PUBLISHABLE_KEY }}
        CLERK_SECRET_KEY: ${{ secrets.CLERK_SECRET_KEY }}
    
    - name: Run dependency audit
      run: npm audit --audit-level=moderate
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        files: ./coverage/lcov.info
        flags: security
        name: security-tests
```

### 4.3 Docker Security Testing

**Docker Security Scan:**
```bash
# Build production image
docker build -t bball-security-test .

# Scan with Trivy
trivy image bball-security-test

# Scan with Docker Scout
docker scout cves bball-security-test

# Check for secrets in image
docker run --rm bball-security-test cat /app/.env 2>/dev/null || echo "Good: No .env in image"
```

**Docker Security Test Script:**
```bash
#!/bin/bash
# docker-security-test.sh

echo "Running Docker Security Tests..."

# Test 1: Non-root user
echo "Test: Checking for non-root user..."
docker run --rm bball-security-test id | grep -v "uid=0(root)" || exit 1

# Test 2: No secrets in image
echo "Test: Checking for secrets in image..."
! docker run --rm bball-security-test ls /app/.env 2>/dev/null || exit 1
! docker run --rm bball-security-test ls /app/.env.local 2>/dev/null || exit 1

# Test 3: Minimal attack surface
echo "Test: Checking for unnecessary packages..."
docker run --rm bball-security-test which curl || true
docker run --rm bball-security-test which wget || true

# Test 4: Health check exists
echo "Test: Checking for health check..."
docker inspect bball-security-test --format='{{.Config.Healthcheck}}' | grep -v "<nil>" || exit 1

echo "All Docker security tests passed!"
```

---

## 5. Security Monitoring & Incident Response

### 5.1 Security Monitoring

**Application Monitoring:**
```typescript
// security-logger.ts
export function logSecurityEvent(
  event: string, 
  details: object, 
  severity: 'low' | 'medium' | 'high' | 'critical'
) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event,
    details,
    severity,
    userId: details.userId,
    ip: details.ip,
    userAgent: details.userAgent,
  };

  // Send to security monitoring service
  console.error(`[SECURITY] ${severity.toUpperCase()}: ${event}`, logEntry);
  
  // Send to external monitoring (PagerDuty, Datadog, etc.)
  if (severity === 'high' || severity === 'critical') {
    alertSecurityTeam(logEntry);
  }
}

// Usage in API routes
if (failedAuthAttempts > 5) {
  logSecurityEvent('multiple_auth_failures', {
    userId,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    attempts: failedAuthAttempts,
  }, 'high');
}
```

**Monitoring Events:**
- [ ] Multiple authentication failures from same IP
- [ ] Suspicious SQL injection attempts
- [ ] Rate limit violations
- [ ] Privilege escalation attempts
- [ ] Unusual data access patterns
- [ ] WebSocket connection anomalies
- [ ] Large data exports
- [ ] Administrative actions

### 5.2 Incident Response Plan

**Severity Levels:**

**Critical:**
- Data breach
- Authentication system compromise
- Database exposure
- RCE vulnerability
- Immediate action: Take service offline, notify stakeholders

**High:**
- Unauthorized admin access
- Mass data export
- Privilege escalation
- Action: Immediate investigation, temporary restrictions

**Medium:**
- Rate limit violations
- Suspicious scanning activity
- Failed injection attempts
- Action: Monitor, review logs

**Low:**
- Single failed login
- Minor policy violations
- Action: Log and review weekly

**Response Steps:**
1. **Detection**: Automated monitoring alerts
2. **Containment**: Block IPs, disable accounts, revoke sessions
3. **Investigation**: Review logs, identify scope
4. **Remediation**: Patch vulnerabilities, update rules
5. **Recovery**: Restore service, verify fixes
6. **Post-Incident**: Document lessons, update procedures

---

## 6. Security Best Practices

### 6.1 Development Best Practices

**Code Review Security Checklist:**
- [ ] All new endpoints require authentication
- [ ] Input validation implemented
- [ ] Output encoding for user data
- [ ] No secrets in code
- [ ] Error handling doesn't leak info
- [ ] Rate limiting considered
- [ ] Resource ownership checked
- [ ] SQL queries parameterized (via Drizzle)

**Pre-Commit Security:**
```bash
# .husky/pre-commit
npm run security:check
npm run lint
npm run test:security:smoke
```

### 6.2 Deployment Best Practices

**Production Deployment Checklist:**
- [ ] Environment variables configured
- [ ] Mock auth disabled (NEXT_PUBLIC_USE_MOCK_AUTH=false)
- [ ] Debug endpoints disabled
- [ ] HTTPS enforced
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] Database connections encrypted
- [ ] Log aggregation configured
- [ ] Monitoring alerts active
- [ ] Incident response plan ready

**Infrastructure Hardening:**
- [ ] Non-root Docker user
- [ ] Read-only filesystem where possible
- [ ] No unnecessary packages
- [ ] Secrets in key management service (AWS KMS, etc.)
- [ ] Network segmentation
- [ ] WAF configured
- [ ] DDoS protection enabled

### 6.3 Regular Security Maintenance

**Daily:**
- Review security logs
- Monitor failed authentication attempts
- Check error rates

**Weekly:**
- Run dependency vulnerability scans
- Review access logs
- Check for new security advisories

**Monthly:**
- Full security test suite
- Penetration testing
- Security policy review
- Team security training

**Quarterly:**
- External security audit
- Penetration test by third party
- Disaster recovery drill
- Security architecture review

---

## 7. Security Testing Tools

### 7.1 Recommended Tools

**Static Analysis:**
- ESLint Security Plugin (`eslint-plugin-security`)
- Semgrep (security rules)
- SonarQube
- CodeQL (GitHub)

**Dynamic Testing:**
- OWASP ZAP (API scanning)
- Burp Suite (manual testing)
- Postman (API security tests)
- Artillery (load testing)

**Dependency Scanning:**
- npm audit
- Snyk
- Dependabot (GitHub)
- OWASP Dependency Check

**Container Security:**
- Trivy
- Docker Scout
- Anchore
- Clair

**Secrets Detection:**
- GitLeaks
- TruffleHog
- GitGuardian
- detect-secrets

### 7.2 Integration Commands

```bash
# Install security tools
npm install --save-dev eslint-plugin-security
npm install --save-dev @eslint-community/eslint-plugin-security

# Run security linting
npx eslint . --ext .ts,.tsx --rulesdir ./security-rules

# Run Semgrep
npx semgrep --config=auto .

# Run OWASP ZAP
zap-api-scan.py -t http://localhost:3000/api -f openapi

# Run secrets detection
npx detect-secrets scan
npx gitleaks detect --source .
```

---

## 8. Compliance & Standards

### 8.1 Security Standards

**OWASP Top 10:**
- [ ] A01: Broken Access Control (Authorization tests)
- [ ] A02: Cryptographic Failures (HTTPS, secrets)
- [ ] A03: Injection (SQL, XSS, command injection)
- [ ] A04: Insecure Design (Architecture review)
- [ ] A05: Security Misconfiguration (Headers, defaults)
- [ ] A06: Vulnerable Components (Dependency scanning)
- [ ] A07: Authentication Failures (Auth tests)
- [ ] A08: Data Integrity Failures (Integrity tests)
- [ ] A09: Logging Failures (Monitoring)
- [ ] A10: SSRF (Server-Side Request Forgery)

**OWASP ASVS (Application Security Verification Standard):**
- Level 1: Opportunistic (basic security)
- Level 2: Standard (most applications)
- Level 3: Advanced (high-security applications)

### 8.2 Compliance Considerations

**Data Privacy:**
- GDPR (EU): Right to be forgotten, data portability
- CCPA (California): Data deletion, opt-out
- Data retention policies
- User consent tracking

**Security Certifications:**
- SOC 2 (if applicable)
- ISO 27001 (if applicable)
- PCI DSS (if handling payments)

---

## 9. Appendices

### Appendix A: Security Test Data

**Test Users:**
```typescript
const TEST_USERS = {
  admin: {
    id: 'test_admin_001',
    email: 'admin@test.com',
    token: 'test_token_admin',
    roles: ['admin']
  },
  userA: {
    id: 'test_user_a_001',
    email: 'usera@test.com',
    token: 'test_token_user_a',
    roles: ['user']
  },
  userB: {
    id: 'test_user_b_001',
    email: 'userb@test.com',
    token: 'test_token_user_b',
    roles: ['user']
  },
  scorer: {
    id: 'test_scorer_001',
    email: 'scorer@test.com',
    token: 'test_token_scorer',
    roles: ['scorer']
  },
  viewer: {
    id: 'test_viewer_001',
    email: 'viewer@test.com',
    token: 'test_token_viewer',
    roles: ['viewer']
  },
};
```

**Test Resources:**
```typescript
const TEST_RESOURCES = {
  teamA: { id: 'test_team_a', ownerId: TEST_USERS.userA.id },
  teamB: { id: 'test_team_b', ownerId: TEST_USERS.userB.id },
  gameA: { id: 'test_game_a', ownerId: TEST_USERS.userA.id },
  communityA: { id: 'test_comm_a', ownerId: TEST_USERS.admin.id },
};
```

### Appendix B: Security Test Report Template

```markdown
# Security Test Report - [Date]

## Executive Summary
- Overall Security Score: X/100
- Critical Issues: X
- High Issues: X
- Medium Issues: X
- Low Issues: X

## Test Scope
- API Endpoints: X tested
- WebSocket Events: X tested
- Authentication Scenarios: X tested
- Authorization Scenarios: X tested

## Findings

### Critical
1. [Title]
   - Risk: [Description]
   - Impact: [Description]
   - Remediation: [Steps]

### High
1. [Title]
   - Risk: [Description]
   - Impact: [Description]
   - Remediation: [Steps]

### Medium
...

### Low
...

## Recommendations
1. [Priority 1 recommendation]
2. [Priority 2 recommendation]
...

## Appendix: Test Results
[Detailed test output]
```

### Appendix C: Quick Security Checklist

**Before Every Release:**
- [ ] Security tests passing (npm run test:security)
- [ ] No high/critical vulnerabilities (npm audit)
- [ ] Secrets scan clean (gitleaks/detect-secrets)
- [ ] Authentication working in production mode
- [ ] Rate limiting enabled
- [ ] Security headers present
- [ ] Error messages sanitized
- [ ] Mock auth disabled
- [ ] HTTPS enforced
- [ ] Database migrations secure

---

## 10. Summary

This security testing plan provides:

1. **Comprehensive Coverage**: Tests for all major security domains
2. **Automation-Ready**: Can be integrated into CI/CD pipelines
3. **Actionable**: Clear test cases with expected results
4. **Maintainable**: Structured tests that grow with the application
5. **Best Practices**: Industry-standard security testing approaches

**Next Steps:**
1. Set up security test infrastructure
2. Implement automated security tests
3. Run initial security assessment
4. Address any critical findings
5. Integrate into development workflow
6. Schedule regular security reviews

**Success Metrics:**
- 100% of API endpoints covered by security tests
- 0 critical vulnerabilities in production
- Security tests passing on every commit
- <5% of code changes fail security review
- Monthly security score improvements

---

*Document Version: 1.0*
*Last Updated: 2026-02-08*
*Next Review: Monthly*
