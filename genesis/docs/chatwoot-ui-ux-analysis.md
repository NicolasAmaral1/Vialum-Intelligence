# Chatwoot UI/UX Design Patterns — Comprehensive Analysis

> **Purpose:** Reference document for building a competing customer support platform.
> **Source:** Chatwoot open-source repo (github.com/chatwoot/chatwoot), official docs, DeepWiki, and design resources.
> **Date:** 2026-03-13

---

## 1. Layout Architecture

Chatwoot uses a **four-column layout** for the main inbox/conversation view:

```
┌──────┬────────────────┬─────────────────────────────┬──────────────────┐
│ Nav  │ Conversation   │ Chat / Thread Area          │ Contact /        │
│ Bar  │ List           │                             │ Details Panel    │
│      │                │                             │                  │
│ ~56– │ ~340–400px     │ flex-grow (fills remaining)  │ ~360px           │
│ 72px │ (resizable)    │                             │ (collapsible)    │
│      │                │                             │                  │
└──────┴────────────────┴─────────────────────────────┴──────────────────┘
```

### Proportions & Behavior
| Column | Width | Behavior |
|---|---|---|
| **Primary Sidebar (Nav Bar)** | ~56–72px (icon-only) | Fixed. Always visible on desktop. Collapses on mobile. |
| **Secondary Sidebar (Conversation List)** | ~340–400px | Scrollable. Virtual-scrolled via `vue-virtual-scroller`. Width was increased in PR #10572 for screens > 2xl. |
| **Chat Area** | `flex-grow: 1` | Takes remaining horizontal space. Contains header, message list, and composer. |
| **Contact/Details Panel** | ~360px | Collapsible via toggle. Hidden by default on smaller screens. Slides in from right. |

### Key Component Hierarchy
```
App.vue
└── DashboardLayout.vue
    ├── Sidebar.vue (primary nav)
    ├── SecondaryNavigation.vue (conversation list + filters)
    │   ├── ChatTypeTabs.vue (Mine / Unassigned / All)
    │   └── ChatList.vue
    │       └── ConversationCard.vue → ConversationItem.vue
    ├── ConversationView.vue (chat area)
    │   ├── ConversationHeader.vue
    │   ├── MessageList.vue (scrollable feed)
    │   │   ├── AgentBubble.vue / UserBubble.vue
    │   │   └── ActivityMessage.vue
    │   └── ReplyBox.vue (composer)
    └── ContactPanel.vue (right sidebar)
```

### Layout Modes
- **Condensed layout:** Compact conversation list items (less padding, smaller avatars).
- **Expanded layout:** Taller conversation list items with more preview text.
- Toggle available in user preferences.

---

## 2. Navigation (Primary Sidebar)

The left sidebar is a **narrow icon rail** (dark background, ~56–72px) with two groups:

### Primary Navigation (Top)
| Icon | Section | Badge |
|---|---|---|
| Chat bubble | **Conversations** (inbox) | Unread count badge |
| People | **Contacts** | — |
| Robot/Star | **Captain** (AI) | — |
| Bar chart | **Reports** | — |
| Megaphone | **Campaigns** | — |
| Book | **Help Center** | — |
| Gear | **Settings** | — |

### Secondary Navigation (Bottom)
| Icon | Section |
|---|---|
| Book/docs | Documentation link |
| Bell | **Notifications** (with unread count badge) |
| Avatar circle | **Profile** (availability toggle, preferences) |

### Visual Patterns
- **Active state:** Background highlight (lighter shade or primary accent). Icon color changes to primary blue (`#1F93FF`).
- **Hover:** Subtle background lightening. Tooltip with section name appears on hover (since icon-only).
- **Badges:** Small circular badge (red/primary) overlaid top-right on icons for unread counts.
- **Availability toggle:** Green dot on avatar circle when online; hollow/grey when offline.
- **Sidebar sections:** Inboxes and labels appear as collapsible groups in the secondary sidebar area, not in the primary icon rail.

---

## 3. Conversation List

### Structure of a Conversation Card (`ConversationCard.vue`)

```
┌─────────────────────────────────────────┐
│ [Avatar]  Contact Name        12:34 PM  │
│           Last message previ...   (2)   │
│           [📧 Email] [🏷 bug] [🏷 vip]  │
└─────────────────────────────────────────┘
```

| Element | Details |
|---|---|
| **Avatar** | Circular, ~32–40px. Shows contact initials or image. Channel icon overlay (small badge bottom-right showing WhatsApp/email/web/etc). |
| **Contact name** | Bold, truncated with ellipsis. Primary text color. |
| **Timestamp** | Right-aligned, muted/secondary text color, relative format ("2m", "1h", "Yesterday"). |
| **Message preview** | 1–2 lines, truncated, muted color. Shows last message content. |
| **Unread badge** | Circular blue badge with count, right side, below timestamp. |
| **Labels** | Small colored pills/tags at bottom of card. Each label has its own configurable color. |
| **Inbox/Channel badge** | Small icon indicating channel type (email, web widget, WhatsApp, Telegram, etc). |
| **Assignee indicator** | Small avatar or initials of assigned agent (optional). |

### States
- **Default:** White/light background.
- **Hover:** Light grey background (`bg-slate-25` / slight opacity change).
- **Active (selected):** Primary accent background tint (light blue, `bg-woot-25` or similar), left border accent.
- **Unread:** Bolder text weight for contact name and preview. Unread count badge visible.

### Tabs and Filters
- **Assignee tabs:** `Mine` | `Unassigned` | `All` (permission-filtered via `ChatTypeTabs.vue`).
- **Sort options:** Latest Activity (default) | Creation Time | Priority.
- **Advanced filters:** Combinable with AND/OR operators. Saveable as "Folders" that appear in the sidebar.
- **Search:** Full-text search across conversations.

### Bulk Actions
- Hover over conversation card reveals a **checkbox**.
- Multi-select enables bulk actions bar: Assign agent, Assign label, Resolve, Reopen, Snooze.

---

## 4. Chat / Thread Area

### Conversation Header (`ConversationHeader.vue`)
```
┌──────────────────────────────────────────────────────────────┐
│ [Avatar] Contact Name  · via Email Inbox     [⏰] [✓ Resolve]│
│          contact@email.com                   [⋮ More Actions]│
└──────────────────────────────────────────────────────────────┘
```

- **Contact info:** Avatar, name, email/phone, channel/inbox name.
- **Primary action button:** Green "Resolve" button (changes to "Reopen" when resolved).
- **More actions dropdown (⋮):** Mute, Send transcript, Snooze (with natural language time picker — "next tuesday at 2pm", "in 3 hours"), Mark as pending.
- **SLA timer:** When SLA is configured, a countdown timer badge appears in the header showing remaining time. Changes color as deadline approaches (green > yellow > red on breach).

### Message Bubbles

#### Incoming Messages (Customer)
- **Alignment:** Left-aligned.
- **Background:** Light grey / `bg-slate-50` (light mode) or dark surface (dark mode).
- **Border-radius:** Rounded corners, ~12–16px. Slightly less radius on the top-left corner for visual grouping.
- **Text color:** Primary dark text.
- **Max width:** ~65–75% of chat area width.

#### Outgoing Messages (Agent)
- **Alignment:** Right-aligned.
- **Background:** Primary blue (`#1F93FF` / `bg-woot-500`) or light blue tint depending on the version.
- **Text color:** White (on blue) or dark text (on light blue variant).
- **Border-radius:** Rounded corners, slightly less radius on top-right.
- **Max width:** Same as incoming (~65–75%).

#### Private Notes
- **Background:** Yellow/amber tint (`bg-yellow-50` or similar).
- **Visual distinction:** Clearly differentiated from regular messages with a note icon and "Private Note" label.
- **Not visible to customers.**

#### Bot Messages
- **Alignment:** Left-aligned (same as incoming customer flow, or left-to-right for bot/agent).
- **Visual indicator:** Bot icon or "Bot" label beside the sender name.
- **Style:** Same as agent messages but may have a subtle bot badge.

#### Activity Messages (`ActivityMessage.vue`)
- **Centered** in the message feed.
- **Muted text**, smaller font size.
- **No bubble** — displayed as inline status text (e.g., "Conversation resolved by Agent Name", "Label 'bug' added", "Assigned to Team X").
- **Icon:** Small relevant icon (checkmark for resolved, tag for label, etc).

### Message Metadata
- **Timestamps:** Below each message or message group, muted/small text. Grouped by date with date dividers ("Today", "Yesterday", "March 12, 2026").
- **Sender name:** Shown above message in group conversations or when sender changes.
- **Read receipts:** Double-check marks (similar to WhatsApp) for channels that support delivery/read status.
- **Typing indicator:** Animated dots ("...") shown when the other party is typing.

### Message Grouping
- Sequential messages from the same sender are **grouped** — only the first message in a group shows the avatar and sender name. Subsequent messages have reduced top margin.

---

## 5. Composer (Reply Box)

### Layout (`ReplyBox.vue`)

```
┌──────────────────────────────────────────────────┐
│ [Reply] [Private Note]                           │
├──────────────────────────────────────────────────┤
│                                                  │
│  Type a message...                               │
│                                                  │
├──────────────────────────────────────────────────┤
│ [📎] [😀] [📋] [🎤] [AI ✨]     [↵ Send / Cmd+↵] │
└──────────────────────────────────────────────────┘
```

### Tabs
- **Reply:** Default tab for sending messages to the customer.
- **Private Note:** Yellow-highlighted tab for internal team communication. Supports `@` mentions.

### Action Buttons (Bottom Toolbar)
| Button | Function |
|---|---|
| 📎 Attachment | File upload (drag & drop supported). Images, documents, etc. |
| 😀 Emoji | Emoji picker overlay. |
| 📋 Canned Responses | Triggered by typing `/` in the editor. Shows searchable list of saved templates. |
| 🎤 Voice Note | Record and send audio messages. |
| ✨ AI Assist (Captain) | AI-powered reply suggestions, tone adjustment, translation, expand/shorten. |
| ↵ Send | Primary action. `Cmd/Ctrl + Enter` to send. Configurable: Enter to send or Enter for newline. |

### Rich Text Capabilities
- **Markdown support:** Bold, italic, links, lists, code blocks.
- **Rich text editor:** Toggle between markdown source and WYSIWYG.
- **Email formatting:** When replying to email conversations, full rich text toolbar appears (bold, italic, underline, links, lists, headings).
- **Signature:** Auto-appended email signature (configurable per agent).
- **Reply quoting:** Can quote and reply to specific messages.

### Keyboard Shortcuts
| Shortcut | Action |
|---|---|
| `Cmd + /` | Show all shortcuts |
| `Cmd + Enter` | Send message |
| `/` | Open canned responses |
| `@` | Mention teammate (in private notes) |
| `Alt + L` | Toggle resolve |
| `Cmd + K` | Command bar (search actions) |

---

## 6. Contact / Details Sidebar (Right Panel)

### Sections (top to bottom)

#### Contact Information
- **Avatar** (large, ~64px)
- **Name** (editable inline)
- **Email** / **Phone** (clickable)
- **Location** / **Company**
- **Social profiles** (links)
- **Bio / Description**

#### Conversation Actions
| Action | Control |
|---|---|
| **Assigned Agent** | Dropdown selector |
| **Assigned Team** | Dropdown selector |
| **Priority** | Dropdown (None, Urgent, High, Medium, Low) |
| **Labels** | Multi-select tags with `+ Add Label` button |
| **Participants** | List of involved agents |

#### Conversation Information
- **Conversation ID**
- **Created at** timestamp
- **Channel / Inbox** name and icon
- **Browser / OS** info (for web widget conversations)
- **IP / Location** (if available)

#### Captain AI (Copilot)
- **Copilot panel** accessible from the sidebar.
- Shows AI-generated **conversation summary**.
- **Suggested replies** that agents can use or modify.
- **Previous conversation context** from the same contact.
- **Knowledge base lookups** — relevant help articles.

#### Custom Attributes
- Key-value pairs defined per account.
- Editable inline from the sidebar.
- Supports text, number, date, list, link types.

#### Previous Conversations
- List of past conversations with the same contact.
- Shows status, timestamp, and preview.
- Clickable to navigate to the conversation.

#### Macros
- Quick-action buttons for running saved automation sequences.

---

## 7. Color Palette

### Brand / Primary
| Token | Value | Usage |
|---|---|---|
| `woot-500` (Primary) | `#1F93FF` | Primary buttons, links, active states, widget accent |
| `woot-600` | Darker blue | Hover states on primary elements |
| `woot-400` | Lighter blue | Backgrounds, subtle accents |
| `woot-25` / `woot-50` | Very light blue tint | Selected conversation background, hover states |

### Semantic Colors
| Purpose | Light Mode | Dark Mode |
|---|---|---|
| **Background (page)** | `#FFFFFF` / `white` | `#151718` / very dark grey |
| **Background (surface)** | `#F8FAFC` / `slate-50` | `#1E2023` / dark grey |
| **Background (sidebar)** | `#F1F5F9` / `slate-100` | `#1A1C1E` |
| **Text (primary)** | `#0F172A` / `slate-900` | `#F1F5F9` / `slate-100` |
| **Text (secondary)** | `#64748B` / `slate-500` | `#94A3B8` / `slate-400` |
| **Text (muted)** | `#94A3B8` / `slate-400` | `#64748B` / `slate-500` |
| **Border** | `#E2E8F0` / `slate-200` | `#334155` / `slate-700` |
| **Success** | `#16A34A` / green-600 | Resolve buttons, online status |
| **Warning** | `#F59E0B` / amber-500 | Private notes, SLA warnings |
| **Error / Danger** | `#DC2626` / red-600 | Delete actions, SLA breaches |
| **Info** | `#1F93FF` / woot-500 | Notifications, links |

### Private Note Specific
- Background: `#FEF9C3` / `yellow-100` (light) or `#422006` / muted amber (dark).
- Border: `#FDE68A` / `yellow-200`.

### Status Colors
| Status | Color |
|---|---|
| Open | Green |
| Pending | Yellow / Amber |
| Snoozed | Blue / Indigo |
| Resolved | Grey / Muted |

### Dark Mode
- Chatwoot supports **dark mode** for both the agent dashboard and the customer-facing widget.
- Widget dark mode is toggled via `darkMode: "auto"` (follows system preference) or explicitly set.
- Dashboard dark mode is a user preference toggle.
- Uses CSS custom properties (`--color-*`) for runtime theme switching.

---

## 8. Typography

### Font Family
- **Primary font:** `Inter` (system font fallback stack: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif`).
- **Plus Jakarta Sans** has been referenced in some newer Chatwoot UI iterations, potentially as a heading or accent font.
- The codebase uses CSS variables for font-family to allow runtime customization.

### Font Sizes (approximate)
| Element | Size | Weight |
|---|---|---|
| **Page headings (H1)** | 24px | 700 (Bold) |
| **Section headings (H2)** | 18–20px | 600 (Semibold) |
| **Conversation card — Contact name** | 14px | 600 (Semibold) |
| **Conversation card — Preview text** | 13px | 400 (Regular) |
| **Conversation card — Timestamp** | 12px | 400 (Regular) |
| **Message bubble text** | 14px | 400 (Regular) |
| **Activity messages** | 12–13px | 400 (Regular), italic or muted |
| **Label pills** | 11–12px | 500 (Medium) |
| **Sidebar nav tooltips** | 12px | 500 (Medium) |
| **Input placeholder** | 14px | 400 (Regular) |
| **Button text** | 14px | 500–600 |

### Font Scaling
- Chatwoot introduced **font scaling** (6 size options) so agents can adjust the base font size to their preference. This applies a CSS variable multiplier across the UI.

### Line Heights
- Body text: ~1.5 (24px on 16px base).
- Compact UI elements (cards, badges): ~1.25–1.3.

---

## 9. Micro-interactions

### Transitions & Animations
| Element | Behavior |
|---|---|
| **Sidebar panel open/close** | Slide-in from right with `transform: translateX()` transition (~200–300ms ease). |
| **Conversation selection** | Instant background color transition (~150ms). |
| **Hover on conversation card** | Background fade-in (~100ms). Checkbox appears with opacity transition. |
| **Resolve button** | Color transition (blue/green > grey) + icon change (checkmark > reopen arrow). |
| **Typing indicator** | Three animated bouncing dots in a bubble. |
| **New message arrival** | Smooth scroll-to-bottom. If user has scrolled up, a "New message" toast pill appears at the bottom. |
| **Toast notifications** | Slide-in from top-right, auto-dismiss after ~3–5 seconds. Success (green), error (red), info (blue). |
| **Command bar (`Cmd+K`)** | Modal overlay with fade + scale-up animation, similar to Spotlight/Raycast. |
| **Dropdown menus** | Fade + slight translateY transition (~150ms). |
| **Modal dialogs** | Backdrop fade-in + modal scale-up (~200ms). |

### Loading States
- **Conversation list:** Skeleton placeholders (grey shimmer blocks mimicking card layout).
- **Message loading:** Spinner or skeleton bubbles.
- **Initial page load:** Full-page spinner with Chatwoot logo.
- **Inline actions (resolve, assign):** Button shows spinner/loading state while API call completes.

### Audio Feedback
- **New message notification:** Configurable audio chime when a new message arrives.
- **Browser push notifications** with sound (configurable per event type).

---

## 10. HITL / Bot Integration

### Bot Message Flow
1. **Bot-connected inbox:** When an agent bot is attached to an inbox, new conversations start with **"pending" status** (not "open").
2. **Bot handles initial triage:** Bot responds via API. Messages appear as left-aligned bubbles with a **bot icon** (robot emoji or configured avatar).
3. **Handoff to human:** Bot changes conversation status to **"open"** via API. The conversation moves from "Pending" to the agent's queue.
4. **Activity message:** An activity message appears in the chat thread: *"Conversation was moved from pending to open"*.
5. **Agent takes over:** Agent sees full conversation history including bot messages.
6. **Return to bot:** Agent can mark conversation as "pending" to return it to the bot queue.

### Captain AI (Copilot) UI
- **Copilot panel:** Opens in the right sidebar (or as a dedicated tab within the contact panel).
- **Suggested replies:** Shown as clickable cards that the agent can insert into the composer or edit before sending.
- **Conversation summary:** Auto-generated summary at the top of the Copilot panel.
- **Knowledge base integration:** Relevant articles surfaced based on conversation context.
- **Custom instructions:** Admins can set model instructions and handoff/resolve messages in a configuration panel with a built-in **playground** to test behavior.
- **AI actions in composer:** A sparkle icon (✨) in the reply box offers: reply suggestions, tone adjustment, translation, expand/shorten text.

### Visual Indicators for Bot vs Human
| Indicator | Details |
|---|---|
| **Pending status** | Conversation is in bot's queue. Shown in "Pending" tab. |
| **Bot avatar** | Distinct from agent avatars. Often a robot icon. |
| **Activity messages** | "Handoff" events logged as activity messages in the thread. |
| **Typing indicator** | Bot can toggle typing indicator via API before responding. |

---

## 11. Status Indicators

### Conversation Statuses
| Status | Visual Treatment | Location |
|---|---|---|
| **Open** | Default state. No special badge. Listed under "All Conversations" and agent's "Mine" tab. | Conversation list, header. |
| **Pending** | Amber/yellow indicator. Appears in "Pending" tab in conversation list. Bot-managed conversations default here. | Conversation list tab, header icon (mobile). |
| **Snoozed** | Blue/indigo clock icon. Shows snooze-until time on hover. Conversations reappear when snooze expires. | Separate "Snoozed" filter/tab. Header icon. |
| **Resolved** | Grey/muted styling. Green checkmark during resolution. Moved out of active conversation list (filterable). | Conversation list (with filter), header button state change. |

### Agent Availability
| Status | Visual |
|---|---|
| **Online** | Green dot on avatar (sidebar + conversation assignments). |
| **Offline** | Grey/hollow dot or no dot. |
| **Busy** | Yellow dot (if configured). |

### SLA Indicators
- **Timer badge** in conversation header.
- **Color progression:** Green (within SLA) > Yellow (approaching) > Red (breached).
- **SLA hit rate** visible in reports.

### Priority Badges
| Priority | Color |
|---|---|
| Urgent | Red |
| High | Orange |
| Medium | Yellow |
| Low | Blue/Grey |
| None | No badge |

---

## 12. Responsive Behavior

### Breakpoints (approximate)
| Breakpoint | Behavior |
|---|---|
| **Desktop (>1280px)** | Full four-column layout. All panels visible. Conversation list width increases on >2xl screens. |
| **Tablet / Medium (768–1280px)** | Contact panel hidden by default (toggle to overlay). Three-column layout. |
| **Mobile (<768px)** | Single-column view. Navigation becomes bottom tab bar or hamburger menu. Conversation list and chat area are separate screens (tap to drill in, back to return). |

### Mobile-Specific Adaptations
- **Bottom navigation bar** replaces the left sidebar icon rail.
- **Conversation list** is full-width on mobile.
- **Tapping a conversation** navigates to a full-screen chat view.
- **Back button** returns to conversation list.
- **Contact panel** accessible via header icon, opens as full-screen overlay.
- **Composer** adapts with larger touch targets.
- **Smoother transitions** between views (slide animations).
- **Touch-friendly:** Larger hit areas for buttons, swipe gestures for actions (e.g., swipe to resolve).

### Progressive Disclosure
- On smaller screens, secondary information (labels, custom attributes, previous conversations) is hidden behind expandable sections or moved to dedicated screens.
- The Copilot panel becomes a full-screen overlay rather than a sidebar section.

---

## Key Technical Implementation Notes

### Framework & Build
- **Vue 3** SPA (migrated from Vue 2).
- **Vite** build tool.
- **pnpm** package manager.
- **Vuex** for state management (domain-driven modules: conversations, contacts, inboxes, agents, etc.).
- **Tailwind CSS** for utility classes + custom CSS variables for theming.
- **vue-virtual-scroller** for conversation list performance.

### Design System Resources
- **Style guide:** [styleguide.chatwoot.com](https://styleguide.chatwoot.com/)
- **Design repo:** [github.com/chatwoot/design](https://github.com/chatwoot/design)
- **UI components:** [github.com/chatwoot/ui](https://github.com/chatwoot/ui)
- **Frontend handbook:** [chatwoot.com/hc/handbook/articles/frontend-guidelines-30](https://www.chatwoot.com/hc/handbook/articles/frontend-guidelines-30)

### CSS Architecture
- CSS custom properties (variables) for colors, spacing, font-size, font-weight, shadows, border-radius.
- Scoped component styles within Vue SFCs.
- Utility classes (Tailwind) preferred over custom CSS.
- Runtime theme switching via CSS variable overrides (light/dark mode).

---

## Sources

- [Chatwoot Frontend Dashboard (DeepWiki)](https://deepwiki.com/chatwoot/chatwoot/3-frontend-dashboard)
- [Navigation and Layout (DeepWiki)](https://deepwiki.com/chatwoot/chatwoot/3.2-navigation-and-layout)
- [Conversation List UI (DeepWiki)](https://deepwiki.com/chatwoot/chatwoot/5.4-conversation-management-ui)
- [Chatwoot Design Repo](https://github.com/chatwoot/design)
- [Chatwoot UI Components](https://github.com/chatwoot/ui)
- [Chatwoot Style Guide](https://styleguide.chatwoot.com/)
- [Frontend Guidelines (Handbook)](https://www.chatwoot.com/hc/handbook/articles/frontend-guidelines-30)
- [Brand Guidelines (Handbook)](https://chatwoot.help/hc/handbook/articles/brand-guidelines-4)
- [Dashboard Basics (Lesson 2)](https://www.chatwoot.com/hc/user-guide/articles/1677231493-lesson-2-dashboard-basics)
- [Mastering Core Features (Lesson 3a)](https://www.chatwoot.com/hc/user-guide/articles/1677235281-lesson-3-a-mastering-core-features)
- [Conversation Filters](https://www.chatwoot.com/hc/user-guide/articles/1677688192-how-to-use-conversation-filters)
- [Custom Attributes](https://www.chatwoot.com/hc/user-guide/articles/1677502327-how-to-create-and-use-custom-attributes)
- [Agent Bots](https://www.chatwoot.com/hc/user-guide/articles/1677497472-how-to-use-agent-bots)
- [Captain AI (Copilot)](https://www.chatwoot.com/hc/user-guide/articles/1738110272-how-to-use-captain-copilot)
- [Introducing Captain](https://www.chatwoot.com/blog/introducing-captain/)
- [Keyboard Shortcuts](https://www.chatwoot.com/features/keyboard-shortcuts/)
- [Canned Responses](https://www.chatwoot.com/hc/user-guide/articles/1677501325-how-to-create-saved-reply-templates-with-canned-responses)
- [Labels Feature](https://www.chatwoot.com/features/labels/)
- [Bulk Actions](https://www.chatwoot.com/features/bulk-actions/)
- [Widget Customization](https://www.chatwoot.com/features/widget-customization)
- [Dark Mode Widget](https://www.chatwoot.com/hc/user-guide/articles/1677587636-how-to-enable-dark-mode-on-live_chat-widget)
- [Notification Settings](https://www.chatwoot.com/hc/user-guide/articles/1731478912-setting-up-notifications)
- [Font Scaling Changelog](https://www.chatwoot.com/blog/changelog-week-of-march/)
- [Message Bubble Orientation PR #11348](https://github.com/chatwoot/chatwoot/pull/11348)
- [Bubble UI Fixes PR #10643](https://github.com/chatwoot/chatwoot/pull/10643)
- [Sidebar/Chatlist Design PR #10572](https://github.com/chatwoot/chatwoot/pull/10572)
- [Mobile UI Improvements Blog](https://www.chatwoot.com/blog/easier-custom-domains-and-mobile-ui-improvements/)
- [v2.8.0 Layout Switching](https://www.chatwoot.com/blog/v2-8-0/)
- [Chatwoot Tailwind Config](https://github.com/chatwoot/chatwoot/blob/develop/tailwind.config.js)
- [Brandfetch Chatwoot Assets](https://brandfetch.com/chatwoot.com)
