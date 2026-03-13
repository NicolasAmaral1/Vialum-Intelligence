'use client';

import { useState, useRef, useEffect } from 'react';
import {
  MessageSquare, Bot, Users, Tag, Zap, GitBranch, MessageCircle, Settings,
  Search, Check, CheckCheck, MoreVertical, Paperclip, Smile, Mic,
  Send, X, ChevronDown, Phone, Mail, Lock, Sparkles,
} from 'lucide-react';

/*
 * ═══════════════════════════════════════════════════════════
 *  DESIGN SYSTEM — Vialum Chat v2
 *
 *  Palette approach: HSL-based with green undertone
 *  Base hue: 150° (cool-mint) for neutrals, shifted to feel alive
 *  Primary: #9FEC14 (Genesis Lime — HSL 84°, 87%, 50%)
 *  AI accent: #818CF8 (Indigo 400)
 *
 *  Surface hierarchy (darkest → lightest):
 *    nav:     hsl(220, 16%, 10%)   #15171E
 *    base:    hsl(220, 14%, 12%)   #191C24
 *    raised:  hsl(220, 13%, 15%)   #1F2330
 *    surface: hsl(220, 12%, 18%)   #262A36
 *    overlay: hsl(220, 11%, 22%)   #2F3440
 *
 *  Text hierarchy:
 *    primary:   hsl(220, 15%, 93%)  #EBEEF5
 *    secondary: hsl(220, 10%, 60%)  #8B92A5
 *    muted:     hsl(220, 8%, 40%)   #5C6275
 *    faint:     hsl(220, 6%, 28%)   #40444F
 *
 *  Rule: 60-30-10 (base surface 60%, raised 30%, primary 10%)
 * ═══════════════════════════════════════════════════════════
 */

const T = {
  // Surfaces
  nav:     '#15171E',
  base:    '#191C24',
  raised:  '#1F2330',
  surface: '#262A36',
  overlay: '#2F3440',
  // Borders
  border:  '#2A2E3A',
  borderSubtle: '#232732',
  // Text
  text1:   '#EBEEF5',
  text2:   '#8B92A5',
  text3:   '#5C6275',
  text4:   '#40444F',
  // Primary
  lime:    '#9FEC14',
  limeDim: '#7BC400',
  limeBg:  'rgba(159,236,20,0.08)',
  limeBg2: 'rgba(159,236,20,0.14)',
  // Outgoing bubble — desaturated lime tint
  bubbleOut:  '#1E2B1A',
  bubbleOutBorder: '#2A3A24',
  // Incoming bubble
  bubbleIn:   '#232732',
  bubbleInBorder: '#2E3340',
  // AI
  ai:      '#818CF8',
  aiBg:    'rgba(129,140,248,0.08)',
  aiSurface: '#1E1F30',
  // Semantic
  success: '#34D399',
  warning: '#FBBF24',
  danger:  '#F87171',
  // Note
  noteBg:  '#2A2518',
  noteBorder: '#4A3F20',
  noteText: '#E2C55A',
};

/* ─── Color hash for sender names ─── */
const SENDER_COLORS = [
  '#F87171','#FB923C','#FBBF24','#34D399',
  '#22D3EE','#818CF8','#C084FC','#F472B6',
  '#A3E635','#2DD4BF','#60A5FA','#E879F9',
];
function senderColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return SENDER_COLORS[Math.abs(h) % SENDER_COLORS.length];
}

/* ─── Avatar ─── */
const AVATAR_BG = ['#6366F1','#EC4899','#F59E0B','#10B981','#3B82F6','#8B5CF6','#EF4444','#14B8A6'];
function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return (
    <div className="rounded-full shrink-0 flex items-center justify-center text-white font-semibold"
      style={{ width: size, height: size, backgroundColor: AVATAR_BG[Math.abs(h) % AVATAR_BG.length], fontSize: size * 0.35 }}>
      {initials}
    </div>
  );
}

/* ─── Mock Data ─── */
const CONVERSATIONS = [
  { id:'1', name:'Maria Silva', phone:'+55 43 99956-0095', lastMsg:'Quero saber mais sobre o plano premium, vocês tem algum desconto?', time:'14:32', unread:3, status:'online', isGroup:false, labels:[{name:'VIP',color:'#F59E0B'}], inbox:'WhatsApp' },
  { id:'2', name:'João Oliveira', phone:'+55 11 98765-4321', lastMsg:'Obrigado pela resposta!', time:'14:15', unread:0, status:'offline', isGroup:false, labels:[], inbox:'WhatsApp' },
  { id:'3', name:'Equipe Vendas SP', phone:'', lastMsg:'Carlos: Fechamos o deal com a Acme!', time:'13:48', unread:12, status:'', isGroup:true, labels:[{name:'Agência',color:'#3B82F6'}], inbox:'WhatsApp' },
  { id:'4', name:'Ana Costa', phone:'+55 21 99887-6543', lastMsg:'Enviou uma foto', time:'12:30', unread:1, status:'online', isGroup:false, labels:[{name:'Lead',color:'#34D399'}], inbox:'WhatsApp' },
  { id:'5', name:'Pedro Santos', phone:'+55 43 98765-1234', lastMsg:'Pode me enviar o contrato atualizado?', time:'Ontem', unread:0, status:'offline', isGroup:false, labels:[], inbox:'WhatsApp' },
  { id:'6', name:'Parceiros Londrina', phone:'', lastMsg:'Fernanda: Reunião confirmada para quinta', time:'Ontem', unread:0, status:'', isGroup:true, labels:[{name:'Cliente',color:'#8B5CF6'}], inbox:'WhatsApp' },
  { id:'7', name:'Luísa Mendes', phone:'+55 11 97654-3210', lastMsg:'Vocês aceitam pix?', time:'11/03', unread:0, status:'offline', isGroup:false, labels:[], inbox:'WhatsApp' },
  { id:'8', name:'Ricardo Almeida', phone:'+55 43 99654-7890', lastMsg:'Vou pensar e retorno amanhã', time:'10/03', unread:0, status:'offline', isGroup:false, labels:[{name:'Negociação',color:'#F97316'}], inbox:'WhatsApp' },
];

interface MockMsg { id:string; sender:string; content:string; time:string; type:'incoming'|'outgoing'|'system'|'note'; status?:'sent'|'delivered'|'read'|'failed'; }

const MESSAGES: MockMsg[] = [
  { id:'sys1', sender:'', content:'Hoje', time:'', type:'system' },
  { id:'1', sender:'Maria Silva', content:'Oi, bom dia! 😊', time:'14:20', type:'incoming' },
  { id:'2', sender:'Maria Silva', content:'Eu vi a propaganda de vocês no Instagram e fiquei interessada no plano premium', time:'14:20', type:'incoming' },
  { id:'3', sender:'Maria Silva', content:'Vocês tem algum desconto para pagamento à vista?', time:'14:21', type:'incoming' },
  { id:'4', sender:'Agente', content:'Bom dia, Maria! Tudo bem? 🤗', time:'14:25', type:'outgoing', status:'read' },
  { id:'5', sender:'Agente', content:'Que bom que você se interessou! O plano premium inclui atendimento prioritário, acesso ilimitado à plataforma e relatórios avançados.', time:'14:25', type:'outgoing', status:'read' },
  { id:'note1', sender:'Nicolas', content:'Verificar se temos desconto ativo para pagamento à vista. Checar com financeiro.', time:'14:26', type:'note' },
  { id:'6', sender:'Agente', content:'Sim! Para pagamento à vista temos 15% de desconto. O plano sai de R$ 297/mês para R$ 252/mês 💰', time:'14:28', type:'outgoing', status:'delivered' },
  { id:'7', sender:'Maria Silva', content:'Nossa, que legal! E como funciona o período de teste?', time:'14:30', type:'incoming' },
  { id:'8', sender:'Maria Silva', content:'Quero saber mais sobre o plano premium, vocês tem algum desconto?', time:'14:32', type:'incoming' },
];

const HITL = { content:'Oferecemos 7 dias de teste gratuito com acesso completo a todas as funcionalidades! Você pode cancelar a qualquer momento durante o período de teste sem nenhum custo. Quer que eu ative o seu acesso agora?', confidence:87, flow:'Qualificação de Lead', step:'Apresentar oferta' };

/* ─── NavItem ─── */
function NavItem({ icon:Icon, label, active, badge }: { icon:React.ElementType; label:string; active?:boolean; badge?:number }) {
  return (
    <div className="group relative flex items-center justify-center">
      <button style={{ backgroundColor: active ? T.limeBg2 : undefined, color: active ? T.lime : T.text3, boxShadow: active ? `0 0 16px ${T.limeBg}` : undefined }}
        className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150 hover:bg-white/[0.05]">
        <Icon className="w-[18px] h-[18px]" />
        {badge && badge > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
            style={{ backgroundColor: T.lime, color: T.nav }}>{badge > 99 ? '99+' : badge}</span>
        ) : null}
      </button>
      <div className="absolute left-full ml-2 px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50"
        style={{ backgroundColor: T.overlay, color: T.text2 }}>{label}</div>
    </div>
  );
}

/* ─── ReadReceipt ─── */
function ReadReceipt({ status }: { status?:string }) {
  if (!status) return null;
  if (status === 'failed') return <X className="w-3 h-3 inline-block ml-1" style={{ color: T.danger }} />;
  const color = status === 'read' ? T.lime : T.text4;
  if (status === 'sent') return <Check className="w-3 h-3 inline-block ml-1" style={{ color }} />;
  return <CheckCheck className="w-3 h-3 inline-block ml-1" style={{ color }} />;
}

/* ─── TypingBubble ─── */
function TypingBubble() {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl rounded-bl-[4px] px-4 py-3 flex items-center gap-1.5"
        style={{ backgroundColor: T.bubbleIn, border: `1px solid ${T.bubbleInBorder}` }}>
        {[0,150,300].map(d => (
          <span key={d} className="w-[6px] h-[6px] rounded-full animate-bounce" style={{ backgroundColor: T.text3, animationDelay: `${d}ms` }} />
        ))}
      </div>
    </div>
  );
}

/* ─── Skeleton ─── */

/* ═══ MAIN ═══ */
export default function PreviewPage() {
  const [activeConv, setActiveConv] = useState('1');
  const [detailOpen, setDetailOpen] = useState(false);
  const [composerText, setComposerText] = useState('');
  const [activeTab, setActiveTab] = useState<'all'|'mine'|'unassigned'>('all');
  const [hitlExpanded, setHitlExpanded] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, []);

  const conv = CONVERSATIONS.find(c => c.id === activeConv)!;

  return (
    <div className="flex h-screen overflow-hidden" style={{ fontFamily:'Sora, sans-serif', backgroundColor: T.base, color: T.text1 }}>

      {/* ═══ NAV ═══ */}
      <div className="w-16 flex flex-col items-center py-4 gap-1 shrink-0" style={{ backgroundColor: T.nav, borderRight: `1px solid ${T.borderSubtle}` }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm mb-6"
          style={{ background: `linear-gradient(135deg, ${T.lime}, ${T.limeDim})`, color: T.nav, boxShadow: `0 0 24px rgba(159,236,20,0.2)` }}>V</div>

        <NavItem icon={MessageSquare} label="Inbox" active badge={16} />
        <NavItem icon={Bot} label="Fila IA" badge={4} />
        <NavItem icon={Users} label="Contatos" />
        <NavItem icon={Tag} label="Labels" />
        <NavItem icon={Zap} label="Automação" />
        <NavItem icon={GitBranch} label="TreeFlows" />
        <NavItem icon={MessageCircle} label="Respostas Rápidas" />
        <div className="flex-1" />
        <NavItem icon={Settings} label="Configurações" />
        <div className="relative mt-2">
          <Avatar name="Nicolas Amaral" size={32} />
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2" style={{ backgroundColor: T.success, borderColor: T.nav }} />
        </div>
      </div>

      {/* ═══ CONVERSATION LIST ═══ */}
      <div className="w-[340px] flex flex-col shrink-0" style={{ backgroundColor: T.raised, borderRight: `1px solid ${T.border}` }}>
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[16px] font-semibold" style={{ color: T.text1 }}>Conversas</h2>
            <button className="p-1.5 rounded-lg hover:bg-white/[0.05] transition-colors" style={{ color: T.text3 }}><Search className="w-4 h-4" /></button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-3">
            {(['all','mine','unassigned'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className="px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-150"
                style={{ backgroundColor: activeTab === tab ? T.limeBg2 : undefined, color: activeTab === tab ? T.lime : T.text3 }}>
                {tab === 'all' ? 'Todas' : tab === 'mine' ? 'Minhas' : 'Não atribuídas'}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: T.text4 }} />
            <input type="text" placeholder="Buscar conversa..."
              className="w-full pl-9 pr-3 py-2 rounded-xl text-[12px] focus:outline-none transition-all"
              style={{ backgroundColor: T.surface, border: `1px solid ${T.border}`, color: T.text1, '--tw-ring-color': T.limeBg } as React.CSSProperties} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {CONVERSATIONS.map(c => {
            const isActive = c.id === activeConv;
            return (
              <button key={c.id} onClick={() => setActiveConv(c.id)}
                className="w-full flex items-start gap-3 px-4 py-3 transition-all duration-150 border-l-2"
                style={{ backgroundColor: isActive ? T.limeBg : undefined, borderLeftColor: isActive ? T.lime : 'transparent' }}>
                <div className="relative">
                  <Avatar name={c.name} size={40} />
                  {c.status === 'online' && <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2" style={{ backgroundColor: T.success, borderColor: T.raised }} />}
                  <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] text-white border"
                    style={{ backgroundColor: '#25D366', borderColor: T.raised }}>W</span>
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] truncate flex items-center gap-1.5"
                      style={{ fontWeight: c.unread > 0 ? 600 : 500, color: c.unread > 0 ? T.text1 : T.text2 }}>
                      {c.isGroup && <span className="text-[11px]">👥</span>}{c.name}
                    </span>
                    <span className="text-[10px] shrink-0" style={{ color: c.unread > 0 ? T.lime : T.text4 }}>{c.time}</span>
                  </div>
                  <p className="text-[12px] truncate mt-0.5" style={{ color: c.unread > 0 ? T.text2 : T.text3 }}>{c.lastMsg}</p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {c.labels.map(l => (
                      <span key={l.name} className="text-[9.5px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: l.color+'18', color: l.color }}>{l.name}</span>
                    ))}
                    <span className="text-[9.5px] px-1.5 py-0.5 rounded-full" style={{ color: T.text4, backgroundColor: T.surface }}>{c.inbox}</span>
                    {c.unread > 0 && (
                      <span className="ml-auto h-[18px] min-w-[18px] flex items-center justify-center px-1 text-[10px] font-bold rounded-full" style={{ backgroundColor: T.lime, color: T.nav }}>{c.unread}</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══ CHAT ═══ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-2.5" style={{ backgroundColor: T.raised, borderBottom: `1px solid ${T.border}` }}>
          <button onClick={() => setDetailOpen(!detailOpen)} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="relative">
              <Avatar name={conv.name} size={36} />
              {conv.status === 'online' && <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2" style={{ backgroundColor: T.success, borderColor: T.raised }} />}
            </div>
            <div className="text-left">
              <h3 className="text-[14px] font-semibold" style={{ color: T.text1 }}>{conv.name}</h3>
              <p className="text-[11px]" style={{ color: T.success }}>online · via WhatsApp</p>
            </div>
          </button>
          <div className="flex items-center gap-1">
            <button className="p-2 rounded-lg hover:bg-white/[0.05] transition-colors" style={{ color: T.text3 }}><Search className="w-4 h-4" /></button>
            <button className="px-3 py-1.5 rounded-lg text-[12px] font-medium flex items-center gap-1.5 transition-colors"
              style={{ backgroundColor: 'rgba(52,211,153,0.1)', color: T.success }}><Check className="w-3.5 h-3.5" />Resolver</button>
            <button className="p-2 rounded-lg hover:bg-white/[0.05] transition-colors" style={{ color: T.text3 }}><MoreVertical className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4"
          style={{ background: `radial-gradient(ellipse at 15% 50%, rgba(159,236,20,0.02) 0%, transparent 60%), radial-gradient(ellipse at 85% 30%, rgba(129,140,248,0.015) 0%, transparent 50%), ${T.base}` }}>
          <div className="max-w-3xl mx-auto space-y-0.5">
            {MESSAGES.map((msg, idx) => {
              const prev = idx > 0 ? MESSAGES[idx-1] : null;
              const isFirst = !prev || prev.sender !== msg.sender || prev.type !== msg.type;

              if (msg.type === 'system') return (
                <div key={msg.id} className="flex justify-center py-3">
                  <span className="px-4 py-1.5 rounded-full text-[11px] font-medium" style={{ backgroundColor: T.surface, color: T.text3 }}>{msg.content}</span>
                </div>
              );

              if (msg.type === 'note') return (
                <div key={msg.id} className={`flex justify-end ${isFirst ? 'mt-3' : 'mt-0.5'}`}>
                  <div className="max-w-[65%] px-4 py-2.5 rounded-xl text-[13.5px] leading-relaxed"
                    style={{ backgroundColor: T.noteBg, borderLeft: `3px solid ${T.warning}` }}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Lock className="w-3 h-3" style={{ color: T.warning }} />
                      <span className="text-[10px] font-semibold" style={{ color: T.warning }}>Nota privada · {msg.sender}</span>
                    </div>
                    <span style={{ color: T.noteText }}>{msg.content}</span>
                    <div className="text-[10px] mt-1" style={{ color: T.text4 }}>{msg.time}</div>
                  </div>
                </div>
              );

              const isOut = msg.type === 'outgoing';
              const radius = isOut ? '14px 14px 4px 14px' : '14px 14px 14px 4px';

              return (
                <div key={msg.id} className={`flex ${isOut ? 'justify-end' : 'justify-start'} ${isFirst ? 'mt-3' : 'mt-[3px]'}`}>
                  {!isOut && isFirst && <Avatar name={msg.sender} size={28} />}
                  {!isOut && !isFirst && <div className="w-7 shrink-0" />}
                  <div className={`max-w-[65%] px-3.5 py-2 text-[13.5px] leading-relaxed ${!isOut ? 'ml-2' : ''}`}
                    style={{ borderRadius: radius, backgroundColor: isOut ? T.bubbleOut : T.bubbleIn, border: `1px solid ${isOut ? T.bubbleOutBorder : T.bubbleInBorder}` }}>
                    {!isOut && isFirst && (
                      <div className="text-[11.5px] font-semibold mb-0.5" style={{ color: senderColor(msg.sender) }}>{msg.sender}</div>
                    )}
                    <span style={{ color: T.text1 }}>{msg.content}</span>
                    <div className="flex items-center justify-end gap-0.5 mt-0.5">
                      <span className="text-[10px]" style={{ color: T.text4 }}>{msg.time}</span>
                      {isOut && <ReadReceipt status={msg.status} />}
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="mt-3 flex items-end gap-2">
              <Avatar name="Maria Silva" size={28} />
              <TypingBubble />
            </div>
            <div ref={endRef} />
          </div>
        </div>

        {/* HITL */}
        {hitlExpanded && (
          <div className="px-4 py-3" style={{ backgroundColor: T.aiSurface, borderTop: `2px solid ${T.ai}40` }}>
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" style={{ color: T.ai }} />
                  <span className="text-[12px] font-semibold" style={{ color: T.ai }}>Sugestão da IA</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: T.aiBg, color: T.ai }}>{HITL.flow} · {HITL.step}</span>
                </div>
                <button onClick={() => setHitlExpanded(false)} className="p-1 rounded hover:bg-white/[0.05]" style={{ color: T.text3 }}><X className="w-3.5 h-3.5" /></button>
              </div>
              <p className="text-[13px] leading-relaxed mb-3" style={{ color: T.text2 }}>&ldquo;{HITL.content}&rdquo;</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px]" style={{ color: T.text4 }}>Confiança:</span>
                  <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: T.surface }}>
                    <div className="h-full rounded-full" style={{ width: `${HITL.confidence}%`, background: `linear-gradient(90deg, ${T.ai}, ${T.lime})` }} />
                  </div>
                  <span className="text-[10px] font-medium" style={{ color: T.ai }}>{HITL.confidence}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <button className="px-3 py-1.5 rounded-lg text-[11px] font-medium hover:bg-white/[0.05] transition-colors" style={{ color: T.text3 }}>Descartar</button>
                  <button className="px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-colors" style={{ color: T.ai, borderColor: `${T.ai}30` }}>✏️ Editar</button>
                  <button className="px-3 py-1.5 rounded-lg text-[11px] font-medium flex items-center gap-1.5 transition-colors"
                    style={{ backgroundColor: T.lime, color: T.nav }}><Check className="w-3.5 h-3.5" />Aprovar e Enviar</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Composer */}
        <div className="px-4 py-3" style={{ backgroundColor: T.raised, borderTop: `1px solid ${T.border}` }}>
          <div className="max-w-3xl mx-auto">
            <div className="flex gap-1 mb-2">
              <button className="px-3 py-1 rounded-md text-[11px] font-medium" style={{ backgroundColor: T.surface, color: T.text2 }}>Responder</button>
              <button className="px-3 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 hover:bg-white/[0.04] transition-colors" style={{ color: T.text4 }}>
                <Lock className="w-3 h-3" />Nota Privada
              </button>
            </div>
            <div className="flex items-end gap-2">
              <div className="flex items-center gap-0.5">
                <button className="p-2 rounded-lg hover:bg-white/[0.05] transition-colors" style={{ color: T.text3 }}><Smile className="w-[18px] h-[18px]" /></button>
                <button className="p-2 rounded-lg hover:bg-white/[0.05] transition-colors" style={{ color: T.text3 }}><Paperclip className="w-[18px] h-[18px]" /></button>
              </div>
              <div className="flex-1">
                <textarea value={composerText} onChange={e => setComposerText(e.target.value)}
                  placeholder="Digite sua mensagem..." rows={1}
                  className="w-full resize-none rounded-xl px-4 py-2.5 text-[13.5px] focus:outline-none transition-all"
                  style={{ backgroundColor: T.surface, border: `1px solid ${T.border}`, color: T.text1, minHeight:42, maxHeight:160 }} />
              </div>
              {composerText.trim() ? (
                <button className="p-2.5 rounded-xl shrink-0 transition-colors" style={{ backgroundColor: T.lime, color: T.nav }}><Send className="w-[18px] h-[18px]" /></button>
              ) : (
                <button className="p-2.5 rounded-xl shrink-0 hover:bg-white/[0.05] transition-colors" style={{ color: T.text3 }}><Mic className="w-[18px] h-[18px]" /></button>
              )}
            </div>
            <div className="flex items-center justify-between mt-1.5 px-1">
              <span className="text-[10px]" style={{ color: T.text4 }}>
                <kbd className="px-1 py-0.5 rounded text-[9px]" style={{ backgroundColor: T.surface, color: T.text3 }}>/</kbd> respostas rápidas
              </span>
              <span className="text-[10px]" style={{ color: T.text4 }}>
                <kbd className="px-1 py-0.5 rounded text-[9px]" style={{ backgroundColor: T.surface, color: T.text3 }}>Enter</kbd> enviar · <kbd className="px-1 py-0.5 rounded text-[9px]" style={{ backgroundColor: T.surface, color: T.text3 }}>Shift+Enter</kbd> nova linha
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ DETAIL PANEL ═══ */}
      {detailOpen && (
        <div className="w-[360px] flex flex-col shrink-0 overflow-y-auto animate-in slide-in-from-right duration-200"
          style={{ backgroundColor: T.raised, borderLeft: `1px solid ${T.border}` }}>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${T.border}` }}>
            <span className="text-[13px] font-semibold" style={{ color: T.text2 }}>Detalhes</span>
            <button onClick={() => setDetailOpen(false)} className="p-1.5 rounded-lg hover:bg-white/[0.05]" style={{ color: T.text3 }}><X className="w-4 h-4" /></button>
          </div>

          <div className="flex flex-col items-center py-6 px-4" style={{ borderBottom: `1px solid ${T.border}` }}>
            <Avatar name={conv.name} size={72} />
            <h3 className="mt-3 text-[16px] font-semibold" style={{ color: T.text1 }}>{conv.name}</h3>
            <div className="flex items-center gap-1.5 mt-1 text-[12px]" style={{ color: T.text3 }}><Phone className="w-3 h-3" />{conv.phone}</div>
            <div className="flex items-center gap-1.5 mt-0.5 text-[12px]" style={{ color: T.text3 }}><Mail className="w-3 h-3" />maria.silva@email.com</div>
            <div className="mt-4 w-full">
              <div className="flex items-center justify-between text-[11px] mb-1.5">
                <span style={{ color: T.text3 }}>Estágio do funil</span>
                <span className="font-medium" style={{ color: T.lime }}>Qualificação</span>
              </div>
              <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: T.surface }}>
                <div className="h-full w-[40%] rounded-full" style={{ background: `linear-gradient(90deg, ${T.lime}80, ${T.lime})` }} />
              </div>
            </div>
          </div>

          <div className="px-4 py-4 space-y-3" style={{ borderBottom: `1px solid ${T.border}` }}>
            <h4 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: T.text4 }}>Ações</h4>
            <div className="flex items-center justify-between">
              <span className="text-[12px]" style={{ color: T.text2 }}>Status</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'rgba(52,211,153,0.1)', color: T.success }}>Aberta</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px]" style={{ color: T.text2 }}>Atribuída a</span>
              <div className="flex items-center gap-1.5"><Avatar name="Nicolas Amaral" size={20} /><span className="text-[11px]" style={{ color: T.text1 }}>Nicolas</span></div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px]" style={{ color: T.text2 }}>Prioridade</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'rgba(251,191,36,0.1)', color: T.warning }}>Média</span>
            </div>
            <div>
              <span className="text-[12px]" style={{ color: T.text2 }}>Labels</span>
              <div className="flex gap-1.5 mt-1.5">
                {conv.labels.map(l => (
                  <span key={l.name} className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: l.color+'18', color: l.color }}>{l.name}</span>
                ))}
                <button className="text-[10px] px-2 py-0.5 rounded-full border border-dashed transition-colors" style={{ borderColor: T.text4, color: T.text3 }}>+ Adicionar</button>
              </div>
            </div>
          </div>

          <div className="px-4 py-4 space-y-2" style={{ borderBottom: `1px solid ${T.border}` }}>
            <h4 className="text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: T.text4 }}><GitBranch className="w-3 h-3" />Talk Ativo</h4>
            <div className="rounded-xl p-3 space-y-1.5" style={{ backgroundColor: T.surface }}>
              {[['Flow','Qualificação de Lead'],['Passo','Apresentar oferta']].map(([k,v]) => (
                <div key={k} className="flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: T.text3 }}>{k}</span>
                  <span className="text-[11px] font-medium" style={{ color: T.text1 }}>{v}</span>
                </div>
              ))}
              <div className="flex items-center justify-between">
                <span className="text-[11px]" style={{ color: T.text3 }}>Status</span>
                <span className="flex items-center gap-1 text-[11px]" style={{ color: T.success }}>
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: T.success }} />Ativo
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px]" style={{ color: T.text3 }}>Sugestões</span>
                <span className="text-[11px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: T.aiBg, color: T.ai }}>2 pendentes</span>
              </div>
            </div>
          </div>

          <div className="px-4 py-4 space-y-2">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: T.text4 }}>Conversas Anteriores</h4>
            {[['Dúvida sobre planos','08/03'],['Primeiro contato','01/03']].map(([t,d]) => (
              <div key={t} className="flex items-center justify-between p-2.5 rounded-lg cursor-pointer hover:brightness-110 transition-all" style={{ backgroundColor: T.surface }}>
                <div>
                  <div className="text-[11px]" style={{ color: T.text2 }}>{t}</div>
                  <div className="text-[10px]" style={{ color: T.text4 }}>Resolvida · {d}</div>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: T.overlay, color: T.text3 }}>Resolvida</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scroll FAB */}
      <button className="fixed bottom-24 right-8 w-10 h-10 rounded-full shadow-lg flex items-center justify-center hover:brightness-125 transition-all z-50"
        style={{ backgroundColor: T.surface, border: `1px solid ${T.border}`, color: T.text3, display: detailOpen ? 'none' : undefined }}>
        <ChevronDown className="w-5 h-5" />
        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center" style={{ backgroundColor: T.lime, color: T.nav }}>2</span>
      </button>
    </div>
  );
}
