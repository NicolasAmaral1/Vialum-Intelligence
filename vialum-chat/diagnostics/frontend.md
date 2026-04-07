# Frontend — Diagnostic Report

## 1. Critical / High Severity

### 1.1 HIGH: Socket Event Listeners Not Cleaned Up
- **File:** `web/src/hooks/useTypingIndicator.ts:13-35`
- **Category:** Memory Leak
- **Problem:** Socket listeners added in useEffect but cleanup doesn't properly remove old listeners when `conversationId` changes. Socket is global and persists across conversation switches.
- **Fix:** Store listener references. Use wrapper around `socket.on()` that auto-removes on cleanup.

### 1.2 HIGH: Missing useEffect Dependencies (Stale Closure)
- **File:** `web/src/components/thread/MessageThread.tsx:68-73`
- **Category:** Bug
- **Problem:** `eslint-disable exhaustive-deps` hides real dependency issue. Effect depends on `loading` and `messages.length` but only includes `conversationId`. Causes stale data when switching conversations.
- **Fix:** Add proper dependencies or restructure with separate effects.

### 1.3 HIGH: Optimistic Message Not Synced with Real Message
- **File:** `web/src/hooks/useMessages.ts:86-96`
- **Category:** Bug
- **Problem:** Failed optimistic messages retain `_optimistic: true` flag. If real message arrives with same content, dedup by `id` won't match, creating ghost duplicates.
- **Fix:** Use `_tempId` for dedup. Remove optimistic message when real one arrives.

### 1.4 HIGH: Duplicate Socket Subscriptions
- **File:** `web/src/app/(app)/inbox/[conversationId]/page.tsx:77-85` + `MessageThread.tsx`
- **Category:** Bug / Memory
- **Problem:** Both the conversation page AND MessageThread subscribe to the same conversation room. Double event delivery, race conditions on unsubscribe order.
- **Fix:** Single subscription point. Remove one of the two.

### 1.5 HIGH: Race Condition in Message Pagination
- **File:** `web/src/hooks/useMessages.ts:28-33`
- **Category:** Bug
- **Problem:** `loadMore` fetches older messages but doesn't handle concurrent new messages arriving via socket. Messages could be lost or duplicated during merge.
- **Fix:** Use cursor-based pagination with conflict resolution.

---

## 2. Medium Severity

### 2.1 MEDIUM: Auth Guard Renders Before Redirect
- **File:** `web/src/app/(app)/layout.tsx:23-42`
- **Category:** Security / UX
- **Problem:** `router.replace()` is async. AppShell renders and fires network requests before redirect completes. Unauthenticated users briefly see the app.
- **Fix:** Block rendering until auth is confirmed. Use Next.js middleware for server-side redirect.

### 2.2 MEDIUM: Infinite Loop Risk in Conversations Hook
- **File:** `web/src/hooks/useConversations.ts:14-32`
- **Category:** Bug
- **Problem:** `filters` in dependency array can cause loop: filter change -> fetch -> possible state update -> re-render -> filter object recreated -> fetch again.
- **Fix:** Memoize filters object. Separate initial load from filter-change effects.

### 2.3 MEDIUM: CRM Loading State Stuck on Error
- **File:** `web/src/components/thread/ContactSidebar.tsx:67-73`
- **Category:** Bug
- **Problem:** `.catch(() => {})` swallows error but `.finally()` may not fire in all rejection paths. CRM section stays in loading state forever.
- **Fix:** Restructure with try/catch/finally in async function.

### 2.4 MEDIUM: Search Debounce Not Cleaned Up
- **File:** `web/src/components/inbox/InboxFilters.tsx:75-83`
- **Category:** Bug
- **Problem:** Debounce timeout not cleared on component unmount. Old timeout fires after unmount, calling `onFilterChange` on stale state.
- **Fix:** Store timeout ref. Clear in useEffect cleanup.

### 2.5 MEDIUM: MessageComposer No Error Feedback
- **File:** `web/src/components/thread/MessageComposer.tsx:20-27`
- **Category:** UX
- **Problem:** If `sendMessage` fails, user gets no feedback. Message just disappears.
- **Fix:** Add toast notification on send failure.

### 2.6 MEDIUM: API Client Only Retries on 401
- **File:** `web/src/lib/api/client.ts:40-73`
- **Category:** Reliability
- **Problem:** Only 401 triggers retry (token refresh). 500, 503, network errors, and 429 all fail immediately with no retry.
- **Fix:** Add exponential backoff for 5xx and network errors. Add request timeout.

### 2.7 MEDIUM: No Sync Button Protection
- **File:** `web/src/components/thread/ContactSidebar.tsx:96-111`
- **Category:** UX
- **Problem:** CRM sync button can be clicked multiple times rapidly before `syncing` state updates.
- **Fix:** Disable button immediately on click.

### 2.8 MEDIUM: Unnecessary Re-renders in Message List
- **File:** `web/src/components/thread/MessageThread.tsx:45-150`
- **Category:** Performance
- **Problem:** `MessageBubble` not wrapped in `React.memo`. Every parent render re-renders all messages. Store selector doesn't use `useShallow`.
- **Fix:** Wrap `MessageBubble` in `React.memo`. Use shallow equality in store selector.

### 2.9 MEDIUM: Global Socket Reference Lifecycle
- **File:** `web/src/lib/socket/client.ts:6`
- **Category:** Memory
- **Problem:** Module-level socket variable. Reconnection creates new instance but old may not be fully disconnected.
- **Fix:** Implement proper socket lifecycle with explicit destroy/recreate.

### 2.10 MEDIUM: Error Boundary Only Logs to Console
- **File:** `web/src/app/(app)/layout.tsx:131-163`
- **Category:** UX
- **Problem:** `DebugErrorBoundary` shows raw error text with no recovery. User stuck on broken screen.
- **Fix:** Add "Retry" button that resets error state. Add "Report Bug" link.

### 2.11 MEDIUM: Multiple ESLint Disables Hiding Real Issues
- **Files:** `MessageThread.tsx:72`, `ContactSidebar.tsx:76`, `use-toast.ts:21`
- **Category:** Code Quality
- **Problem:** Three `eslint-disable` comments suppress legitimate warnings about missing deps and unused vars.
- **Fix:** Fix the actual issues.

---

## 3. Low Severity

### 3.1 LOW: Media Messages Show Placeholders Only
- **File:** `web/src/components/thread/MessageBubble.tsx:119-140`
- **Category:** UX
- **Problem:** Audio, video, image, and document messages show icon + text label only. No actual media playback or preview.
- **Fix:** Implement media rendering components (image preview, audio player, video player, document download link) using Media Service presigned URLs.

### 3.2 LOW: No 404 Page
- **Category:** UX
- **Problem:** Invalid conversation IDs or routes show nothing.
- **Fix:** Create `not-found.tsx`.

### 3.3 LOW: All Strings Hardcoded in Portuguese
- **Category:** Localization
- **Problem:** No i18n structure. All UI text is hardcoded ("Hoje", "Ontem", "Resolvida", "Nenhuma conversa").
- **Fix:** Extract to i18n system if multi-language support is planned.

### 3.4 LOW: Loose Type Definitions
- **File:** `web/src/types/api.ts:10, 43-44, 108, 134`
- **Category:** Type Safety
- **Problem:** Multiple `Record<string, unknown>` for structured fields like `contentAttributes`, `customAttributes`.
- **Fix:** Define specific interfaces.

### 3.5 LOW: Silent Error Swallowing in Auth Store
- **File:** `web/src/stores/auth.store.ts:23-36`
- **Category:** Error Handling
- **Problem:** `clearAppStores()` uses `.catch(() => {})` on dynamic imports. Module load failures silently ignored.
- **Fix:** Log errors for debugging.
