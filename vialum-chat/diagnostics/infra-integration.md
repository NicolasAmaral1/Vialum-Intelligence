# Infrastructure & Integration — Diagnostic Report

## 1. Security

### 1.1 CRITICAL: Hardcoded Credentials in History Ingest Script
- **File:** `api/src/scripts/ingest-evolution-history.ts:14-16`
- **Category:** Security
- **Problem:** Evolution API key (`AEC3F57670E5-463C-ADB7-0845A1AD329F`), base URL, instance name, inbox ID, and account ID are hardcoded in plaintext.
- **Fix:** Move ALL values to environment variables. Never commit secrets.

### 1.2 HIGH: CORS Wildcard in Production
- **File:** `docker-compose.yml:18`
- **Category:** Security
- **Problem:** `CORS_ORIGIN=*` allows any website to make authenticated requests to the API.
- **Fix:** Set `CORS_ORIGIN=https://chat.luminai.ia.br`.

### 1.3 HIGH: Webhook Secret Insecure Default
- **File:** `docker-compose.yml:24`
- **Category:** Security
- **Problem:** `TASKS_WEBHOOK_SECRET=${WEBHOOK_SECRET:-vialum-switch-internal-2026}` — fallback is predictable, visible in git, same across deployments.
- **Fix:** Remove default. Make `WEBHOOK_SECRET` required.

### 1.4 HIGH: MEDIA_JWT_SECRET Optional but Required
- **File:** `api/src/config/env.ts:16`
- **Category:** Security / Reliability
- **Problem:** Marked `.optional()` but hub-ensure and media-persist workers throw at runtime if missing. App starts, then crashes on first job.
- **Fix:** Change to `z.string().min(32)`.

---

## 2. Docker & DevOps

### 2.1 HIGH: API Container Has No Health Check
- **File:** `docker-compose.yml:3-39`
- **Category:** DevOps
- **Problem:** No `healthcheck` block for `vialumchat-api`. Docker/Traefik can't detect if the service is actually serving requests.
- **Fix:** Add:
  ```yaml
  healthcheck:
    test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:4000/chat/health"]
    interval: 10s
    timeout: 5s
    retries: 3
  ```

### 2.2 HIGH: Redis noeviction Policy
- **File:** `docker-compose.yml:87`
- **Category:** DevOps
- **Problem:** `--maxmemory-policy noeviction` with 2GB limit. When full, Redis refuses ALL writes. Workers (message-send, automation, media-persist) silently fail.
- **Fix:** Change to `allkeys-lru` or `volatile-lru`.

### 2.3 MEDIUM: No Resource Limits on Containers
- **File:** `docker-compose.yml` (all services)
- **Category:** DevOps
- **Problem:** No `deploy.resources.limits` on any service. A runaway process can consume all 16GB of VPS RAM, killing other Vialum services.
- **Fix:** Add memory/CPU limits:
  ```yaml
  deploy:
    resources:
      limits:
        memory: 2g
        cpus: '2'
  ```

### 2.4 MEDIUM: API Dockerfile Missing HEALTHCHECK
- **File:** `api/Dockerfile`
- **Category:** DevOps
- **Problem:** No `HEALTHCHECK` instruction in Dockerfile.
- **Fix:** Add `HEALTHCHECK` in runner stage.

### 2.5 LOW: Web Dockerfile — Redundant Static Copy
- **File:** `web/Dockerfile:30-38`
- **Category:** DevOps
- **Problem:** `.next/standalone` + separate `.next/static` copy may be redundant.
- **Fix:** Verify `next.config.js` `output: 'standalone'` is configured.

---

## 3. Cross-Service Integration

### 3.1 HIGH: No Timeouts on External Service Calls
- **Files:** Multiple workers
- **Category:** Reliability
- **Problem:** All `fetch()` calls to external services have no timeout:
  - Hub ensure worker → Hub API (no timeout)
  - Media persist worker → Media Service (no timeout)
  - Context service → Hub API (no timeout)
  - Tasks notification → Tasks API (has 3s timeout — only one that's correct)
- **Fix:** Add `AbortController` with appropriate timeouts:
  - Hub: 5s
  - Media upload: 30s
  - Context: 2s

### 3.2 MEDIUM: No Circuit Breaker on External Services
- **Category:** Reliability
- **Problem:** If Hub, Media, or Switch are down, every request still attempts the call, adding latency and filling error logs. No circuit breaker pattern.
- **Fix:** Implement simple circuit breaker (track failures, skip calls for N seconds after threshold).

### 3.3 MEDIUM: Service URL Not Validated as URL
- **File:** `api/src/config/env.ts:15`
- **Category:** Reliability
- **Problem:** `MEDIA_SERVICE_URL` uses `z.string()` not `z.string().url()`. Invalid URL accepted at startup, fails at runtime.
- **Fix:** Add `.url()` validation for all service URLs.

---

## 4. Environment Configuration

### 4.1 MEDIUM: .env.example Missing Many Variables
- **File:** `.env.example`
- **Category:** Code Quality
- **Problem:** Missing documentation for:
  - `TASKS_WEBHOOK_URL`
  - `TASKS_WEBHOOK_SECRET`
  - `HUB_URL` / `CRM_HUB_URL`
  - `MEDIA_JWT_SECRET`
  - `MEDIA_SERVICE_URL`
  - `SWITCH_WEBHOOK_SECRET`
- **Fix:** Update `.env.example` with all variables and comments.

### 4.2 LOW: Duplicate Hub URL Config
- **File:** `api/src/config/env.ts:13-14`
- **Category:** Code Quality
- **Problem:** Both `HUB_URL` and `CRM_HUB_URL` are accepted. Confusing.
- **Fix:** Deprecate `CRM_HUB_URL`. Use only `HUB_URL`.

---

## 5. Database

### 5.1 HIGH: Missing Compound Index for Message Dedup
- **File:** `api/prisma/schema.prisma`
- **Category:** Performance
- **Problem:** Dedup query (`WHERE externalMessageId = X AND conversationId = Y`) has no matching compound index. Full table scan on growing messages table.
- **Fix:** Add `@@unique([conversationId, externalMessageId])`.

### 5.2 MEDIUM: WebhookEvent Table Unbounded Growth
- **File:** `api/prisma/schema.prisma:473-492`
- **Category:** Performance
- **Problem:** No cleanup job. Every webhook (including processed ones) stays forever. With ~100 messages/day, that's 36K+ records/year with full JSON payload.
- **Fix:** Add cron job to delete `WHERE processed = true AND createdAt < NOW() - INTERVAL '30 days'`.

### 5.3 MEDIUM: Missing Index on senderContactId
- **File:** `api/prisma/schema.prisma:326`
- **Category:** Performance
- **Problem:** No index on `Message.senderContactId`. Queries filtering by contact sender are slow.
- **Fix:** Add `@@index([senderContactId])`.

---

## 6. Redis

### 6.1 MEDIUM: Memory Monitor Only Logs to Console
- **File:** `api/src/workers/index.ts:54-70`
- **Category:** Observability
- **Problem:** Redis memory alerts use `console.warn`. Not captured by monitoring.
- **Fix:** Use structured logger. Consider sending metrics to monitoring system.

### 6.2 LOW: Cache Keys Without Version Prefix
- **File:** `api/src/workers/media-persist.worker.ts:175`
- **Category:** Code Quality
- **Problem:** `media:file:${mediaFileId}` has no version prefix. Schema changes break cached data silently.
- **Fix:** Use `media:file:v1:${mediaFileId}`.

---

## 7. Missing Documentation

### 7.1 MEDIUM: No Deployment Documentation
- **Problem:** No docs explaining env vars, required services, deployment order, rollback procedures.
- **Fix:** Create `DEPLOYMENT.md`.

### 7.2 MEDIUM: No Architecture Documentation
- **Problem:** No docs explaining how Chat integrates with Hub, Media, Switch, Tasks. Integration contracts undocumented.
- **Fix:** Create `ARCHITECTURE.md` with service dependency diagram, protocols, error handling contracts.

---

## 8. Package & Build

### 8.1 LOW: Missing ESLint Dependencies and Config
- **File:** `api/package.json:14`
- **Category:** Code Quality
- **Problem:** `npm run lint` script exists but no ESLint dependencies installed and no `.eslintrc` file.
- **Fix:** Install ESLint + TypeScript plugin. Create config file.

---

## Integration Flow Health Summary

| Integration | Direction | Status | Issue |
|------------|-----------|--------|-------|
| Chat → Media | Upload media | Partially broken | Missing URL extraction for audio/video/doc (fixed in pending changes) |
| Chat → Hub | Contact sync | Working but fragile | No timeout, no circuit breaker |
| Chat → Tasks | Webhook notify | Working | Has 3s timeout (good), but console.error logging |
| Chat → Switch | Via Media fileId cache | Working | Redis cache has no version prefix |
| Switch → Chat | Webhook callback | Working | Proper Redis lookup + DB fallback |
| Chat ← Evolution | Webhook ingest | Working but insecure | No signature verification |
| Chat ← Cloud API | Webhook ingest | Working | Optional signature verification |
