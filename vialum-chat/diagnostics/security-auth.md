# Security & Auth — Deep Diagnostic

## CRITICAL

### 1. Tenant Isolation Bypass (URL Parameter)
- **File:** `api/src/plugins/auth.ts:38-46`
- **Category:** Security — CRITICAL
- **Problem:** `tenantGuard` only checks that `accountId` exists in JWT, but does NOT verify that the URL param `accountId` matches the JWT's `accountId`. User Alice (acct-123) can access Bob's data (acct-456) by changing the URL.
- **Fix:** Add `if (request.params.accountId !== request.jwtPayload.accountId) return reply.status(403)`

### 2. Prompt Injection in AI Pipeline
- **File:** `api/src/modules/talk-engine/prompts/analysis.prompt.ts:127, 132`
- **Category:** Security — CRITICAL
- **Problem:** User messages are interpolated directly into AI system prompts without sanitization. A malicious contact can inject instructions to override AI behavior (bypass HITL, force auto-send, extract data).
- **Fix:** Escape user input with delimiters. Use structured message format instead of string interpolation.

---

## HIGH

### 3. Refresh Token Race Condition (TOCTOU)
- **File:** `api/src/modules/auth/auth.service.ts:106-160`
- **Category:** Security
- **Problem:** Two concurrent requests with the same refresh token can both pass validation and generate new tokens before either revokes the old one. Token rotation detection is defeated.
- **Fix:** Use DB transaction with row-level locking (`SELECT ... FOR UPDATE`).

### 4. Cloud API Webhook Signature Fails Open
- **File:** `api/src/webhooks/webhook.routes.ts:186-195`
- **Category:** Security
- **Problem:** If `app_secret` is configured but webhook request omits signature header, it's processed anyway. Attacker can forge webhooks by simply not sending the header.
- **Fix:** If `appSecret` exists, REQUIRE signature. Return 401 if missing.

### 5. API Keys List Endpoint Unprotected
- **File:** `api/src/modules/external/api-keys.routes.ts:6-12`
- **Category:** Security
- **Problem:** GET endpoint lists all API keys without `adminGuard`. Agents can enumerate keys, discover creation dates, and track usage patterns.
- **Fix:** Add `adminGuard` to GET endpoint.

### 6. Groups Routes Missing Role-Based Access
- **File:** `api/src/modules/groups/groups.routes.ts:7-139`
- **Category:** Security
- **Problem:** All group operations (create, update, sync, add/remove participants) lack `adminGuard`. Any authenticated agent can perform admin operations.
- **Fix:** Add `adminGuard` to POST, PATCH, DELETE operations.

### 7. Webhook Signature Uses Re-serialized JSON
- **File:** `api/src/webhooks/webhook.routes.ts:189-190`
- **Category:** Security
- **Problem:** `JSON.stringify(payload)` may not match original request body (key ordering, whitespace). Signature verification could fail on valid requests or pass on manipulated ones.
- **Fix:** Use raw request body buffer for HMAC calculation.

---

## MEDIUM

### 8. Socket.IO No Auth Timeout
- **File:** `api/src/plugins/socket.ts:12-36`
- **Problem:** No timeout or rate limit on socket authentication attempts. Brute force possible.
- **Fix:** Add connection timeout and max retry limits.

### 9. Inbox Access Control Missing for Read
- **File:** `api/src/modules/inboxes/inboxes.routes.ts:53-62`
- **Problem:** GET `/:inboxId` only validates account ownership, not user-level inbox access.
- **Fix:** Add RLS check in service.

### 10. Missing Security Event Logging
- **Problem:** No structured logging for: failed auth attempts, tenant isolation violations, API key usage, webhook validation failures.
- **Fix:** Add audit log for all security-relevant events.

### 11. No CSRF Protection
- **Problem:** No CSRF tokens visible. If frontend is same-domain, CSRF attacks possible with authenticated session.
- **Fix:** Implement double-submit cookie pattern.

---

## LOW

### 12. JWT_REFRESH_SECRET Unused
- **File:** `api/src/config/env.ts:9`
- **Problem:** Defined but never used. Confusing for ops.
- **Fix:** Remove or implement proper refresh token signing.
