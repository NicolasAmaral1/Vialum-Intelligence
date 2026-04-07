# Frontend — Deep Diagnostic

## CRITICAL (State & Socket)

### 1. Socket Token Never Refreshed During Session
- **File:** `web/src/lib/socket/client.ts:8-24`
- **Problem:** Socket initialized ONCE with access token. If token expires during session, socket uses stale token. No refresh mechanism. Reconnection uses expired token — server rejects silently.
- **Fix:** Listen for token refresh event. Reinitialize socket with new token after refresh.

### 2. No Room Re-subscription on Reconnect
- **File:** `web/src/lib/socket/client.ts:17-20`
- **Problem:** Socket.IO reconnects automatically but app never re-emits `subscribe:account` or `subscribe:conversation`. After reconnect, socket listens to nothing. User appears online but receives no updates.
- **Fix:** Listen for `reconnect` event. Re-subscribe to account room and all active conversation rooms.

### 3. Messages Store: Unbounded Memory Growth
- **File:** `web/src/stores/messages.store.ts:5`
- **Problem:** `byConversation: Record<string, Message[]>` never evicts old conversations. User opens 100 conversations → all message arrays stay in memory. No TTL, no LRU.
- **Fix:** Keep only last N conversations in memory. Evict oldest on new subscription.

### 4. Socket Event Handlers Accumulate on Re-renders
- **File:** `web/src/app/(app)/layout.tsx:52-109`
- **Problem:** `socket.on()` handlers added in useEffect capture closure state. If effect re-runs (account change, dep update), old handlers stay registered + new ones added. Results in N handlers for same event.
- **Fix:** Use `socket.off(eventName, handler)` before `socket.on()`. Or remove all listeners in cleanup.

### 5. Account Switch: Old Event Handlers With Stale Closures
- **File:** `web/src/app/(app)/layout.tsx:52-109, 111-113`
- **Problem:** When user switches account, effect re-runs. Old handlers (pointing to old account's state) remain active alongside new ones. Messages from new account processed by both old and new handlers.
- **Fix:** Track handler references. Remove ALL before re-adding.

### 6. Multiple Tabs: Token Refresh Race
- **Problem:** Tab A refreshes token → updates localStorage. Tab B's socket still has old token. Tab B's next API call uses old access token → 401 → refresh → potentially invalidates Tab A's new refresh token.
- **Fix:** Use BroadcastChannel API to sync token refreshes across tabs.

---

## HIGH

### 7. Optimistic Message Never Confirmed on Socket Loss
- **File:** `web/src/hooks/useMessages.ts:65-96`
- **Problem:** User sends message → optimistic add → API call succeeds → `confirmOptimistic` waits for API response. BUT if socket disconnects between send and response, message stays as `_optimistic: true` forever with "sending" status.
- **Fix:** Add timeout to optimistic messages. Mark as "uncertain" after 10s.

### 8. Double Socket Subscription per Conversation
- **Files:** `web/src/app/(app)/inbox/[conversationId]/page.tsx:77-85` + `web/src/hooks/useMessages.ts:53`
- **Problem:** Both ConversationPage AND useMessages hook emit `subscribe:conversation`. Double subscription = potential double event delivery.
- **Fix:** Single subscription point.

### 9. useMessages: Stale fetchMessages in Dependency Array
- **File:** `web/src/hooks/useMessages.ts:44-58`
- **Problem:** `fetchMessages` in deps of subscribe effect. Each `loadMore` call recreates `fetchMessages` → triggers unsubscribe/resubscribe. Subscription churn on every scroll.
- **Fix:** Remove `fetchMessages` from subscribe effect deps. Use ref.

### 10. No Disconnect/Error UI
- **Problem:** When socket disconnects, user sees no indication. Messages stop arriving silently. User thinks app is working but it's disconnected.
- **Fix:** Add connection status banner. Show "Reconnecting..." toast on disconnect.

---

## MEDIUM

### 11. Suggestions Store: Unbounded Growth
- **File:** `web/src/stores/suggestions.store.ts:4-6`
- **Problem:** Same as messages store — never evicts old conversations. `removeSuggestion()` loops through ALL conversations to find one suggestion — O(n*m).
- **Fix:** Add conversation-scoped cleanup.

### 12. API Client: No Retry on 5xx/Network Errors
- **File:** `web/src/lib/api/client.ts:40-73`
- **Problem:** Only retries on 401 (token refresh). 500, 503, network timeout all fail immediately.
- **Fix:** Add exponential backoff for 5xx and network errors.

### 13. InboxFilters: localStorage Without Try-Catch
- **File:** `web/src/components/inbox/InboxFilters.tsx:47-58`
- **Problem:** localStorage access can throw if storage is full or disabled. No error handling.
- **Fix:** Wrap in try-catch with fallback.

### 14. ContactSidebar: Direct Contact Object Mutation
- **File:** `web/src/components/thread/ContactSidebar.tsx:127-129`
- **Problem:** Directly mutates `contact.customName` and `contact.displayName` instead of using local state. Breaks React immutability.
- **Fix:** Use local state copy.

### 15. MessageBubble: Audio Duration Formatting Bug
- **File:** `web/src/components/thread/MessageBubble.tsx:132`
- **Problem:** `Math.floor(attrs.seconds % 60)` produces "4:5" instead of "4:05". Missing zero-padding.
- **Fix:** `.toString().padStart(2, '0')`.

### 16. AI Queue: Bulk Approve Without Content Validation
- **File:** `web/src/app/(app)/ai-queue/page.tsx:68-77`
- **Problem:** Bulk approve sends all pending suggestions without validating content or awaiting results. If creation fails, toast still shows success.
- **Fix:** Await all promises. Show error count.

### 17. Login: Error Message Could Expose Internals
- **File:** `web/src/app/(auth)/login/page.tsx:30-36`
- **Problem:** `err.message` displayed directly. Could show internal API error details.
- **Fix:** Sanitize or use generic message.

---

## LOW

### 18. Media: Placeholder Only (No Playback)
- **File:** `web/src/components/thread/MessageBubble.tsx:119-140`
- **Problem:** Audio, video, image, document show icon + label only. No actual media rendering.
- **Fix:** Implement media components using Media Service presigned URLs.

### 19. Emoji/File Upload Buttons Non-functional
- **File:** `web/src/components/thread/MessageComposer.tsx:78-82`
- **Problem:** Smile and Paperclip buttons exist but have no click handlers.
- **Fix:** Implement or remove.

### 20. Missing 404 Page
- **Problem:** Invalid routes show nothing.
- **Fix:** Create `not-found.tsx`.

### 21. ContactSidebar Fixed Width
- **File:** `web/src/components/thread/ContactSidebar.tsx:175`
- **Problem:** `w-[360px]` hardcoded. Breaks on mobile.
- **Fix:** Use responsive width.

### 22. Canned Responses Not Implemented
- **Problem:** MessageComposer hints show `/` for quick responses but autocomplete never triggers.
- **Fix:** Implement inline autocomplete or remove hint.

### 23. Snooze Conversation UI Missing
- **Problem:** "Adiar conversa" menu item exists but is disabled. No snooze modal.
- **Fix:** Implement snooze UI or hide option.
