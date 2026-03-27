# Análise Completa: Steps × Executores × HITL

> **Data:** 2026-03-27
> **Base:** Card TESTE no ClickUp (lista Protocolo)
> **Taxonomia:** Workflow > Stage > Task > Step > Action

## Legenda

| Símbolo | Executor | Significado |
|----|----|----|
| 🤖 | `ai` | IA (squad hoje, langchain/script amanhã) |
| 👤 | `human` | Pessoa do time (operador, analista, financeiro) |
| ⚙️ | `system` | Automação determinística (API call, script, sem LLM) |
| ⏳ | `wait` | Bola com o cliente — workflow pausa |
| ✋ | `hitl` | Ação humana de aprovação/edição dentro de um step de IA |

## Regra

> Cada Step no ClickUp (sub-sub-subtask) é 1 unidade rastreável.
> Dentro dele, as Actions podem envolver múltiplos executores.
> Se tem ✋ HITL, o step recebe **assignee + tag** `aprovar` no ClickUp.


---

## STAGE 1: SOLICITAR DADOS

### Step 1.1 — Preencher termos do usuário

| # | Action | Executor | Detalhe |
|----|----|----|----|
| 1 | Preencher valor, parcelas, forma pgto, tipo marca | 👤 human | Operador preenche nos custom fields do card |

**Assignee:** operador
**Tags:** nenhuma
**Nota:** Pode ser completado até o Stage 7 (pré-protocolo). Não é bloqueante agora.


---

### Step 1.2 — Enviar mensagem de qualificação no WhatsApp

| # | Action | Executor | Detalhe |
|----|----|----|----|
| 1 | Ler dados do deal/card pra contexto | ⚙️ system | CRM Hub puxa dados existentes |
| 2 | Preparar mensagem personalizada | 🤖 ai | Squad monta msg pedindo: PF/PJ, nome, CPF/CNPJ, RG, nacionalidade, estado civil, profissão, endereço, email |
| 3 | **Aprovar/editar mensagem** | ✋ hitl | Operador lê a msg, aprova ou edita |
| 4 | Enviar via WhatsApp | ⚙️ system | Vialum Chat API envia |

**Assignee:** operador (por causa do HITL)
**Tags:** `aprovar` (enquanto action 3 estiver pendente)
**Status do step:** preparando → **aprovar** → enviado


---

### Step 1.3 — Aguardar e checar respostas

| # | Action | Executor | Detalhe |
|----|----|----|----|
| 1 | Aguardar resposta do cliente | ⏳ wait | Follow-up D+1, D+3, D+5 |
| 2 | Ler mensagens do cliente | 🤖 ai | Squad/engine lê conversa via Vialum Chat |
| 3 | Extrair dados estruturados | 🤖 ai | Nome, CPF, endereço, etc. em JSON |
| 4 | Identificar dados faltantes | 🤖 ai | Compara com checklist de campos obrigatórios |

**Assignee:** nenhum (100% IA)
**Tags:** `aguardando-cliente` (enquanto action 1)
**Nota:** Se faltar dados, precisa do step "Pedir dados faltantes" que **não existe no ClickUp hoje**.

**⚠️ FALTA NO CLICKUP:** Step "Pedir dados faltantes" (com HITL — IA prepara msg → operador aprova → envia → aguarda → loop)


---

### Step 1.4 — Adicionar respostas ao ClickUp

| # | Action | Executor | Detalhe |
|----|----|----|----|
| 1 | Preencher descrição do card com dados | ⚙️ system | CRM Hub atualiza card |
| 2 | Preencher custom fields | ⚙️ system | CRM Hub seta campos |

**Assignee:** nenhum (100% system)
**Tags:** nenhuma

**⚠️ FALTA NO CLICKUP:** Step "Revisar dados consolidados" (👤 human, gate — operador confere antes de avançar pro Stage 2)


---

### Resumo Stage 1

| Step | Executor principal | HITL? | Falta no ClickUp? |
|----|----|----|----|
| 1.1 Preencher termos | 👤 human | Não | Não |
| 1.2 Enviar msg qualificação | 🤖→✋→⚙️ | **Sim** | Não |
| 1.3 Aguardar e checar | 🤖+⏳ | Não | Não |
| 1.4 Adicionar no ClickUp | ⚙️ | Não | Não |
| ❌ Pedir dados faltantes | 🤖→✋→⚙️→⏳ | **Sim** | **Sim, falta** |
| ❌ Revisar dados consolidados | 👤 | Não (é gate) | **Sim, falta** |


---

## STAGE 2: CONTRATO E PROCURAÇÃO

### Step 2.1 — Montar JSON de dados necessários

| # | Action | Executor | Detalhe |
|----|----|----|----|
| 1 | Ler dados do card ClickUp | ⚙️ system | CRM Hub puxa card |
| 2 | Montar JSON para assemble_contract.py | ⚙️ system | Transforma dados em payload |

**Assignee:** nenhum
**Tags:** nenhuma


---

### Step 2.2 — Gerar PDFs

| # | Action | Executor | Detalhe |
|----|----|----|----|
| 1 | Executar assemble_contract.py | ⚙️ system | Gera contrato.pdf + procuracao.pdf |

**Assignee:** nenhum
**Tags:** nenhuma


---

### Step 2.3 — Revisar documentos

| # | Action | Executor | Detalhe |
|----|----|----|----|
| 1 | Abrir PDFs e conferir dados | 👤 human | Nome, CPF/CNPJ, marca, classes, valores, condições pgto |
| 2 | Aprovar ou pedir correção | 👤 human | Se errado, volta ao 2.1 com correção |

**Assignee:** operador
**Tags:** nenhuma (é ação humana direta, não HITL de IA)


---

### Step 2.4 — Upload ClickUp + Drive

| # | Action | Executor | Detalhe |
|----|----|----|----|
| 1 | Upload PDFs no Google Drive | ⚙️ system | Pasta do cliente |
| 2 | Anexar links no card ClickUp | ⚙️ system | CRM Hub |

**Assignee:** nenhum
**Tags:** nenhuma


---

### Step 2.5 — Enviar documentos no WhatsApp da pessoa

| # | Action | Executor | Detalhe |
|----|----|----|----|
| 1 | Preparar mensagem com PDFs | 🤖 ai | Msg explicando que precisa assinar e devolver |
| 2 | **Aprovar/editar mensagem** | ✋ hitl | Operador confere |
| 3 | Enviar PDFs + mensagem via WhatsApp | ⚙️ system | Vialum Chat API |

**Assignee:** operador (HITL)
**Tags:** `aprovar`
**Status:** preparando → **aprovar** → enviado


---

### Resumo Stage 2

| Step | Executor principal | HITL? | Falta no ClickUp? |
|----|----|----|----|
| 2.1 Montar JSON | ⚙️ | Não | Não |
| 2.2 Gerar PDFs | ⚙️ | Não | Não |
| 2.3 Revisar documentos | 👤 | Não | Não |
| 2.4 Upload Drive + ClickUp | ⚙️ | Não | Não |
| 2.5 Enviar docs WhatsApp | 🤖→✋→⚙️ | **Sim** | Não |


---

## STAGE 3: AGUARDANDO ASSINATURA

### Step 3.1 — Aguarda devolução assinada

| # | Action | Executor | Detalhe |
|----|----|----|----|
| 1 | Monitorar conversa WhatsApp | ⚙️ system | Detecta media recebida |
| 2 | Aguardar cliente enviar doc | ⏳ wait | Follow-up D+1, D+3 |
| 3 | Classificar media recebida | 🤖 ai | Classification Hub identifica se é doc assinado |

**Assignee:** nenhum
**Tags:** `aguardando-cliente`
**Nota:** Follow-ups de "já assinou?" precisam de HITL?

**⚠️ DECISÃO:** Os follow-ups de assinatura devem ter HITL (operador aprova msg) ou podem ser automáticos? Sugiro HITL no primeiro, automático nos seguintes.


---

### Step 3.2 — Conferência se está correto

| # | Action | Executor | Detalhe |
|----|----|----|----|
| 1 | Verificar se contrato está assinado nos locais corretos | 👤 human | Operador confere |
| 2 | Verificar se procuração está assinada | 👤 human | Operador confere |
| 3 | Anexar docs assinados no card | ⚙️ system | Após aprovação |

**Assignee:** operador
**Tags:** nenhuma (ação humana direta)


---

### Step 3.3 — Cobrar pagamento

| # | Action | Executor | Detalhe |
|----|----|----|----|
| 1 | Preparar mensagem de cobrança GRU | 🤖 ai | Lembrete de pagamento |
| 2 | **Aprovar mensagem** | ✋ hitl | Operador confere |
| 3 | Enviar via WhatsApp | ⚙️ system | Vialum Chat |
| 4 | Aguardar pagamento | ⏳ wait | Pode demorar |

**Assignee:** operador (HITL) ou financeiro
**Tags:** `aprovar`

**⚠️ PERGUNTA:** Você confirmou que a cobrança aqui é da GRU. Mas a GRU só é gerada no Stage 5. Esse step deveria estar no Stage 6 (Pagamento GRUs)? Ou é cobrança do contrato (pagamento à Genesis pelo serviço)?


---

### Step 3.4 — Emitir CNPJ (→ renomear: Emitir certidão CNPJ e QSA)

| # | Action | Executor | Detalhe |
|----|----|----|----|
| 1 | Acessar site da Receita Federal | 👤 human | Operador |
| 2 | Emitir certidão de CNPJ | 👤 human | Download PDF |
| 3 | Emitir QSA (quadro societário) | 👤 human | Download PDF |
| 4 | Anexar no card ClickUp | ⚙️ system | Após download |

**Assignee:** operador
**Tags:** nenhuma

**⚠️ PERGUNTA:** Esse step faz mais sentido aqui (Stage 3) ou no Stage 5 (Cadastro e GRU) junto com o cadastro no INPI?


---

### Resumo Stage 3

| Step | Executor principal | HITL? | Falta no ClickUp? |
|----|----|----|----|
| 3.1 Aguarda assinatura | ⚙️+🤖+⏳ | Não (ou sim pra follow-up) | Não |
| 3.2 Conferência assinatura | 👤 | Não | Não |
| 3.3 Cobrar pagamento | 🤖→✋→⚙️→⏳ | **Sim** | Não (mas posição duvidosa) |
| 3.4 Emitir certidão CNPJ/QSA | 👤 | Não | Renomear |


---

## STAGE 4: DOCUMENTOS DO CLIENTE

### Step 4.1 — Solicitar no WhatsApp RG + CPF (CIN ou CNH) + Comprovante de residência

| # | Action | Executor | Detalhe |
|----|----|----|----|
| 1 | Determinar docs necessários (PF vs PJ) | 🤖 ai | Se PF: RG+CPF/CIN/CNH + comprovante. Se PJ: + contrato social + cartão CNPJ |
| 2 | Preparar mensagem listando docs | 🤖 ai | Msg personalizada |
| 3 | **Aprovar mensagem** | ✋ hitl | Operador confere |
| 4 | Enviar via WhatsApp | ⚙️ system | Vialum Chat |

**Assignee:** operador (HITL)
**Tags:** `aprovar`


---

### Step 4.2 — Aguarda envio de documentos

| # | Action | Executor | Detalhe |
|----|----|----|----|
| 1 | Monitorar conversa | ⚙️ system | Detecta media recebida |
| 2 | Aguardar cliente enviar | ⏳ wait | Follow-up D+1, D+3 |
| 3 | Persistir media recebida | ⚙️ system | Media Service salva no MinIO |
| 4 | Classificar documento | 🤖 ai | Classification Hub identifica tipo (RG, CPF, CNH, etc.) |

**Assignee:** nenhum
**Tags:** `aguardando-cliente`


---

### Step 4.3 — Verificar legibilidade e completude

| # | Action | Executor | Detalhe |
|----|----|----|----|
| 1 | Operador abre cada documento | 👤 human | Confere se legível, completo, não cortado |
| 2 | Se ilegível: pedir reenvio | 👤 human | Marca como rejeitado |

**Assignee:** operador
**Tags:** nenhuma

**⚠️ FALTA NO CLICKUP:** Se doc rejeitado, precisa de step "Pedir reenvio" (🤖→✋→⚙️→⏳ — IA prepara msg explicando problema → operador aprova → envia → aguarda)


---

### Step 4.4 — Verificar se todos foram recebidos

| # | Action | Executor | Detalhe |
|----|----|----|----|
| 1 | Comparar lista de docs necessários vs recebidos | ⚙️ system | Checklist automática |
| 2 | Se faltam: voltar ao Step 4.1 | ⚙️ system | Loop |

**Assignee:** nenhum
**Tags:** nenhuma


---

### Step 4.5 — Anexar tudo no ClickUp

| # | Action | Executor | Detalhe |
|----|----|----|----|
| 1 | Anexar docs aprovados no card com labels | ⚙️ system | CRM Hub |

**Assignee:** nenhum
**Tags:** nenhuma


---

### Step 4.6 — Gerar documento dos clientes (→ REMOVER ou trocar)

**⚠️ VOCÊ DISSE PRA TIRAR.** Substituir por "Selecionar documentos do cliente" ou remover completamente?

Se "Selecionar documentos":

| # | Action | Executor | Detalhe |
|----|----|----|----|
| 1 | Revisar conjunto final de docs | 👤 human | Operador confirma que tudo está OK pra avançar |

**Assignee:** operador (gate)


---

### Resumo Stage 4

| Step | Executor principal | HITL? | Falta no ClickUp? |
|----|----|----|----|
| 4.1 Solicitar docs | 🤖→✋→⚙️ | **Sim** | Não |
| 4.2 Aguarda envio | ⚙️+🤖+⏳ | Não | Não |
| 4.3 Verificar legibilidade | 👤 | Não | Não |
| 4.4 Verificar completude | ⚙️ | Não | Não |
| 4.5 Anexar no ClickUp | ⚙️ | Não | Não |
| 4.6 Gerar doc clientes | ❓ | — | **Remover ou trocar** |
| ❌ Pedir reenvio | 🤖→✋→⚙️→⏳ | **Sim** | **Sim, falta** |


---

## STAGE 5: CADASTRO E GRU

### Step 5.1 — Gerar guia de ajuda (→ renomear: Gerar guia de dados para e-INPI)

| # | Action | Executor | Detalhe |
|----|----|----|----|
| 1 | Ler todos os dados do card | ⚙️ system | CRM Hub |
| 2 | Preparar dados mastigados pra copiar/colar | 🤖 ai | Formata: "Titular: X / CPF: Y / Endereço: Z / ..." |
| 3 | **Aprovar guia** | ✋ hitl | Operador confere antes de usar |

**Assignee:** operador (HITL)
**Tags:** `aprovar`
**Nota:** Após aprovar, operador usa os dados pra cadastrar no e-INPI e gerar GRUs manualmente.

**⚠️ FALTA NO CLICKUP:**

* Step "Cadastrar titular no e-INPI" (👤 human — operador faz manualmente)
* Step "Gerar GRUs no e-INPI" (👤 human — operador faz manualmente)


---

### Step 5.2 — Anexa GRU no Card

| # | Action | Executor | Detalhe |
|----|----|----|----|
| 1 | Operador faz upload do PDF da GRU | 👤 human | Upload manual ou via script |
| 2 | Anexar no card | ⚙️ system | CRM Hub |

**Assignee:** operador
**Tags:** nenhuma


---

### Step 5.3 — Enviar GRUs ao cliente via WhatsApp

| # | Action | Executor | Detalhe |
|----|----|----|----|
| 1 | Preparar mensagem com GRUs e instruções de pagamento | 🤖 ai | Valor, vencimento, como pagar |
| 2 | **Aprovar mensagem** | ✋ hitl | Operador confere |
| 3 | Enviar GRUs + mensagem via WhatsApp | ⚙️ system | Vialum Chat |

**Assignee:** operador (HITL)
**Tags:** `aprovar`


---

### Resumo Stage 5

| Step | Executor principal | HITL? | Falta no ClickUp? |
|----|----|----|----|
| 5.1 Gerar guia dados | 🤖→✋ | **Sim** | Renomear |
| 5.2 Anexar GRU | 👤+⚙️ | Não | Não |
| 5.3 Enviar GRUs WhatsApp | 🤖→✋→⚙️ | **Sim** | Não |
| ❌ Cadastrar titular e-INPI | 👤 | Não | **Sim, falta** |
| ❌ Gerar GRUs no e-INPI | 👤 | Não | **Sim, falta** |


---

## STAGE 6: PAGAMENTO GRUs

### Step 6.1 — Fazer follow-up de pagamento

| # | Action | Executor | Detalhe |
|----|----|----|----|
| 1 | Preparar lembrete de pagamento | 🤖 ai | Msg amigável, D+1, D+3, D+5 |
| 2 | **Aprovar lembrete** | ✋ hitl | Operador confere antes de enviar |
| 3 | Enviar via WhatsApp | ⚙️ system | Vialum Chat |
| 4 | Aguardar pagamento | ⏳ wait | Loop até pagar |

**Assignee:** operador (HITL)
**Tags:** `aprovar`
**Nota:** O primeiro follow-up com HITL. Posteriores podem ser automáticos (decisão futura).


---

### Step 6.2 — Detectar comprovante

| # | Action | Executor | Detalhe |
|----|----|----|----|
| 1 | Monitorar conversa | ⚙️ system | Detecta media |
| 2 | Classificar media | 🤖 ai | Classification Hub: é comprovante de pagamento? |

**Assignee:** nenhum
**Tags:** nenhuma


---

### Step 6.3 — Validar comprovante

| # | Action | Executor | Detalhe |
|----|----|----|----|
| 1 | Conferir valor correto | 👤 human | Financeiro |
| 2 | Conferir GRU correta (se múltiplas) | 👤 human | Financeiro |
| 3 | Conferir destinatário (CNPJ Genesis) | 👤 human | Financeiro |
| 4 | Marcar como pago | 👤 human | Aplica etiqueta no ClickUp |

**Assignee:** financeiro
**Tags:** nenhuma


---

### Resumo Stage 6

| Step | Executor principal | HITL? | Falta no ClickUp? |
|----|----|----|----|
| 6.1 Follow-up pagamento | 🤖→✋→⚙️→⏳ | **Sim** | Não |
| 6.2 Detectar comprovante | ⚙️+🤖 | Não | Não |
| 6.3 Validar comprovante | 👤 | Não | Não |

**✅ Stage completo, sem mudanças.**


---

## STAGE 7: PRÉ-PROTOCOLO

### Step 7.1 — Analisar estratégia de depósito

| # | Action | Executor | Detalhe |
|----|----|----|----|
| 1 | Definir nome(s) exato(s) para registro | 👤 human | Analista |
| 2 | Definir classes NCL com especificações | 👤 human | Analista |
| 3 | Definir tipo de marca (mista/nominativa/figurativa) | 👤 human | Analista |
| 4 | Definir quantidade de depósitos | 👤 human | Analista |

**Assignee:** analista
**Tags:** nenhuma


---

### Step 7.2 — Montar proposta de depósito

| # | Action | Executor | Detalhe |
|----|----|----|----|
| 1 | Preparar documento detalhando depósitos | 👤 human | Analista: nomes, classes, custos |

**Assignee:** analista
**Tags:** nenhuma


---

### Step 7.3 — Enviar proposta no grupo de WhatsApp

| # | Action | Executor | Detalhe |
|----|----|----|----|
| 1 | Formatar proposta para envio | 🤖 ai | Formata de forma legível pro cliente |
| 2 | **Aprovar mensagem** | ✋ hitl | Operador/analista confere |
| 3 | Enviar no grupo/conversa | ⚙️ system | Vialum Chat |

**Assignee:** operador ou analista (HITL)
**Tags:** `aprovar`


---

### Step 7.4 — Aguardar aceite do cliente

| # | Action | Executor | Detalhe |
|----|----|----|----|
| 1 | Monitorar resposta | ⚙️ system | Vialum Chat |
| 2 | Aguardar | ⏳ wait | Pode levar dias/semanas |

**Assignee:** nenhum
**Tags:** `aguardando-cliente`


---

### Step 7.5 — Ajustar estratégia se necessário

| # | Action | Executor | Detalhe |
|----|----|----|----|
| 1 | Analisar feedback do cliente | 👤 human | Analista interpreta o que cliente quer mudar |
| 2 | Refazer proposta | 👤 human | Volta ao 7.2 (loop) |

**Assignee:** analista
**Tags:** nenhuma
**Nota:** Loop 7.2 → 7.5 pode repetir várias vezes.


---

### Step 7.6 — Registrar aceite final

| # | Action | Executor | Detalhe |
|----|----|----|----|
| 1 | Marcar no card que estratégia foi aprovada | ⚙️ system | CRM Hub |
| 2 | Registrar nomes e classes finais | ⚙️ system | Atualiza custom fields |

**Assignee:** nenhum
**Tags:** nenhuma


---

### Resumo Stage 7

| Step | Executor principal | HITL? | Falta no ClickUp? |
|----|----|----|----|
| 7.1 Analisar estratégia | 👤 | Não | Não |
| 7.2 Montar proposta | 👤 | Não | Não |
| 7.3 Enviar proposta | 🤖→✋→⚙️ | **Sim** | Não |
| 7.4 Aguardar aceite | ⚙️+⏳ | Não | Não |
| 7.5 Ajustar estratégia | 👤 | Não | Não |
| 7.6 Registrar aceite | ⚙️ | Não | Não |

**✅ Stage completo, sem mudanças.**


---

## STAGE 8: PROTOCOLO

### Step 8.1 — Checagem de documentação completa

| # | Action | Executor | Detalhe |
|----|----|----|----|
| 1 | Verificar: docs OK? | ⚙️ system | Checa attachments |
| 2 | Verificar: GRUs pagas? | ⚙️ system | Checa etiqueta/tag |
| 3 | Verificar: aceite registrado? | ⚙️ system | Checa campo |
| 4 | Verificar: termos preenchidos? | ⚙️ system | Checa custom fields |

**Assignee:** nenhum
**Tags:** nenhuma


---

### Step 8.2 — Realizar protocolo

| # | Action | Executor | Detalhe |
|----|----|----|----|
| 1 | Preencher formulário no e-INPI | 👤 human | Operador usa dados do card |
| 2 | Submeter pedido(s) | 👤 human | Pode ser múltiplos depósitos |

**Assignee:** operador
**Tags:** nenhuma

**⚠️ FALTA NO CLICKUP:** Step "Gerar guia de dados para depósito" (🤖→✋ — IA prepara dados mastigados pra copiar/colar no e-INPI, operador aprova antes de usar). Diferente do 5.1 que é pra cadastro — este é especificamente pra depósito com nomes/classes finais.


---

### Step 8.3 — Registrar IDs dos processos

| # | Action | Executor | Detalhe |
|----|----|----|----|
| 1 | Atualizar campo "Protocolo(s) INPI" no card | ⚙️ system | CRM Hub |

**Assignee:** nenhum (operador informa o número, system salva)
**Tags:** nenhuma

**⚠️ NOTA:** Quem informa o número? Se o operador digita, o executor da action 1 deveria ser 👤 human (operador informa) → ⚙️ system (salva). Precisa de input humano.


---

### Step 8.4 — Enviar comprovantes no WhatsApp para os clientes

| # | Action | Executor | Detalhe |
|----|----|----|----|
| 1 | Salvar comprovantes no Drive | ⚙️ system | Upload |
| 2 | Anexar no card | ⚙️ system | CRM Hub |
| 3 | Preparar mensagem de conclusão | 🤖 ai | "Sua marca foi protocolada! Número(s): XXX" |
| 4 | **Aprovar mensagem** | ✋ hitl | Operador confere |
| 5 | Enviar comprovantes + msg via WhatsApp | ⚙️ system | Vialum Chat |

**Assignee:** operador (HITL)
**Tags:** `aprovar`


---

### Resumo Stage 8

| Step | Executor principal | HITL? | Falta no ClickUp? |
|----|----|----|----|
| 8.1 Checagem documentação | ⚙️ | Não | Não |
| 8.2 Realizar protocolo | 👤 | Não | Não |
| 8.3 Registrar IDs | 👤+⚙️ | Não | Não |
| 8.4 Enviar comprovantes | 🤖→✋→⚙️ | **Sim** | Não |
| ❌ Gerar guia dados depósito | 🤖→✋ | **Sim** | **Sim, falta** |
| ❌ Salvar comprovantes Drive | ⚙️ | Não | **Sim, falta** (está embutido no 8.4) |


---

# CONSOLIDAÇÃO FINAL

## Totais

| Métrica | Quantidade |
|----|----|
| Steps existentes no ClickUp | 35 |
| Steps que faltam adicionar | 7 |
| Steps a renomear | 3 |
| Steps a remover | 1 |
| **Steps finais** | **41** |

## Todos os steps com HITL

| # | Step | Stage | O que a IA faz | O que o humano faz |
|----|----|----|----|----|
| 1 | Enviar msg qualificação | 1 | Prepara msg pedindo dados | Aprova/edita texto |
| 2 | Pedir dados faltantes | 1 | Prepara msg do que falta | Aprova/edita texto |
| 3 | Enviar docs WhatsApp | 2 | Prepara msg com contrato/procuração | Aprova/edita texto |
| 4 | Cobrar pagamento | 3 | Prepara cobrança | Aprova/edita texto |
| 5 | Solicitar docs pessoais | 4 | Prepara lista de docs necessários | Aprova/edita texto |
| 6 | Pedir reenvio doc | 4 | Prepara msg explicando problema | Aprova/edita texto |
| 7 | Gerar guia dados e-INPI (cadastro) | 5 | Prepara dados mastigados | Aprova antes de usar |
| 8 | Enviar GRUs WhatsApp | 5 | Prepara msg com instruções pgto | Aprova/edita texto |
| 9 | Follow-up pagamento | 6 | Prepara lembrete | Aprova/edita texto |
| 10 | Enviar proposta depósito | 7 | Formata proposta | Aprova/edita texto |
| 11 | Gerar guia dados depósito | 8 | Prepara dados mastigados | Aprova antes de usar |
| 12 | Enviar comprovantes | 8 | Prepara msg de conclusão | Aprova/edita texto |

**12 pontos de HITL** — todos seguem o mesmo padrão: IA prepara → humano aprova/edita.

## Steps a ADICIONAR no ClickUp

| # | Step | Stage | Executor | HITL? |
|----|----|----|----|----|
| 1 | Pedir dados faltantes | 1 | 🤖→✋→⚙️→⏳ | Sim |
| 2 | Revisar dados consolidados (gate) | 1 | 👤 | Não |
| 3 | Pedir reenvio de documento | 4 | 🤖→✋→⚙️→⏳ | Sim |
| 4 | Cadastrar titular no e-INPI | 5 | 👤 | Não |
| 5 | Gerar GRUs no e-INPI | 5 | 👤 | Não |
| 6 | Gerar guia de dados para depósito | 8 | 🤖→✋ | Sim |
| 7 | Salvar comprovantes no Drive | 8 | ⚙️ | Não |

## Steps a RENOMEAR

| Atual | Novo nome |
|----|----|
| 3.4 Emitir CNPJ | Emitir certidão CNPJ e QSA |
| 5.1 Gera guia de ajuda | Gerar guia de dados para e-INPI (cadastro) |
| 4.6 Gerar documento dos clientes | **Remover** ou "Revisar documentos selecionados" (gate) |

## Perguntas pendentes

| # | Pergunta | Impacto |
|----|----|----|
| 1 | 3.3 "Cobrar pagamento" — é cobrança do contrato (à Genesis) ou da GRU? Se da GRU, está no stage errado. | Pode mover pro Stage 6 |
| 2 | 3.4 "Emitir certidão CNPJ e QSA" — faz sentido no Stage 3 ou deveria ir pro Stage 5? | Pode mover |
| 3 | 4.6 "Gerar documento dos clientes" — remove completamente ou troca pra gate de revisão? | Remove ou renomeia |
| 4 | Follow-ups de assinatura (Stage 3) — precisam de HITL ou podem ser automáticos? | Adiciona ou não HITL |


