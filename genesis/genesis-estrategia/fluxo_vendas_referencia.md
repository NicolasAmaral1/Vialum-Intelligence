# ESTRUTURA DE CRM
# GENESIS MARCAS E PATENTES
## Pipelines, Estágios, Tarefas e Automações
**Pipedrive CRM | Fevereiro 2026**

> Documento extraído do PDF de referência original, transcrito na íntegra.

---

## 1. DIAGNÓSTICO DO FUNIL ATUAL

Analisando seu pipeline atual no Pipedrive, identifiquei os seguintes problemas estruturais que precisam ser corrigidos:

**PROBLEMAS IDENTIFICADOS**
1. **Mistura de estágios com tarefas** — 'Grupo e Instagram', 'E.R' e 'C.P.F' são ações (tarefas), não posições do deal no funil.
2. **Funil único para processos diferentes** — agência com registro e sem registro têm jornadas distintas, mas compartilham o mesmo pipeline.
3. **Probabilidades todas em 100%** — impossibilita forecast de receita e não reflete a realidade de conversão.
4. **Tempos de estagnação zerados ou ausentes** — o sistema não alerta quando um deal está parado.
5. **'Congelado' como estágio** — deveria ser um rótulo/filtro, não um estágio no pipeline.
6. **Sem critérios de entrada/saída** — os deals avançam por feeling, não por critérios objetivos.

**PRINCÍPIO-CHAVE: ESTÁGIO vs. TAREFA**
- **ESTÁGIO** = Onde o deal ESTÁ na jornada (posição). Representa um marco de comprometimento do prospect.
- **TAREFA** = O que você FAZ dentro daquele estágio (ação). São atividades que movem o deal para o próximo estágio.
- *Exemplo:* 'Reunião Marcada' é um ESTÁGIO. 'Enviar lembrete da reunião' é uma TAREFA dentro desse estágio. 'Criar grupo no WhatsApp' é uma TAREFA, não um estágio. O deal não 'mora' ali.

---

## 2. ESTRUTURA RECOMENDADA: 3 PIPELINES

Com base na análise do seu processo, a recomendação é separar em 3 pipelines distintos no Pipedrive. Cada um tem uma jornada, métricas e automações diferentes.

| PIPELINE | OBJETIVO | PÚBLICO | ESTÁGIOS |
|----------|----------|----------|----------|
| **Prospecção de Agências** | Converter agências em parceiras ou clientes de registro | Agências de marketing prospectadas ativamente | 7 estágios |
| **Nurturing de Parceria** | Ativar a parceria de indicação mútua com agências que já têm registro | Agências pós-reunião que já possuem registro | 5 estágios |
| **Vendas por Indicação** | Fechar registro de marca com leads indicados por agências parceiras | Leads indicados pelas agências | 5 estágios |

**POR QUE 3 PIPELINES?**
1. **Métricas limpas** — cada funil tem sua taxa de conversão, ciclo médio e forecast separados.
2. **Automação precisa** — cada pipeline dispara tarefas e mensagens diferentes.
3. **Visão clara** — você sabe exatamente quantas agências estão em prospecção, quantas em nurturing, e quantos leads de indicação estão em negociação.
4. **Agente de IA** — seu agente pode receber instruções específicas por pipeline, sem confusão.

---

## 3. PIPELINE 1: PROSPECÇÃO DE AGÊNCIAS

Este é o funil principal. Todo deal começa aqui. Após a reunião, o deal é movido para o Pipeline 2 (se já tem registro) ou continua aqui até fechamento (se não tem registro).

| # | ESTÁGIO | CRITÉRIO DE ENTRADA | CRITÉRIO DE SAÍDA | PROB. | ESTAG. | TAREFAS AUTOMÁTICAS |
|---|---|---|---|---|---|---|
| 1 | **Prospectado** | Lead identificado e adicionado ao CRM | Primeira mensagem enviada | 5% | 2d | Criar tarefa: enviar mensagem inicial |
| 2 | **Contato Realizado** | Mensagem enviada | Prospect respondeu | 10% | 3d | Follow-up automático em 24h e 48h |
| 3 | **Em Conversa** | Prospect respondeu | Reunião agendada ou descartado | 20% | 5d | Criar tarefa: agendar reunião |
| 4 | **Reunião Agendada** | Reunião confirmada no calendário | Reunião realizada ou no-show | 35% | 1d* | Lembrete 1h antes; preparar pesquisa da agência |
| 5 | **Reunião Realizada** | Reunião aconteceu | Classificar: tem ou não tem registro | 50% | 1d | Classificar lead (campo customizado) |
| 6 | **Proposta / Laudo Enviado** | Agência SEM registro; laudo de viabilidade pronto e enviado | Reunião de fechamento agendada | 65% | 3d | Enviar laudo + agendar reunião de fechamento |
| 7 | **Negociação / Fechamento** | Reunião de pitch realizada | Contrato enviado e assinado, ou perdido | 80% | 5d | Follow-up a cada 2 dias; enviar contrato |

*\* Estagnação da Reunião Agendada: conta a partir da data da reunião, não da criação do deal.*

**FLUXO DE SAÍDA DO PIPELINE 1**
Após 'Reunião Realizada' (estágio 5), o deal se divide:
→ **JÁ TEM REGISTRO:** Deal é MOVIDO para o Pipeline 2 (Nurturing de Parceria).
→ **NÃO TEM REGISTRO:** Deal continua no Pipeline 1, avança para 'Proposta/Laudo Enviado'.

**No-show:** Deal volta para 'Reunião Agendada' com tarefa de reagendamento. Após 2 no-shows, mover para Perdido.

**TAREFAS DETALHADAS POR ESTÁGIO (Pipeline 1)**
**Estágio 5 — Reunião Realizada:**
- Tarefa 1: Criar grupo no WhatsApp (imediato)
- Tarefa 2: Enviar saudação + material no grupo (até 1h após)
- Tarefa 3: Classificar campo 'Tem Registro?' (Sim/Não)
- Tarefa 4: Se NÃO tem registro → avisar que laudo será preparado
- Tarefa 5: Seguir no Instagram da agência

**Estágio 5 — Sequência E.R (aplica para ambos os caminhos):**
- Tarefa 6: Dia 1 → enviar 1 E.R no grupo
- Tarefa 7: Dia 2 → enviar 2 E.Rs no grupo

**Se NÃO tem registro (continua no Pipeline 1):**
- Tarefa 8: Dia 2 → enviar laudo no grupo
- Tarefa 9: Dia 2 → solicitar agendamento de reunião de fechamento

**Se JÁ tem registro (move para Pipeline 2):**
- Tarefa 8: Dia 3 → cobrar indicação (C.P.F)

---

## 4. PIPELINE 2: NURTURING DE PARCERIA

Este pipeline recebe agências que JÁ possuem registro de marca. O objetivo é ativar a parceria de indicação mútua. O deal entra aqui após ser movido do Pipeline 1.

| # | ESTÁGIO | CRITÉRIO DE ENTRADA | CRITÉRIO DE SAÍDA | PROB. | ESTAG. | TAREFAS AUTOMÁTICAS |
|---|---|---|---|---|---|---|
| 1 | **Onboarding** | Deal movido do Pipeline 1 (tem registro) | Grupo criado, saudação enviada, material entregue | 30% | 1d | Criar grupo, enviar saudação + material, seguir Instagram |
| 2 | **Entrega de Valor (E.Rs)** | Onboarding completo | 3 E.Rs enviados + indicação cobrada | 50% | 3d | Dia 1: 1 E.R; Dia 2: 2 E.Rs; Dia 3: cobrar indicação |
| 3 | **Follow-Up de Ativação** | E.Rs entregues e indicação cobrada | Agência fez 1a indicação ou esfriou | 60% | 7d | Follow-up a cada 3 dias; enviar E.Rs extras se houver |
| 4 | **Parceria Ativa** | Agência fez pelo menos 1 indicação | 3+ indicações recebidas | 90% | 30d | Manter relacionamento ativo; check-in mensal; E.Rs periódicos |
| 5 | **Parceria Consolidada** | 3+ indicações recebidas | Parceiro recorrente (WON) | 100% | — | Manter na base; relacionamento contínuo |

**NOTA IMPORTANTE:**
Se durante o nurturing a agência demonstrar interesse em registrar novas marcas (campo 'Depende do caso'), crie um NOVO deal no Pipeline 1 a partir do estágio 'Proposta/Laudo Enviado', vinculado à mesma organização. O deal de parceria continua no Pipeline 2 normalmente.

---

## 5. PIPELINE 3: VENDAS POR INDICAÇÃO

Funil curto e direto. Os leads vêm das agências parceiras (Pipeline 2). O produto é o registro de marca.

| # | ESTÁGIO | CRITÉRIO DE ENTRADA | CRITÉRIO DE SAÍDA | PROB. | ESTAG. | TAREFAS AUTOMÁTICAS |
|---|---|---|---|---|---|---|
| 1 | **Lead Recebido** | Indicação recebida da agência parceira | Contato realizado | 20% | 1d | Contato imediato; agradecer agência |
| 2 | **Laudo em Elaboração** | Contato feito, interesse confirmado | Laudo de viabilidade pronto | 40% | 2d | Elaborar laudo de viabilidade |
| 3 | **Laudo Enviado** | Laudo pronto | Reunião de apresentação agendada | 60% | 2d | Enviar laudo + oferecer reunião |
| 4 | **Reunião / Pitch** | Reunião agendada | Proposta aceita ou rejeitada | 75% | 3d | Realizar reunião; enviar proposta formal |
| 5 | **Contrato / Fechamento** | Proposta aceita | Contrato assinado (WON) ou perdido | 90% | 3d | Enviar contrato; follow-up até assinatura |

**CAMPO OBRIGATÓRIO:**
Todo deal neste pipeline deve ter o campo 'Agência Origem' preenchido. Isso permite rastrear qual parceira traz mais indicações e medir o ROI de cada parceria.

---

## 6. CAMPOS CUSTOMIZADOS NO PIPEDRIVE

Esses campos são essenciais para segmentação, automação e relatórios. Configure-os como campos de Deal no Pipedrive.

| CAMPO | TIPO | PIPELINE | USO |
|---|---|---|---|
| **Tem Registro?** | Sim / Não | Pipeline 1 | Determina se deal vai para Pipeline 2 ou continua |
| **Cidade da Agência** | Texto | Todos | Segmentar prospecção por região |
| **E.Rs Enviados** | Numérico | Pipeline 1 e 2 | Rastrear quantas indicações foram entregues |
| **Indicações Recebidas** | Numérico | Pipeline 2 | Medir reciprocidade da parceria |
| **Agência Origem** | Organização (link)| Pipeline 3 | Vincular lead indicado à agência parceira |
| **Grupo WhatsApp Criado?**| Sim / Não | Pipeline 1 e 2 | Controlar se onboarding foi iniciado |
| **Data da Reunião** | Data | Pipeline 1 e 3 | Calcular follow-up e no-show |
| **No-Shows** | Numérico | Pipeline 1 | Após 2 no-shows, mover para perdido |
| **Motivo de Perda** | Dropdown | Todos | Sem interesse / Sem orçamento / Concorrente / No-show recorrente / Outro |

---

## 7. MAPA DE AUTOMAÇÕES PARA O AGENTE DE IA

Abaixo está o mapa completo de automações que seu agente de IA deve executar. Cada automação é acionada por um gatilho (trigger) no Pipedrive e resulta em uma ou mais ações.

### 7.1 Automações do Pipeline 1: Prospecção
**AUTO-01: Novo Deal Criado**
- *Gatilho:* Deal criado no Pipeline 1
- *Ação:* Criar tarefa 'Enviar mensagem inicial' com prazo de 1 dia
- *Ação:* Preencher campo 'Cidade da Agência' automaticamente se disponível

**AUTO-02: Deal move para Contato Realizado**
- *Gatilho:* Deal movido para estágio 'Contato Realizado'
- *Ação:* Agendar follow-up automático em 24h caso não haja resposta
- *Ação:* Agendar segundo follow-up em 48h

**AUTO-03: Deal move para Reunião Agendada**
- *Gatilho:* Deal movido para estágio 'Reunião Agendada'
- *Ação:* Criar tarefa 'Enviar lembrete 1h antes da reunião'
- *Ação:* Criar tarefa 'Pesquisar agência antes da reunião'

**AUTO-04: Deal move para Reunião Realizada**
- *Gatilho:* Deal movido para estágio 'Reunião Realizada'
- *Ação:* Criar tarefa 'Criar grupo WhatsApp' (prazo: imediato)
- *Ação:* Criar tarefa 'Enviar saudação + material' (prazo: 1h)
- *Ação:* Criar tarefa 'Seguir Instagram da agência' (prazo: 1h)
- *Ação:* Criar tarefa 'Classificar: Tem Registro?' (prazo: imediato)
- *Ação:* Agendar tarefa 'Enviar 1 E.R' para Dia+1
- *Ação:* Agendar tarefa 'Enviar 2 E.Rs' para Dia+2

**AUTO-05: Campo 'Tem Registro?' = Sim**
- *Gatilho:* Campo 'Tem Registro?' marcado como Sim
- *Ação:* MOVER deal para Pipeline 2, estágio 'Onboarding'
- *Ação:* Agendar tarefa 'Cobrar indicação' para Dia+3

**AUTO-06: Campo 'Tem Registro?' = Não**
- *Gatilho:* Campo 'Tem Registro?' marcado como Não
- *Ação:* Criar tarefa 'Avisar que laudo será preparado' (prazo: imediato)
- *Ação:* Criar tarefa 'Elaborar laudo de viabilidade' (prazo: Dia+1)
- *Ação:* Agendar tarefa 'Enviar laudo no grupo' para Dia+2
- *Ação:* Agendar tarefa 'Solicitar reunião de fechamento' para Dia+2

**AUTO-07: No-Show Detectado**
- *Gatilho:* Reunião não realizada (data passou sem mudança de estágio)
- *Ação:* Incrementar campo 'No-Shows' em +1
- *Ação:* Se No-Shows < 2 → Criar tarefa 'Reagendar reunião'
- *Ação:* Se No-Shows >= 2 → Mover para Perdido (motivo: No-show recorrente)

### 7.2 Automações do Pipeline 2: Nurturing
**AUTO-08: Deal entra no Pipeline 2**
- *Gatilho:* Deal movido para Pipeline 2, estágio 'Onboarding'
- *Ação:* Verificar se grupo WhatsApp já foi criado (campo)
- *Ação:* Se não → Criar tarefa 'Criar grupo WhatsApp'
- *Ação:* Criar tarefa 'Enviar saudação + material'

**AUTO-09: Deal move para Entrega de Valor**
- *Gatilho:* Deal movido para 'Entrega de Valor (E.Rs)'
- *Ação:* Agendar 'Enviar 1 E.R' (Dia+1)
- *Ação:* Agendar 'Enviar 2 E.Rs' (Dia+2)
- *Ação:* Agendar 'Cobrar indicação' (Dia+3)

**AUTO-10: Deal move para Follow-Up de Ativação**
- *Gatilho:* Deal movido para 'Follow-Up de Ativação'
- *Ação:* Criar tarefa recorrente 'Follow-up com agência' a cada 3 dias
- *Ação:* Se E.Rs extras disponíveis → agendar envio

**AUTO-11: Indicação Recebida**
- *Gatilho:* Campo 'Indicações Recebidas' incrementado
- *Ação:* Mover deal para 'Parceria Ativa' (se primeira indicação)
- *Ação:* Criar deal no Pipeline 3 com dados do lead indicado
- *Ação:* Preencher campo 'Agência Origem' no novo deal
- *Ação:* Se Indicações >= 3 → Mover para 'Parceria Consolidada'

### 7.3 Automações do Pipeline 3: Indicação
**AUTO-12: Novo Lead de Indicação**
- *Gatilho:* Deal criado no Pipeline 3
- *Ação:* Criar tarefa 'Entrar em contato imediato' (prazo: mesmo dia)
- *Ação:* Criar tarefa 'Agradecer agência parceira pela indicação'

**AUTO-13: Deal move para Laudo em Elaboração**
- *Gatilho:* Deal movido para 'Laudo em Elaboração'
- *Ação:* Criar tarefa 'Elaborar laudo de viabilidade' (prazo: 2 dias)

**AUTO-14: Deal move para Laudo Enviado**
- *Gatilho:* Deal movido para 'Laudo Enviado'
- *Ação:* Criar tarefa 'Enviar laudo + oferecer reunião'
- *Ação:* Follow-up automático em 24h se não responder

**AUTO-15: Deal marcado como WON**
- *Gatilho:* Deal fechado como ganho em qualquer pipeline
- *Ação:* Notificar equipe
- *Ação:* Se Pipeline 3 → atualizar 'Indicações Recebidas' na agência origem

---

## 8. MÉTRICAS E KPIs POR PIPELINE

**PIPELINE 1: PROSPECÇÃO**
- Taxa de resposta (Prospectado → Contato)
- Taxa de agendamento (Contato → Reunião)
- Taxa de no-show
- % com registro vs sem registro
- Taxa de fechamento (registro)
- Ciclo médio de venda
- Valor médio do deal

**PIPELINE 2: NURTURING**
- Taxa de ativação (E.Rs → 1a indicação)
- Tempo médio até 1a indicação
- E.Rs enviados por parceria
- Indicações recebidas por parceria
- ROI por parceria (E.Rs dados vs recebidos)
- % de parcerias consolidadas
- Taxa de churn de parcerias

**PIPELINE 3: INDICAÇÃO**
- Volume de leads por agência
- Taxa de contato (Lead → Conversa)
- Taxa de conversão (Lead → WON)
- Ciclo médio de fechamento
- Valor médio do deal
- Receita por agência origem
- Custo por lead (E.Rs investidos)

---

## 9. VISÃO GERAL DO FLUXO

**FLUXO COMPLETO DA OPERAÇÃO**
```text
PROSPECÇÃO → Mensagem → Conversa → Reunião Agendada → Reunião Realizada
                                                        ↓
                         ┌──────────────────────────────┴──────────────────────────────┐
                         ↓                                                             ↓
                  JÁ TEM REGISTRO                                               NÃO TEM REGISTRO
               (Move para Pipeline 2)                                      (Continua no Pipeline 1)
               → Onboarding                                                 → Laudo Enviado
               → E.Rs                                                       → Reunião de Fechamento
               → Cobrar indicação                                           → Negociação
               → Follow-up ativação                                         → Contrato
               → Parceria Ativa                                             → WON / LOST
                         ↓
               Agência indica leads
                         ↓
               (Move para Pipeline 3 - Vendas por Indicação)
               → Contato → Laudo → Reunião → Contrato → WON
```

**PRÓXIMO PASSO: INSTRUÇÕES PARA O AGENTE DE IA**
Este documento contém toda a lógica de negócio. Na próxima etapa, vamos transformar cada automação (AUTO-01 a AUTO-15) em comandos específicos para seu agente de IA, incluindo os textos de mensagem, condições lógicas e integrações com Pipedrive API.
