# Vialum Chat — Diagnostic Report

**Date:** 2026-04-06
**Scope:** Full codebase review — 2 rounds of deep investigation

## Summary

| Area | Critical | High | Medium | Low | Total |
|------|----------|------|--------|-----|-------|
| Security & Auth | 2 | 5 | 4 | 1 | 12 |
| Workers (queues) | 0 | 5 | 11 | 2 | 18 |
| Talk Engine & AI | 2 | 4 | 5 | 3 | 14 |
| Database & Queries | 4 | 3 | 5 | 3 | 15 |
| Frontend (state/socket) | 6 | 4 | 5 | 0 | 15 |
| Frontend (components) | 0 | 4 | 12 | 6 | 22 |
| Infra & Docker | 1 | 4 | 5 | 3 | 13 |
| **Total** | **15** | **29** | **47** | **18** | **109** |

## Reports

### Deep Analysis (Round 2)
- [Security & Auth](./diagnostics/security-auth.md) — tenant isolation, prompt injection, token races
- [Workers Deep Dive](./diagnostics/workers-deep.md) — transactions, locks, memory, timeouts
- [Talk Engine & AI](./diagnostics/talk-engine.md) — prompt injection, HITL timeout, state machine
- [Database & Queries](./diagnostics/database-deep.md) — missing indexes, race conditions, schema gaps
- [Frontend Deep Dive](./diagnostics/frontend-deep.md) — socket lifecycle, memory leaks, state management

### Initial Analysis (Round 1)
- [API Backend](./diagnostics/api-backend.md)
- [Frontend Components](./diagnostics/frontend.md)
- [Infrastructure & Integration](./diagnostics/infra-integration.md)

---

## Top 15 — Priority Fix List

### CRITICAL (fix before next deploy)

| # | Issue | File | Report |
|---|-------|------|--------|
| 1 | **Tenant isolation bypass** — URL accountId not validated against JWT | `plugins/auth.ts:38-46` | [security](./diagnostics/security-auth.md#1) |
| 2 | **Prompt injection** — user messages interpolated raw into AI prompt | `prompts/analysis.prompt.ts:132` | [talk-engine](./diagnostics/talk-engine.md#1) |
| 3 | **Socket token never refreshed** — expires mid-session, silent failure | `socket/client.ts:8-24` | [frontend](./diagnostics/frontend-deep.md#1) |
| 4 | **No room re-subscription on reconnect** — user gets no updates after WiFi drop | `socket/client.ts:17-20` | [frontend](./diagnostics/frontend-deep.md#2) |
| 5 | **Missing DB indexes** — 4 compound indexes declared in schema but never created in migrations | `prisma/schema.prisma` | [database](./diagnostics/database-deep.md#1) |
| 6 | **Messages store: unbounded memory** — never evicts old conversations | `stores/messages.store.ts:5` | [frontend](./diagnostics/frontend-deep.md#3) |

### HIGH (fix this week)

| # | Issue | File | Report |
|---|-------|------|--------|
| 7 | **CORS wildcard `*`** in production docker-compose | `docker-compose.yml:18` | [infra](./diagnostics/infra-integration.md) |
| 8 | **No timeouts** on Hub/Media/Switch API calls — workers hang forever | multiple workers | [workers](./diagnostics/workers-deep.md#11) |
| 9 | **Message-send: no transaction** wrapping DB writes after provider call | `message-send.worker.ts:207` | [workers](./diagnostics/workers-deep.md#1) |
| 10 | **HITL no timeout** — pending suggestions stay forever, conversations stuck | ai-suggestions | [talk-engine](./diagnostics/talk-engine.md#2) |
| 11 | **Contact duplicate race** — no unique constraint on (accountId, phone) | `schema.prisma:199` | [database](./diagnostics/database-deep.md#7) |
| 12 | **Redis noeviction** — when full, ALL writes fail, workers crash | `docker-compose.yml:87` | [infra](./diagnostics/infra-integration.md) |
| 13 | **Refresh token TOCTOU** — concurrent requests defeat token rotation | `auth.service.ts:106-160` | [security](./diagnostics/security-auth.md#3) |
| 14 | **Media persist: full file in memory** — 5 concurrent videos = 500MB+ spike | `media-persist.worker.ts:107` | [workers](./diagnostics/workers-deep.md#3) |
| 15 | **N+1 query** in conversations list | `conversations.service.ts:94` | [api](./diagnostics/api-backend.md) |
