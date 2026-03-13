# PRD — Redesign Frontend Vialum Chat v2.0

> **Status:** Draft
> **Data:** 2026-03-13
> **Autor:** Nicolas + Claude
> **Baseado em:** Análise de Chatwoot, WhatsApp Web, e auditoria do frontend atual

---

## 1. Visão Geral

### Objetivo
Redesenhar o frontend do Vialum Chat para alcançar nível profissional de UX/UI, combinando:
- **WhatsApp Web**: familiaridade de chat, bubbles, agrupamento de mensagens, fluidez
- **Chatwoot**: poder de CRM, HITL, ações de conversa, filtros avançados, command bar
- **Identidade Vialum**: Genesis Lime (#9FEC14), dark-first, fonte Sora, estética premium

### Princípios de Design
1. **Familiar mas premium** — O agente de atendimento deve sentir que está num WhatsApp turbinado, não num sistema corporativo genérico
2. **Densidade sem ruído** — Máxima informação por pixel, sem visual carregado
3. **Dark-first, light available** — Dark mode como padrão, light mode como opção
4. **Motion com propósito** — Animações que informam, não decoram (sub-200ms)
5. **IA como copiloto visível** — Sugestões HITL integradas ao fluxo, nunca intrusivas

---

## 2. Identidade Visual

### Paleta de Cores (Dark Mode — Primário)

| Token | Hex | Uso |
|-------|-----|-----|
| `--primary` | `#9FEC14` | CTAs, badges, glow accents, send button |
| `--primary-hover` | `#8BD410` | Hover em botões primários |
| `--primary-muted` | `rgba(159,236,20,0.12)` | Backgrounds sutis, selected states |
| `--bg-app` | `#0A0A0A` | Background principal da aplicação |
| `--bg-surface` | `#111111` | Cards, painéis, sidebar |
| `--bg-elevated` | `#1A1A1A` | Elementos elevados, popovers |
| `--bg-bubble-out` | `#1A2E0A` | Bubble outgoing (verde escuro sutil) |
| `--bg-bubble-in` | `#1A1A1A` | Bubble incoming |
| `--bg-bubble-note` | `#2A2000` | Private notes (amber escuro) |
| `--text-primary` | `#F0F0F0` | Texto principal |
| `--text-secondary` | `#8A8A8A` | Texto secundário, timestamps |
| `--text-muted` | `#555555` | Placeholders, desabilitados |
| `--border` | `#222222` | Bordas sutis |
| `--border-subtle` | `#1A1A1A` | Divisores quase invisíveis |
| `--success` | `#22C55E` | Online, resolvido |
| `--warning` | `#F59E0B` | Pendente, snooze, private notes |
| `--danger` | `#EF4444` | Erros, deletar, urgente |
| `--info` | `#3B82F6` | Links, info badges |
| `--ai-accent` | `#A78BFA` | IA/Copilot accent (violet) |

### Paleta de Cores (Light Mode — Secundário)

| Token | Hex | Uso |
|-------|-----|-----|
| `--primary` | `#7BC400` | Ligeiramente mais escuro para contraste |
| `--bg-app` | `#F5F5F5` | Background principal |
| `--bg-surface` | `#FFFFFF` | Cards, painéis |
| `--bg-elevated` | `#FFFFFF` | Elevados com shadow |
| `--bg-bubble-out` | `#DCF8C6` | Bubble outgoing (verde claro WhatsApp-like) |
| `--bg-bubble-in` | `#FFFFFF` | Bubble incoming |
| `--text-primary` | `#111111` | Texto principal |
| `--text-secondary` | `#666666` | Texto secundário |
| `--border` | `#E5E5E5` | Bordas |

### Tipografia

| Elemento | Font | Size | Weight |
|----------|------|------|--------|
| Display/Headers | Sora | 20-24px | 600-700 |
| Section titles | Sora | 15-16px | 600 |
| Contact name (lista) | Sora | 13.5px | 500 (unread: 600) |
| Message preview (lista) | Sora | 12.5px | 400 |
| Message body (bubble) | Sora | 14px | 400 |
| Sender name (grupo) | Sora | 12px | 600 |
| Timestamp | Sora | 11px | 400 |
| Labels/Badges | Sora | 10.5px | 500 |
| Input placeholder | Sora | 14px | 400 |
| Nav tooltip | Sora | 12px | 500 |

### Border Radius
- Bubbles: `12px` (com `4px` no canto do "tail")
- Cards/Painéis: `12px`
- Inputs: `10px`
- Buttons: `10px`
- Badges/Pills: `999px` (fully rounded)
- Avatars: `999px` (circle)

### Shadows (Dark Mode)
- `--shadow-sm`: `0 1px 2px rgba(0,0,0,0.3)`
- `--shadow-md`: `0 4px 12px rgba(0,0,0,0.4)`
- `--shadow-glow`: `0 0 20px rgba(159,236,20,0.08)` (accent glow)

---

## 3. Layout Architecture

### Desktop (≥1280px) — 4 Colunas

```
┌────────┬──────────────────┬───────────────────────────────────┬──────────────────┐
│ NavBar │ Conversation     │ Chat Area                         │ Detail Panel     │
│        │ List             │                                   │ (toggle)         │
│  64px  │  340px           │  flex-1 (fills remaining)         │  360px           │
│ fixed  │  resizable       │                                   │  collapsible     │
└────────┴──────────────────┴───────────────────────────────────┴──────────────────┘
```

### Tablet (768–1279px) — 3 Colunas
- Detail Panel hidden by default (overlay quando aberto)
- NavBar colapsa para 48px (ícones menores)

### Mobile (<768px) — 1 Coluna
- NavBar vira bottom tab bar (5 itens: Inbox, AI, Contatos, Flows, Config)
- Conversation List: full-width
- Tap conversa → full-screen chat (slide right-to-left)
- Back button volta para lista
- Detail Panel: full-screen overlay

---

## 4. NavBar (Sidebar Esquerda)

### Estrutura
```
┌──────────┐
│   [V]    │  ← Logo com glow sutil
│          │
│   💬     │  ← Inbox (com badge unread)
│   🤖     │  ← AI Queue (com badge pending)
│   👥     │  ← Contatos
│   🏷️     │  ← Labels
│   ⚡     │  ← Automação
│   🌳     │  ← TreeFlows
│   💬     │  ← Respostas Rápidas
│          │
│ ──────── │
│   ⚙️     │  ← Settings
│   [AV]   │  ← Avatar + status (online/offline/busy)
└──────────┘
```

### Comportamento
- **Width**: 64px (ícones + tooltip on hover)
- **Active state**: Background `--primary-muted` + left border 2px `--primary` + icon color `--primary`
- **Badge**: Pill `--primary` bg com texto escuro, posicionado top-right do ícone
- **Tooltip**: Aparece on hover com nome da seção (Radix Tooltip, 200ms delay)
- **Avatar bottom**: Clicável para dropdown com availability toggle + logout
- **Availability dot**: Verde (online), cinza (offline), amarelo (busy) — sobre o avatar

---

## 5. Conversation List (Painel Esquerdo)

### Header
```
┌─────────────────────────────────────┐
│  Conversas                    [🔍]  │
│  ─────────────────────────────────  │
│  [Todas] [Minhas] [Não atribuídas]  │
│  ─────────────────────────────────  │
│  🔍 Buscar conversa...              │
└─────────────────────────────────────┘
```

- **Título**: "Conversas" (Sora 16px, 600)
- **Tabs**: Todas | Minhas | Não atribuídas (pills com active state `--primary-muted`)
- **Search**: Input com ícone lupa, debounce 300ms, rounded-full
- **Filter chips** (abaixo da search, horizontal scroll): Status (Abertas, Pendentes), Inbox, Label

### Conversation Item (72px height)

```
┌─────────────────────────────────────────┐
│ [Avatar 40px]  Nome do Contato   14:32  │
│    [📱]        Última msg previ...  (3) │
│                [🏷 VIP] [📱 WhatsApp]    │
└─────────────────────────────────────────┘
```

| Elemento | Spec |
|----------|------|
| **Avatar** | 40px circle. Imagem ou fallback com iniciais + cor hash-based (8 cores). Channel icon overlay 16px bottom-right (WhatsApp/Email/Web). Grupos: 👥 fallback. |
| **Nome** | 13.5px, 500 weight. Truncate single-line. Unread: 600 weight + `--text-primary`. |
| **Timestamp** | 11px, right-aligned. `--text-secondary`. Unread: `--primary`. Relative: "14:32", "Ontem", "12/03". |
| **Preview** | 12.5px, single-line truncate. `--text-secondary`. Grupos: "João: msg..." sender prefix. Media: ícone inline (📷 Foto, 🎤 Áudio, 📄 Documento). |
| **Unread badge** | Pill 18px, `--primary` bg, texto escuro. Muted: `--text-muted` bg. |
| **Labels** | Pills 10.5px com cor customizada, max 2 visíveis + "+N" |
| **Inbox badge** | Pill 10.5px, `--bg-elevated`, nome da inbox |
| **Group badge** | Pill "Agência" ou "Cliente" para grupos |

### Estados
- **Default**: `--bg-surface`
- **Hover**: `--bg-elevated` (150ms transition)
- **Active**: `--primary-muted` bg + left border 2px `--primary`
- **Unread**: Nome bold + timestamp primary + badge visível

### Ações (hover only)
- Checkbox aparece (opacity transition) para bulk actions
- Bulk bar: Atribuir | Label | Resolver | Reabrir

### Performance
- **Virtual scroll** via `@tanstack/react-virtual` (critical para 1000+ conversas)
- **Skeleton loading**: 5 skeleton cards durante fetch inicial

---

## 6. Chat Area (Painel Central)

### 6.1 Chat Header

```
┌──────────────────────────────────────────────────────────────────────┐
│ [Avatar 36px] Nome do Contato          [🔍] [📋] [✓ Resolver] [⋮]  │
│               online · via WhatsApp                                  │
└──────────────────────────────────────────────────────────────────────┘
```

| Elemento | Spec |
|----------|------|
| **Avatar** | 36px circle, clicável (abre detail panel) |
| **Nome** | 15px, 600. Clicável (abre detail panel). Grupo: prefixo 👥 |
| **Subtitle** | 12px, `--text-secondary`. "online" (verde) / "visto por último 14:30" / "digitando..." (animado). Grupo: "João, Maria, +3" ou "João está digitando..." |
| **Search** | 🔍 Abre search-in-chat panel (slide from right) |
| **Assign** | 📋 Dropdown para atribuir agente |
| **Resolve** | Botão "✓ Resolver" (verde). Muda para "↩ Reabrir" quando resolvida |
| **Menu ⋮** | Dropdown: Silenciar, Adiar (snooze), Marcar pendente, Transcrição |

### 6.2 Message Area

**Background**: Sutil pattern/textura (inspirado no WhatsApp doodle) em `--bg-app` com 3% opacity. Não solid color puro — dá profundidade sem distrair.

#### Message Bubbles

**Outgoing (agente)**:
- Alinhamento: direita (`margin-left: auto`)
- Background: `--bg-bubble-out` (verde escuro sutil no dark)
- Border-radius: `12px 12px 4px 12px` (tail bottom-right)
- Max-width: 65%
- Box-shadow: `--shadow-sm`
- Texto: `--text-primary`, 14px

**Incoming (cliente)**:
- Alinhamento: esquerda
- Background: `--bg-bubble-in`
- Border-radius: `12px 12px 12px 4px` (tail bottom-left)
- Max-width: 65%
- Border: 1px `--border-subtle`
- Texto: `--text-primary`, 14px

**Private notes (interno)**:
- Background: `--bg-bubble-note` (amber escuro)
- Left border: 3px `--warning`
- Ícone 🔒 + label "Nota privada" (10.5px, `--warning`)
- Visualmente distinto — nunca confundir com mensagem real

**Activity messages** (sistema):
- Centered, sem bubble
- Texto 11.5px, `--text-muted`, italic
- Ícone relevante (✓ para resolve, 🏷 para label, 👤 para assign)
- Ex: "Conversa resolvida por Nicolas · 14:32"

#### Agrupamento de Mensagens (WhatsApp-style)
- Mensagens consecutivas do mesmo sender: **2px gap** (tight grouping)
- Sender diferente: **12px gap**
- Apenas primeira mensagem do grupo mostra avatar + sender name
- Mensagens seguintes têm border-radius uniforme (sem tail)

#### Timestamps
- **Inline**: Bottom-right dentro do bubble, 11px, `--text-muted`
- **Read receipts** (outgoing): ícones de tick ao lado do timestamp
  - Enviando: ⏳ (clock)
  - Enviado: ✓ (cinza)
  - Entregue: ✓✓ (cinza)
  - Lido: ✓✓ (`--primary` verde)
  - Falhou: ❌ (vermelho, clicável para retry)
- **Date separators**: Pill centered, `--bg-elevated`, 12px, `--text-secondary`

#### Sender Name (Grupos)
- Aparece acima da primeira mensagem de cada grupo do mesmo sender
- 12px, 600 weight
- Cor hash-based determinística (paleta de 12 cores vibrantes no dark mode)
- Clicável → abre info do contato

#### Media Messages (futuro, mas preparar layout)
- **Imagem**: Inline no bubble, rounded, max-width 330px, caption abaixo
- **Áudio**: Waveform bar + play/pause + duração
- **Documento**: Ícone por tipo + filename + tamanho + download
- **Sticker**: Sem bubble, float direto no background

#### Reply/Quote
- Barra no topo do bubble com left-border 3px (cor do sender original)
- Background: 5% mais escuro que o bubble
- Nome do sender original (colorido) + texto truncado (1 linha)
- Clicável → scroll para mensagem original com highlight

### 6.3 HITL Suggestions Bar

Quando existem sugestões pendentes da IA, aparece **acima do composer**:

```
┌──────────────────────────────────────────────────────────────────────┐
│ ✨ Sugestão da IA                                           [▼/▲]  │
│ ─────────────────────────────────────────────────────────────────── │
│ "Olá! Obrigado pelo interesse. Posso ajudar com informações        │
│  sobre nossos planos..."                                            │
│                                                                      │
│ [Descartar]                    [✏️ Editar]    [✓ Aprovar e Enviar]  │
│                                                                      │
│ Confiança: ████████░░ 82%     Talk: Qualificação · Passo 3          │
└──────────────────────────────────────────────────────────────────────┘
```

| Elemento | Spec |
|----------|------|
| **Container** | `--bg-elevated`, border-top 2px `--ai-accent` (violet), rounded-top-12px |
| **Header** | ✨ "Sugestão da IA", 13px, 600, `--ai-accent`. Collapse toggle right |
| **Content** | 14px, `--text-primary`, max 4 lines com expand |
| **Actions** | Descartar (ghost), Editar (outline), Aprovar (primary filled) |
| **Metadata** | Confidence bar (mini, colored gradient), Talk context |
| **Multiple suggestions** | Stack com accordion, 1 expandida por vez |
| **Animation** | Slide-up 200ms ease quando nova sugestão chega |

### 6.4 Composer

```
┌──────────────────────────────────────────────────────────────────────┐
│ [Responder] [📝 Nota Privada]                                       │
├──────────────────────────────────────────────────────────────────────┤
│ [😀] [📎] │ Digite sua mensagem...                    │ [🎤] / [➤] │
│           │                                            │             │
│    [/]    │                                            │  [Cmd+↵]   │
└──────────────────────────────────────────────────────────────────────┘
```

| Elemento | Spec |
|----------|------|
| **Tabs** | "Responder" (default) + "📝 Nota Privada" (yellow highlight quando ativo) |
| **Emoji** | 😀 Button → Emoji picker overlay (categorias + busca) |
| **Attach** | 📎 Button → Menu: Documento, Foto/Vídeo, Contato |
| **Canned** | `/` no input abre lista filtrada de respostas rápidas |
| **Input** | Textarea auto-resize (min 44px, max 160px, depois scroll). 14px, placeholder `--text-muted`. Background `--bg-elevated`, border `--border`. Focus: border `--primary`, glow sutil |
| **Send** | Quando vazio: 🎤 (mic). Com texto: ➤ (send, `--primary` bg). Transição instant |
| **Shortcuts** | `Enter` = send, `Shift+Enter` = newline, `Cmd+Enter` = send (configurable) |
| **Typing** | Emite typing event via Socket.IO após 300ms debounce |
| **Private note mode** | Background muda para `--bg-bubble-note`, border `--warning` |
| **@ Mentions** | Em nota privada, `@` abre lista de agentes |

### 6.5 Scroll Behavior
- **Auto-scroll**: Scroll to bottom em nova mensagem (se já estava no bottom)
- **Scroll-up detection**: Se scrollou para cima, NÃO auto-scroll. Mostra pill "↓ Nova mensagem" com count
- **Scroll-to-bottom button**: Circular, bottom-right, aparece quando scrollou > 200px up
- **Infinite scroll up**: Carrega mensagens mais antigas (30 por batch) on scroll-to-top

---

## 7. Detail Panel (Sidebar Direita)

### Toggle
- Abre ao clicar no avatar/nome no chat header
- Slide-in from right, 200ms ease
- 360px width, colapsável

### Seções (scrollable)

#### Contact Card
```
┌───────────────────────────────┐
│         [Avatar 72px]         │
│        Nome do Contato        │
│      +55 43 99956-0095        │
│       email@exemplo.com       │
│     ─────────────────────     │
│  Funnel: Qualificação ████░   │
└───────────────────────────────┘
```

#### Ações da Conversa
| Ação | UI |
|------|----|
| **Status** | Dropdown: Aberta, Pendente, Resolvida, Adiada |
| **Atribuir Agente** | Dropdown com avatar + nome |
| **Labels** | Multi-select tags com `+ Adicionar` |
| **Prioridade** | Dropdown: Nenhuma, Baixa, Média, Alta, Urgente (com cores) |

#### Talk Ativo (TreeFlow)
```
┌───────────────────────────────┐
│ 🌳 Talk Ativo                 │
│ Flow: Qualificação de Lead    │
│ Passo: Verificar interesse    │
│ Status: ● Ativo               │
│ Sugestões pendentes: 2        │
└───────────────────────────────┘
```

#### Atributos Custom
- Key-value editáveis inline
- Tipos: text, number, date, link

#### Conversas Anteriores
- Lista das últimas 5 conversas com mesmo contato
- Status badge + timestamp + preview
- Clicável para navegar

#### CRM Data (futuro)
- Dados resolvidos do CRM Hub
- Oportunidades, valor, estágio do funil

---

## 8. Micro-interações & Animações

### Transições Globais
| Elemento | Animação | Duração |
|----------|----------|---------|
| Page transitions | Fade-in | 150ms |
| Panel slide (detail) | translateX + fade | 200ms ease |
| Dropdown/Popover | scale(0.95→1) + fade | 150ms |
| Modal | backdrop fade + scale(0.95→1) | 200ms |
| Toast | slide-in from top-right | 200ms, auto-dismiss 4s |

### Chat-specific
| Elemento | Animação |
|----------|----------|
| Nova mensagem | Slide-up subtle (4px) + fade-in, 150ms |
| Typing indicator | 3 dots bouncing (200ms offset each) em mini-bubble |
| HITL suggestion arrival | Slide-up from composer, 200ms ease |
| Send message | Bubble aparece instant (optimistic), opacity 0.7 → 1.0 on confirm |
| Failed message | Shake animation (2 cycles, 200ms) + red tint |
| Unread badge | Scale-in (0→1) bounce effect |
| Scroll-to-bottom pill | Fade-in + translate-y, 150ms |

### Loading States
| Contexto | Loader |
|----------|--------|
| Conversation list | 5x Skeleton cards (shimmer animation) |
| Messages | 3x Skeleton bubbles (alternating left/right) |
| Contact panel | Skeleton blocks |
| Full page | Spinner com logo V + glow pulse |
| Inline actions | Button shows spinner state |

---

## 9. Keyboard Shortcuts

| Shortcut | Ação |
|----------|------|
| `Cmd+K` | Command bar (busca global: conversas, contatos, ações) |
| `Cmd+/` | Mostrar todos os atalhos |
| `Cmd+Enter` | Enviar mensagem |
| `Cmd+Shift+N` | Toggle nota privada |
| `Cmd+Shift+R` | Resolver/Reabrir conversa |
| `Escape` | Fechar panel/modal/search |
| `↑/↓` | Navegar conversas na lista |
| `/` (no composer) | Abrir canned responses |
| `@` (em nota) | Mencionar agente |

### Command Bar (`Cmd+K`)
- Modal centralizado (style Spotlight/Raycast)
- Search across: conversas, contatos, ações, labels
- Resultados categorizados com ícones
- Atalhos para ações rápidas: "Resolver conversa", "Atribuir a...", etc.

---

## 10. Responsividade Mobile

### Bottom Tab Bar (substitui NavBar)
```
┌──────────────────────────────────────────┐
│  💬 Inbox  │  🤖 IA  │  👥  │  🌳  │  ⚙️  │
└──────────────────────────────────────────┘
```
- 5 tabs com ícone + label 10px
- Badge sobre ícone para counts
- Safe area padding para iOS

### Navegação Drill-in
- Lista → Tap → Chat (slide left)
- Chat → Back (slide right)
- Chat → Avatar → Detail (slide from bottom, full-screen)
- Gestos: swipe right para voltar

### Adaptações
- Composer: touch targets maiores (min 44px)
- Bubbles: max-width 85% (mais espaço)
- Timestamps: agrupados por hora (não por mensagem)
- HITL bar: colapsada por default, tap para expandir

---

## 11. Componentes Novos Necessários

### Novos (criar)
| Componente | Prioridade | Descrição |
|------------|------------|-----------|
| `CommandBar` | P0 | Modal Cmd+K com busca global |
| `MessageGroup` | P0 | Agrupamento de mensagens consecutivas do mesmo sender |
| `BubbleTail` | P0 | SVG tail para first message in group |
| `ReadReceipts` | P0 | Ícones de tick (enviado/entregue/lido/falhou) |
| `DateSeparator` | P0 | Pill centrado com data |
| `ScrollToBottom` | P0 | Botão circular com count de novas msgs |
| `SkeletonConversation` | P0 | Skeleton loader para conversation list |
| `SkeletonMessages` | P0 | Skeleton loader para message area |
| `TypingBubble` | P0 | Mini-bubble com 3 dots animados |
| `ChatWallpaper` | P1 | Background pattern sutil |
| `EmojiPicker` | P1 | Picker completo com busca e categorias |
| `AttachmentMenu` | P1 | Menu de anexos (doc, foto, contato) |
| `PrivateNoteToggle` | P1 | Tab reply/note com visual distinto |
| `ConversationActions` | P1 | Dropdown com resolve, snooze, assign, mute |
| `PriorityBadge` | P2 | Badge colorido por prioridade |
| `SLATimer` | P2 | Timer countdown com color progression |
| `SystemMessage` | P1 | Activity log messages centered |
| `ReplyQuote` | P1 | Quoted message bar dentro do bubble |
| `BottomTabBar` | P2 | Mobile navigation |
| `ThemeToggle` | P2 | Switch dark/light mode |
| `InlineCannedSearch` | P1 | Overlay de canned responses ao digitar `/` |

### Refatorar (existentes)
| Componente | O que muda |
|------------|-----------|
| `ConversationItem` | Adicionar: channel overlay no avatar, label pills, media preview icons, skeleton state, hover checkbox |
| `MessageBubble` (inline em page.tsx) | Extrair para componente próprio com: grouping, tail, read receipts, reply quote, media support |
| `MessageComposer` (inline) | Extrair com: tabs reply/note, emoji picker, attachment menu, canned response trigger, auto-resize, typing indicator emit |
| `ContactSidebar` | Redesign completo: seções colapsáveis, ações de conversa, talk info, atributos custom, conversas anteriores |
| `ConversationHeader` | Redesign: subtitle com status/typing, action buttons (resolve, assign, search), menu dropdown |
| `NavSidebar` | Redesign: availability toggle, badge refinement, collapse mobile |
| `ConversationList` | Virtual scroll, skeleton loading, filter chips, tabs (mine/unassigned/all) |
| `InboxFilters` | Filter chips horizontal scroll, assignee filter, saved filters |
| `HITLBar/MessageBlockCard` | Redesign: violet accent, confidence bar, talk context, animation |

---

## 12. Fases de Implementação

### Fase 1 — Foundation (P0) ~3-4 dias
Core visual upgrade sem novas features:
1. Atualizar CSS tokens (paleta nova, shadows, border-radius)
2. Refatorar `MessageBubble` → componente próprio com grouping + tail + read receipts
3. Criar `DateSeparator`, `TypingBubble`, `ScrollToBottom`
4. Criar `SkeletonConversation` e `SkeletonMessages`
5. Extrair `MessageComposer` com auto-resize e visual upgrade
6. Redesign `ConversationItem` com nova paleta
7. Redesign `NavSidebar` com availability + refined badges
8. Redesign `ConversationHeader` com actions (resolve, menu)
9. Adicionar message grouping logic
10. Virtual scroll na conversation list

### Fase 2 — Power Features (P1) ~3-4 dias
1. `CommandBar` (Cmd+K)
2. `ContactSidebar` redesign completo
3. Private notes (tab no composer + visual distinto)
4. Canned responses inline (`/` trigger)
5. Reply/Quote messages
6. System/Activity messages
7. HITL redesign com violet accent
8. Chat wallpaper pattern
9. Emoji picker
10. Keyboard shortcuts

### Fase 3 — Polish & Mobile (P2) ~2-3 dias
1. Light mode theme
2. Theme toggle
3. Mobile responsive (bottom tab bar, drill-in nav)
4. Priority badges
5. Attachment menu (UI only, backend later)
6. Filter chips + saved filters
7. Bulk actions na conversation list
8. Sound notifications config

---

## 13. Métricas de Sucesso

| Métrica | Target |
|---------|--------|
| Lighthouse Performance | ≥ 90 |
| First Contentful Paint | < 1.5s |
| Time to Interactive | < 3s |
| Conversation list render (1000 items) | < 100ms (virtual scroll) |
| Message send → bubble appear | < 50ms (optimistic) |
| Theme switch | < 100ms (CSS variables) |

---

## 14. Referências de Design

- [Chatwoot UI/UX Analysis](../genesis/docs/chatwoot-ui-ux-analysis.md)
- [WhatsApp Web UI/UX Analysis](../genesis/docs/whatsapp-web-ui-ux-analysis.md)
- [Anthropic Frontend Design Skill](../.claude/skills/frontend-design/SKILL.md)

---

*PRD criado em 2026-03-13. Revisão e aprovação pendentes.*
