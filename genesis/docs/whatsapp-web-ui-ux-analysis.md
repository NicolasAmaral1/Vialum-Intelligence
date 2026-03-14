# WhatsApp Web — UI/UX Design Patterns Analysis

> Comprehensive reference document for informing the PRD of a business chat tool.
> Compiled: 2026-03-13

---

## 1. Layout Architecture

WhatsApp Web uses a **3-panel layout** rendered with CSS Flexbox/Grid:

### Panel Structure

| Panel | Role | Width | Min-width |
|-------|------|-------|-----------|
| **Left Sidebar** | Search + Conversation list | ~30% (~400px on 1440px screen) | ~340px |
| **Center Panel** | Active chat (messages + composer) | ~70% (fills remaining) | ~450px |
| **Right Panel** | Contact/Group info (conditional) | ~30-35% (~420px) | Slides over or splits the center panel |

### Key Behaviors
- The left sidebar and center panel share the viewport horizontally in a fixed ratio (~30/70).
- The right panel (contact info) opens **on demand** — it slides in from the right, compressing the center chat panel. On narrow viewports it may overlay entirely.
- At the very top of the full viewport, there is a thin **teal/green header strip** (`#00A884` in light mode) visible above both the sidebar and chat panels.
- When no chat is selected, the center panel shows a landing/placeholder screen with the WhatsApp logo and a "Download WhatsApp for Windows" prompt.
- The layout is **not responsive to mobile breakpoints** — WhatsApp Web is designed for desktop-width viewports (min ~768px usable).

### Structural HTML/CSS Pattern
```
[app-wrapper] display: flex
  [sidebar]         flex: 0 0 30%; display: flex; flex-direction: column
    [sidebar-header]
    [search-bar]
    [chat-filters]   (All | Unread | Favorites | Groups)
    [conversation-list] flex: 1; overflow-y: auto
  [main]            flex: 1; display: flex; flex-direction: column
    [chat-header]
    [messages-area]  flex: 1; overflow-y: auto; background: doodle-pattern
    [composer]
  [contact-info]    conditional; flex: 0 0 35%
```

---

## 2. Conversation List (Left Sidebar)

### Chat List Item Anatomy

Each conversation row is ~72px tall and contains:

```
[avatar: 49px circle] [text-block                          ] [meta-block   ]
                        [name — bold, 17px, single line     ] [timestamp    ]
                        [last-msg — gray, 14px, single line ] [unread badge ]
```

### Element Details

| Element | Specification |
|---------|--------------|
| **Avatar** | 49px diameter circle. Individual: contact photo or default silhouette. Group: group icon or custom image. |
| **Contact/Group Name** | Bold (font-weight: 400-500), ~17px, color: primary text (`#111B21` light / `#E9EDEF` dark), single-line truncated with ellipsis. |
| **Last Message Preview** | Regular weight, ~14px, color: secondary text (`#667781` light / `#8696A0` dark). Prefixed with sender name in groups ("John: Hey..."). Single line, ellipsis overflow. Includes media type icons inline (camera icon for photos, mic for voice, document icon, etc.). |
| **Timestamp** | ~12px, right-aligned. Color: secondary text normally, green (`#00A884`) when unread. Shows "HH:MM" for today, "Yesterday", or "MM/DD/YYYY" for older. |
| **Unread Count Badge** | Green circle (`#25D366`) with white text, positioned below timestamp. Shows count (1, 2, ... 99+). For muted chats: gray badge instead of green. |
| **Pinned Indicator** | Small pin icon (📌) shown at bottom-right of the row, below the timestamp area. |
| **Muted Indicator** | Small muted/speaker-off icon shown next to or below the timestamp. |
| **Delivery Status** | Double-tick icons shown before the last message text (for messages you sent). |

### States

| State | Visual |
|-------|--------|
| **Default** | White/transparent background |
| **Hover** | Light gray background (`#F5F6F6` light / `#202C33` dark) |
| **Active/Selected** | Slightly deeper gray/tinted background (`#F0F2F5` light / `#2A3942` dark) |
| **Unread** | No distinct background, but bold last message + green timestamp + green badge |

### Chat Filters (Top Bar)
Above the conversation list, a horizontal row of filter chips: **All** | **Unread** | **Favorites** | **Groups**. These are pill-shaped buttons with a teal/green active state.

---

## 3. Chat Area (Center Panel)

### 3.1 Message Bubbles

#### Colors

| Mode | Outgoing (sent) | Incoming (received) |
|------|-----------------|---------------------|
| **Light** | `#D9FDD3` (light green) | `#FFFFFF` (white) |
| **Dark** | `#005C4B` (dark teal-green) | `#202C33` (dark gray) |

> Note: Older references cite `#DCF8C6` for outgoing; WhatsApp updated to `#D9FDD3` in their 2022-2023 UI refresh.

#### Shape and Dimensions
- **Border-radius:** 7.5px (slightly rounded corners, asymmetric — the corner with the "tail" has 0 radius)
- **Max-width:** ~65% of the chat area width (roughly 500-520px at 1440px viewport)
- **Min-width:** Determined by content, but timestamps force a minimum of ~80px
- **Padding:** ~6px 7px 8px 9px (tight padding; varies slightly)
- **Box-shadow:** `0 1px 0.5px rgba(0, 0, 0, 0.13)` — very subtle drop shadow

#### Tail (Speech Bubble Pointer)
- Created via CSS `::before` pseudo-element
- Small triangular nub (~8px) at the **top** of the bubble
- **Outgoing:** tail on the top-right, pointing right
- **Incoming:** tail on the top-left, pointing left
- The tail only appears on the **first message** in a consecutive group from the same sender
- Implemented with a combination of `border` tricks or SVG path clipping

#### Spacing Rules
- **Same sender, consecutive:** ~2px vertical gap (tight grouping)
- **Different sender:** ~10-12px vertical gap
- **After a date separator:** ~12px top margin

#### Alignment
- Outgoing messages: right-aligned (`margin-left: auto`)
- Incoming messages: left-aligned (`margin-right: auto`)

### 3.2 Timestamps

#### Inline Timestamps
- Displayed at the **bottom-right inside** each message bubble
- Font size: ~11px
- Color: muted/secondary text (`#667781` light / `#FFFFFF99` dark)
- Format: "HH:MM" (24h or 12h depending on locale)
- Paired with delivery status ticks for outgoing messages

#### Date Separators
- Centered in the chat area
- Rounded pill-shaped badge: `border-radius: 7.5px`, background: `#FFFFFF` with shadow (light) or `#182229` (dark)
- Padding: ~5px 12px
- Text: ~12.5px, color: `#54656F`
- Content: "TODAY", "YESTERDAY", or full date "MM/DD/YYYY"
- Subtle box-shadow: `0 1px 0.5px rgba(0,0,0,0.13)`

### 3.3 Read Receipts (Tick Marks)

Shown at bottom-right of outgoing message bubbles, left of the timestamp:

| Status | Icon | Color |
|--------|------|-------|
| **Sending** (clock) | Small clock icon | Gray |
| **Sent** | Single checkmark (✓) | Gray (`#667781`) |
| **Delivered** | Double checkmark (✓✓) | Gray (`#667781`) |
| **Read** | Double checkmark (✓✓) | Blue (`#53BDEB`) |

- Ticks are SVG icons, ~16x11px
- In group chats, double blue ticks appear only when **all** participants have read the message

### 3.4 Group Messages — Sender Identification

- **Sender name** appears above the message bubble (inside the bubble, at the top)
- Font size: ~12.5-13px, font-weight: 500-600
- Each participant is assigned a **deterministic color** based on a hash of their phone number/ID, mapped to a palette of ~256 colors extracted using Google's Palette API from profile pictures
- The system avoids assigning the same color to two participants in the same group when possible
- The sender name is clickable — it opens the contact info panel

### 3.5 Media Messages

| Type | Bubble Behavior |
|------|----------------|
| **Image** | Rendered inline inside the bubble. Rounded corners (same border-radius as bubble). Max-width ~330px. Caption text appears below the image inside the same bubble. |
| **Video** | Thumbnail with a centered play button overlay (▶ inside a semi-transparent circle). Duration shown at top-right corner. |
| **Audio/Voice Note** | Horizontal waveform visualization bar with play/pause button on the left. Green waveform for outgoing, gray for incoming. Duration displayed. Playback speed button (1x, 1.5x, 2x). Small avatar circle on the left for voice messages. |
| **Document** | Document icon (colored by file type — red for PDF, blue for DOC, green for XLS). File name, file size, and file type label. Download icon on the right side. |
| **Sticker** | Rendered without a bubble background — floats directly on the chat wallpaper. Larger size than regular media (~190px). No timestamp visible on the sticker itself (timestamp shown separately). |
| **GIF** | Auto-plays in a loop. "GIF" label at top corner. Behaves like an image otherwise. |
| **Contact Card** | Special bubble with contact avatar, name, and "View Contact" button. |
| **Location** | Map thumbnail (Google/Apple Maps) with address text below. |

### 3.6 Reply/Quote

When replying to a specific message:
- A **quoted message bar** appears at the top inside the new message bubble
- Left border: 4px solid, colored with the original sender's assigned color
- Background: slightly darker tint of the bubble color (~5% darker)
- Content: original sender name (colored) + first line of original message (truncated, ~2 lines max)
- If quoting media: small thumbnail (~54px) on the right side of the quote bar
- The quoted block is clickable — it scrolls to and highlights the original message

---

## 4. Header Bar (Chat Panel Top)

### Layout
```
[back-arrow?] [avatar: 40px] [name + status]           [video-call] [search] [menu ⋮]
```

### Elements

| Element | Detail |
|---------|--------|
| **Avatar** | 40px circle, same as sidebar but smaller |
| **Contact/Group Name** | Bold, ~16-17px, white or primary text color. Single line, ellipsis. Clickable (opens contact info panel). |
| **Status Line** | Below name, ~13px, secondary text. Individual: "online" (green) / "last seen today at HH:MM" / "typing..." Group: "participant1, participant2, ..." or "X is typing..." |
| **Video Call Button** | Camera icon |
| **Voice Call Button** | Phone icon (sometimes not shown on Web) |
| **Search Button** | Magnifying glass icon — opens in-chat search panel |
| **Menu Button** | Three vertical dots (⋮) — dropdown: Contact info, Select messages, Close chat, Mute, Disappearing messages, Clear chat, Delete chat, Block, Report |

### Background
- Light mode: `#F0F2F5` (light gray) — matches the sidebar header
- Dark mode: `#202C33`

---

## 5. Composer (Message Input Area)

### Layout
```
[emoji 😊] [attach 📎] [input field                          ] [voice 🎙 / send ➤]
```

### Elements

| Element | Detail |
|---------|--------|
| **Emoji Button** | Smiley face icon on the far left. Opens emoji/GIF/sticker panel that slides up, replacing the keyboard area. Panel has tabs: Emoji, GIF, Stickers. Emoji panel has category bar (Smileys, Animals, Food, etc.) and search. |
| **Attachment Button** | Paperclip (📎) icon. Opens a **pop-up menu** above the composer with colored circular icons: Document (purple/indigo), Photos & Videos (blue/teal), Camera (pink/red), Contact (blue), Poll (green), Sticker (teal). On Web, items appear as a vertical stack of circular buttons floating upward. |
| **Input Field** | Rounded rectangle (`border-radius: 8px`), background: `#FFFFFF` (light) / `#2A3942` (dark). Placeholder: "Type a message". Multi-line capable — grows vertically up to ~5 lines, then scrolls internally. Font: 15px. Supports rich text formatting shortcuts (bold, italic, strikethrough, monospace, lists, block quotes). |
| **Voice Message Button** | Microphone icon — visible when input is empty. Hold to record; slide left to cancel; slide up to lock (hands-free recording). During recording: red dot + timer + waveform + cancel/send buttons. |
| **Send Button** | Green send arrow (➤) — replaces the mic icon when text is present. Transition is instant (no animation). Color: `#00A884` (green). |

### Emoji Shortcut
Typing `:` followed by letters triggers inline emoji autocomplete suggestions above the input field.

---

## 6. Contact Info Panel (Right Panel)

Opens when clicking on the contact name/avatar in the chat header.

### Layout (top to bottom, scrollable)
```
[X close button]                                    [header bar]
[large profile photo — ~200px, centered]
[name — large, bold]
[phone number]
[about/status text — italic, secondary color]
─────────────────────────────────
[Media, Links, and Docs]         [→ arrow]
  [horizontal thumbnail strip — last 3-5 media items]
─────────────────────────────────
[Starred Messages]               [→ arrow]
─────────────────────────────────
[Disappearing Messages]          [current setting]
─────────────────────────────────
[Encryption — lock icon]
  "Messages are end-to-end encrypted..."
─────────────────────────────────
[Group: Participants list]
  [search participants]
  [avatar + name rows, scrollable]
  [admin badge next to admin names]
  [Add participant button]
─────────────────────────────────
[Shared Groups]                  [count]
  [group avatars + name list]
─────────────────────────────────
[Block contact — red text]
[Report contact — red text]
[Delete chat — red text]
```

### Group-Specific Additions
- **Group Description** appears near the top (editable by admins)
- **Participant List** shows all members with:
  - Avatar (32px circle)
  - Name
  - "Admin" badge (small gray label next to name)
  - Custom tags/roles (newer feature — user-editable labels)
- **Exit Group** button at bottom (red text)
- **Media, Links, and Docs** tab section with 3 sub-tabs for filtering

### Panel Behavior
- Background: `#FFFFFF` (light) / `#111B21` (dark)
- Slides in from the right with a subtle animation (~200ms ease)
- Close button (X) at top-left of the panel

---

## 7. Color Palette

### Brand Colors

| Name | Hex | Usage |
|------|-----|-------|
| WhatsApp Green (primary) | `#25D366` | Logo, unread badge, accents |
| Teal Green | `#128C7E` | Secondary brand, icon backgrounds |
| Dark Teal | `#075E54` | Header (older versions), brand |
| New Green | `#00A884` | Current primary accent, send button, active filters |
| Checkmark Blue | `#53BDEB` | Read receipt blue ticks |

### Light Mode

| Element | Color |
|---------|-------|
| App Background (behind panels) | `#D1D7DB` |
| Sidebar Background | `#FFFFFF` |
| Sidebar Header | `#F0F2F5` |
| Chat Header | `#F0F2F5` |
| Chat Area Background | `#EFEAE2` (with doodle pattern overlay) |
| Outgoing Bubble | `#D9FDD3` |
| Incoming Bubble | `#FFFFFF` |
| Composer Background | `#F0F2F5` |
| Input Field Background | `#FFFFFF` |
| Primary Text | `#111B21` |
| Secondary Text | `#667781` |
| Timestamp Text | `#667781` |
| Date Separator | `#FFFFFF` bg, `#54656F` text |
| System Message | `#FFEDB3` bg (yellowish), `#54656F` text |
| Dividers/Borders | `#E9EDEF` |
| Hover Background | `#F5F6F6` |
| Selected Chat | `#F0F2F5` |

### Dark Mode

| Element | Color |
|---------|-------|
| App Background | `#0B141A` |
| Sidebar Background | `#111B21` |
| Sidebar Header | `#202C33` |
| Chat Header | `#202C33` |
| Chat Area Background | `#0B141A` (with doodle pattern overlay, muted) |
| Outgoing Bubble | `#005C4B` |
| Incoming Bubble | `#202C33` |
| Composer Background | `#202C33` |
| Input Field Background | `#2A3942` |
| Primary Text | `#E9EDEF` |
| Secondary Text | `#8696A0` |
| Timestamp Text (inside bubble) | `rgba(255,255,255,0.6)` |
| Date Separator | `#182229` bg, `#8696A0` text |
| Dividers/Borders | `#222D34` |
| Hover Background | `#202C33` |
| Selected Chat | `#2A3942` |

---

## 8. Typography

### Font Stack
```css
font-family: 'Segoe UI', Helvetica Neue, Helvetica, Lucida Grande, Arial, Ubuntu, Cantarell, Fira Sans, sans-serif;
```
- **macOS:** Renders as San Francisco (via system-ui)
- **Windows:** Segoe UI
- **Linux:** Ubuntu / Cantarell / Fira Sans

### Font Sizes

| Element | Size | Weight | Notes |
|---------|------|--------|-------|
| Contact/Group Name (sidebar) | ~17px | 400 | Single-line, ellipsis truncation |
| Last Message Preview (sidebar) | ~14px | 400 | Secondary color |
| Timestamp (sidebar) | ~12px | 400 | Right-aligned |
| Chat Header Name | ~16px | 500 | Bold-ish |
| Chat Header Status | ~13px | 400 | Secondary color |
| Message Text | ~14.2px | 400 | Main body text in bubbles |
| Message Timestamp (inline) | ~11px | 400 | Bottom-right of bubble |
| Sender Name (group) | ~12.8px | 500 | Colored per-sender |
| Date Separator | ~12.5px | 400 | Centered pill |
| System Message | ~12.5px | 400 | Centered, muted |
| Composer Input | ~15px | 400 | Slightly larger than message text |
| Unread Badge | ~12px | 600 | White on green |
| Contact Info Name | ~20px | 500 | Large heading in right panel |
| Contact Info "About" | ~14px | 400 | Italic, secondary color |

### Monospace (Code Blocks)
```css
font-family: 'SF Mono', Monaco, Menlo, Consolas, 'Courier New', monospace;
```

---

## 9. Micro-interactions

### Message Appear Animation
- New messages slide up from the bottom of the message area with a very subtle fade-in (~150ms)
- No dramatic animation — prioritizes perceived speed

### Typing Indicator
- Shows as a **chat bubble** in the conversation (replaced the older header-only "typing..." text)
- Contains **three animated dots** (bouncing vertically in sequence, ~200ms offset between each)
- In groups: shows the sender's **profile picture** next to the typing bubble, with their name
- The typing event auto-dismisses after **25 seconds** of inactivity

### Voice Recording Animation
- **Hold mic button:** Composer area transforms — input field replaced by:
  - Red recording dot (pulsing)
  - Timer counting up (MM:SS)
  - Audio waveform visualization (real-time)
  - "Slide left to cancel ←" text
- **Slide up to lock:** Transforms to locked recording mode — shows pause/stop buttons
- **Release or tap send:** Recording stops and voice note is sent

### Emoji Reactions
- **Hover over message:** A small emoji icon (😊) appears to the top-right (incoming) or top-left (outgoing) of the bubble
- **Click emoji icon:** A reaction bar appears with 6 quick reactions (👍 ❤️ 😂 😮 😢 🙏) + a "+" button for full emoji picker
- **Reaction display:** Small emoji bubbles appear at the bottom of the message, with a count if >1. Clicking shows who reacted.
- **Celebration reactions:** Certain emojis (🎉 🥳) trigger a **confetti animation** that falls across the chat area

### Message Selection
- Long-press or checkbox mode enables multi-select
- Selected messages get a tinted background overlay (`#00A88420` — green with low opacity)

### Context Menu
- **Right-click or hover-arrow (⌄):** Dropdown menu appears with: Reply, React, Forward, Pin, Star, Delete, Copy (for text)
- Menu slides in with a subtle scale animation

### Scroll-to-Bottom Button
- When scrolled up in a conversation, a circular button with a down arrow (↓) appears at the bottom-right of the message area
- If there are unread messages, the button shows an unread count badge
- Clicking it smoothly scrolls to the most recent message

---

## 10. Group-Specific UX

### Differences from 1:1 Chats

| Feature | 1:1 Chat | Group Chat |
|---------|----------|------------|
| **Sender Name** | Not shown on bubbles | Shown above each bubble (colored) |
| **Header Status** | "online" / "last seen..." | "participant1, participant2, +N" |
| **Typing Indicator** | "typing..." | "John is typing..." or "John, Jane are typing..." |
| **Read Receipts** | Blue when recipient reads | Blue only when ALL members read |
| **Admin Controls** | N/A | Group settings, add/remove members, make admin |
| **Group Description** | N/A | Editable text at top of group info |
| **Right Panel** | Contact info + shared groups | Group info + participant list + group settings |

### Admin Badge
- Shown as a small pill/label with text "Admin" or "Group admin" in secondary text color
- Appears next to the member's name in the participant list (right panel)
- Not shown on message bubbles themselves

### Group Description
- Displayed at the very top of the chat area as a system message banner
- Also shown in the group info panel
- Editable by admins; shown in secondary text

### Member Tags (newer feature)
- Custom labels that members can set for themselves
- Shown next to their name in the participants list
- Helps identify roles without admin intervention

---

## 11. System Messages

System messages are **centered**, non-bubble messages displayed in the chat flow:

### Visual Style
- Background: Rounded pill shape, similar to date separators
- Background color: `#FFFFFF` with shadow (light) / `#182229` (dark)
- Some system messages use a yellowish background: `#FFEDB3` / `#34290A` (for encryption notices)
- Text: ~12.5px, centered, color: `#54656F` (light) / `#8696A0` (dark)
- No tail or directional indicator

### Types and Examples

| Type | Example Text |
|------|-------------|
| **Encryption Notice** | "Messages and calls are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them. Tap to learn more." (with lock icon 🔒) |
| **Date Separator** | "TODAY", "YESTERDAY", "03/12/2026" |
| **Member Added** | "You added John" / "John was added" |
| **Member Left** | "John left" |
| **Member Removed** | "You removed John" |
| **Group Created** | "You created group 'Team Alpha'" |
| **Admin Change** | "You're now an admin" |
| **Group Name Changed** | "John changed the subject to 'New Group Name'" |
| **Group Icon Changed** | "John changed this group's icon" |
| **Disappearing Messages** | "You turned on disappearing messages. New messages will disappear from this chat after 24 hours." |
| **Missed Call** | "Missed voice call" / "Missed video call" (with phone icon) |
| **Blocked** | "You blocked this contact. Tap to unblock." |

---

## 12. Chat Wallpaper / Background

### Default Doodle Pattern
- The chat area background is a **repeating tile pattern** of hand-drawn doodle icons
- Icons include: clocks, speech bubbles, phones, music notes, envelopes, hearts, emojis, cameras, globes, documents, magnifying glasses, etc.
- The pattern is a **single PNG/SVG tile** (~400x400px) that repeats via `background-repeat: repeat`
- Very low opacity/contrast — the doodles are barely visible, creating texture without distraction

### Light Mode Background
- Base color: `#EFEAE2` (warm beige/cream)
- Doodle pattern overlaid at ~5-8% opacity in a slightly darker tone
- The overall effect is a warm, paper-like texture

### Dark Mode Background
- Base color: `#0B141A` (very dark blue-black)
- Same doodle pattern but in a slightly lighter tone at very low opacity (~3-5%)
- Nearly invisible — provides subtle texture

### Customization
- Users can change the chat wallpaper:
  - Solid colors (palette of ~30 preset colors)
  - Custom image upload
  - Toggle the doodle pattern on/off
  - Adjust brightness (dark mode only)
  - Set per-chat or globally
- Wallpaper changes only affect the chat area — sidebar and header remain unchanged

---

## 13. Additional Design Patterns Worth Noting

### Search (In-Chat)
- Opens a **search panel** that slides in from the right (replaces contact info panel position)
- Input field at top with "Search..." placeholder
- Results highlighted in the chat with yellow background (`#FFF3C4`)
- Up/Down arrows to navigate between matches
- Match count displayed: "X of Y"

### Forwarded Messages
- Small "Forwarded" label with a forward arrow icon at the top of the bubble
- "Forwarded many times" label (with double arrow) for viral messages
- Text: ~12px, italic, `#667781`

### Starred Messages
- Accessible from contact info panel or main menu
- Starred messages show a small star icon at the bubble bottom, next to the timestamp

### Link Previews
- When a URL is shared, WhatsApp generates a preview card inside the bubble:
  - Thumbnail image (if available)
  - Title (bold, ~14px)
  - Description (2 lines max, ~13px)
  - Domain name (small, green/teal)
  - The URL itself below the preview

### Disappearing Messages Indicator
- Small timer icon (⏱) next to the timestamp inside bubbles
- System message when toggled on/off

---

## Summary: Key Design Principles

1. **Minimal chrome, maximum content.** The UI uses very thin borders, subtle shadows, and muted colors to keep focus on messages.
2. **Consistent bubble metaphor.** Everything (messages, typing indicator, date separators) uses rounded-rectangle bubbles.
3. **Color = semantic meaning.** Green = outgoing/your content. White/gray = incoming/others. Blue = read. Red = recording/destructive.
4. **Progressive disclosure.** Contact info, search, and media are hidden in panels that open on demand, never cluttering the main view.
5. **Density over decoration.** The conversation list packs maximum information (name, preview, time, badges) into a 72px row with no wasted space.
6. **Deterministic identity colors.** Group participant colors are hash-based and consistent, reducing cognitive load.
7. **Subtle motion.** Animations exist but are sub-200ms and functional (not decorative), preserving the app's fast, utilitarian feel.

---

## Sources

- [Reverse Engineering WhatsApp Web's CSS — Elad Shechter (Medium/Anima)](https://medium.com/animaapp/reverse-engineering-whatsapp-webs-css-9239293009f4)
- [CSS Reverse Engineering for WhatsApp Web — Elad Shechter Blog](https://eladsc.dev/2020/03/30/css-reverse-engineering-for-whatsapp-web/)
- [Keeping WhatsApp fresh, simple and approachable — Facebook Design](https://design.facebook.com/blog/whatsapp-user-interface-update/)
- [Why WhatsApp's Chat UI Just Works — Amish Gadhia (Medium/Bootcamp)](https://medium.com/design-bootcamp/why-whatsapps-chat-ui-just-works-and-what-you-can-learn-from-it-bd89fb114423)
- [WhatsApp UI/UX Coding Analysis — Avira Digital Studios (Medium)](https://medium.com/@Aviradigitalstudios/whatsapp-ui-ux-coding-analysis-designing-for-simplicity-and-user-engagement-9313a1da1901)
- [WhatsApp Colors — U.S. Brand Colors](https://usbrandcolors.com/whatsapp-colors/)
- [WhatsApp Color Palette — Design Pieces](https://www.designpieces.com/palette/whatsapp-color-palette-hex-and-rgb/)
- [WhatsApp Color Palette — SchemeColor](https://www.schemecolor.com/whatsapp-2.php)
- [WhatsApp Colors — Mobbin](https://mobbin.com/colors/brand/whatsapp)
- [WhatsApp Dark Mode — Adobe Color](https://color.adobe.com/WhatsApp-dark-color-theme-14633535/)
- [dark-whatsapp Custom Theme — GitHub (vednoc)](https://github.com/vednoc/dark-whatsapp/blob/master/wa.user.styl)
- [How WhatsApp's Typing Indicator Actually Works — Manas Parashar (Medium)](https://parashar--manas.medium.com/how-whatsapps-typing-indicator-actually-works-8a3cf18f2bad)
- [WhatsApp Read Receipts — Cooby](https://www.cooby.co/en/post/whatsapp-read-receipts)
- [Logic Behind WhatsApp Group Member Color — Intertoons](https://intertoons.com/logic-behind-whatsapp-group-member-color.html)
- [WhatsApp Group Member Color Logic — Quora](https://www.quora.com/What-is-the-logic-behind-giving-specific-colours-to-each-contact-in-a-WhatsApp-group)
- [WhatsApp Web Clone — CodeWithFaraz](https://www.codewithfaraz.com/content/114/create-a-whatsapp-web-interface-clone-using-html-and-css)
- [WhatsApp Web UI Clone — CodeWithCurious](https://codewithcurious.com/projects/whatsapp-web-clone-using-html-css-js/)
- [WhatsApp Emoji Reactions — Gadget Hacks](https://smartphones.gadgethacks.com/how-to/use-any-emoji-as-message-reaction-whatsapp-for-ios-android-desktop-and-web-0385080/)
- [WhatsApp Animated Reactions — Croma Unboxed](https://www.croma.com/unboxed/whatsapp-animated-confetti-reaction-new-year)
- [WhatsApp New UI Features — Deccan Herald](https://www.deccanherald.com/technology/whatsapp-gets-refreshed-visual-user-interface-new-features-3016849)
- [WhatsApp Custom Member Tags — WABetaInfo](https://wabetainfo.com/whatsapp-launches-customizable-member-tags-in-group-chats-for-better-organization/)
- [WhatsApp Font — DesignYourWay](https://www.designyourway.net/blog/whatsapp-font/)
- [WhatsApp Doodle Background — DEV Community](https://dev.to/davinaleong/how-to-make-backgrounds-like-the-default-whatsapp-wallpaper-24pc)
- [WhatsApp Original Chat Background — GitHub Gist](https://gist.github.com/abdurrahmanekr/2747d704edec93a06e454eba2653e0df)
