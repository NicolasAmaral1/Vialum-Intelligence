# Plano de Implementação — Squad @registro

> **Data:** 2026-03-27
> **Objetivo:** Squad orquestrador funcionando end-to-end no terminal + ClickUp
> **Modelo:** Squad lê YAML → consulta ClickUp → executa/delega → atualiza ClickUp

---

## Decisões finais aplicadas

| Item | Decisão |
|------|---------|
| Cobrar pagamento | É das GRUs → mover do Stage 3 pro Stage 6 |
| Emitir certidão CNPJ e QSA | Mover do Stage 3 pro Stage 5 |
| Gerar documento dos clientes (4.6) | Remover. Substituir por "Selecionar e revisar documentos" (gate) |
| Gera guia de ajuda (5.1) | Renomear → "Gerar guia de dados para e-INPI" |
| Source of truth | ClickUp (MVP). Vialum Tasks banco no futuro |
| UI | ClickUp (MVP). Vialum Tasks Web no futuro |
| Execução | Terminal: `@registro *processar` |
| HITL | Comentário no ClickUp + tag `aprovar` + assignee |

---

## Estrutura final dos Stages no ClickUp

Após aplicar todas as mudanças:

```
STAGE 1: SOLICITAR DADOS (6 steps)
  1.1 Preencher termos do usuário                         → human (operador)
  1.2 Enviar mensagem de qualificação no WhatsApp         → ai + HITL + system + wait
  1.3 Aguardar e checar respostas                         → ai + wait
  1.4 Pedir dados faltantes                               → ai + HITL + system + wait (NOVO)
  1.5 Adicionar respostas ao ClickUp                      → system
  1.6 Revisar dados consolidados                          → human (gate) (NOVO)

STAGE 2: CONTRATO E PROCURAÇÃO (5 steps) — sem mudanças
  2.1 Montar JSON de dados necessários                    → system
  2.2 Gerar PDFs                                          → system
  2.3 Revisar documentos                                  → human (operador)
  2.4 Upload ClickUp + Drive                              → system
  2.5 Enviar documentos no WhatsApp da pessoa             → ai + HITL + system

STAGE 3: AGUARDANDO ASSINATURA (2 steps) — simplificado
  3.1 Aguarda devolução assinada                          → system + ai + wait
  3.2 Conferência se está correto                         → human (operador, gate)

STAGE 4: DOCUMENTOS DO CLIENTE (6 steps)
  4.1 Solicitar no WhatsApp documentos                    → ai + HITL + system
  4.2 Aguarda envio de documentos                         → system + ai + wait
  4.3 Verificar legibilidade e completude                 → human (operador)
  4.4 Pedir reenvio se necessário                         → ai + HITL + system + wait (NOVO)
  4.5 Verificar se todos foram recebidos                  → system
  4.6 Selecionar e revisar documentos                     → human (gate) (RENOMEADO)

STAGE 5: CADASTRO E GRU (6 steps) — expandido
  5.1 Gerar guia de dados para e-INPI                     → ai + HITL (RENOMEADO)
  5.2 Cadastrar titular no e-INPI                         → human (operador) (NOVO)
  5.3 Emitir certidão CNPJ e QSA                          → human (operador) (MOVIDO do Stage 3)
  5.4 Gerar GRUs no e-INPI                                → human (operador) (NOVO)
  5.5 Anexar GRUs no card                                 → system
  5.6 Enviar GRUs ao cliente via WhatsApp                 → ai + HITL + system

STAGE 6: PAGAMENTO GRUs (4 steps) — expandido
  6.1 Cobrar pagamento das GRUs                           → ai + HITL + system + wait (MOVIDO do Stage 3)
  6.2 Fazer follow-up de pagamento                        → ai + HITL + system + wait
  6.3 Detectar comprovante                                → ai
  6.4 Validar comprovante                                 → human (financeiro, gate)

STAGE 7: PRÉ-PROTOCOLO (6 steps) — sem mudanças
  7.1 Analisar estratégia de depósito                     → human (analista)
  7.2 Montar proposta de depósito                         → human (analista)
  7.3 Enviar proposta no grupo de WhatsApp                → ai + HITL + system
  7.4 Aguardar aceite do cliente                          → system + wait
  7.5 Ajustar estratégia se necessário                    → human (analista)
  7.6 Registrar aceite final                              → system

STAGE 8: PROTOCOLO (6 steps) — expandido
  8.1 Checagem de documentação completa                   → system
  8.2 Gerar guia de dados para depósito                   → ai + HITL (NOVO)
  8.3 Realizar protocolo                                  → human (operador)
  8.4 Registrar IDs dos processos                         → human + system
  8.5 Salvar comprovantes no Drive                        → system (NOVO)
  8.6 Enviar comprovantes no WhatsApp                     → ai + HITL + system

STAGE 9: COMPLETO — status final
```

**Totais:** 8 stages, 47 steps, 12 com HITL

---

## Plano de execução

### FASE 0: Preparação (1-2h)

```
[ ] 0.1 Atualizar card TESTE no ClickUp via API
      - Renomear steps
      - Adicionar steps faltantes
      - Mover steps entre stages
      - Remover steps obsoletos
      - Resultado: card TESTE com estrutura final completa

[ ] 0.2 Salvar card TESTE como template no ClickUp
      - Assim todo novo card nasce com a estrutura pronta
```

### FASE 1: Infraestrutura do Squad (1 dia)

```
[ ] 1.1 Criar diretório squads/registro/
      squads/registro/
      ├── squad.yaml
      ├── agents/registro.md
      ├── workflows/protocolo-registro.yaml
      ├── tasks/
      │   ├── registro-processar.md
      │   ├── registro-status.md
      │   └── registro-iniciar.md
      └── scripts/
          └── clickup-tree.js

[ ] 1.2 Criar squad.yaml
      - Manifest com metadata, integrations (ClickUp), components

[ ] 1.3 Criar agents/registro.md
      - Persona, commands (*processar, *status, *iniciar)
      - State fields

[ ] 1.4 Criar workflows/protocolo-registro.yaml
      - Definição completa de todos os stages/steps
      - Cada step com: executor, approval, wait_for, assignee, runtime

[ ] 1.5 Criar scripts/clickup-tree.js
      - Lê árvore completa do ClickUp (1 chamada API)
      - Retorna estrutura hierárquica: stages → steps com status
      - Usado pela task *processar
```

### FASE 2: Task *processar — Engine Loop (2-3 dias)

```
[ ] 2.1 Criar tasks/registro-processar.md
      - Lógica principal do orquestrador
      - Lê ClickUp → compara com YAML → decide próximo passo

[ ] 2.2 Implementar lógica de identificação de próximo step
      Para cada card ativo:
        - Ler status do card (= stage atual)
        - Ler sub-subtasks (= steps) e seus status
        - Identificar o primeiro step "pendente" cujas dependências estão "done"

[ ] 2.3 Implementar despacho por tipo de executor
      - executor: ai → squad prepara (ele mesmo faz)
      - executor: human → garante assignee no ClickUp, pula
      - executor: system → chama API (Hub, Chat, etc)
      - wait_for: client → verifica se houve resposta, gerencia follow-up

[ ] 2.4 Implementar HITL
      - Se step tem approval: required:
        1. Squad prepara o conteúdo (mensagem, guia, etc)
        2. Posta como comentário no card ClickUp
        3. Muda sub-subtask pra status "aprovar"
        4. Adiciona tag "aprovar"
        5. Seta assignee da sub-subtask
        6. PARA (não faz mais nada nesse step)
      - Próxima execução de *processar:
        1. Verifica se sub-subtask saiu de "aprovar" pra "aprovado"
        2. Se sim, executa ação (enviar msg, etc)
        3. Se não, pula (ainda esperando humano)

[ ] 2.5 Implementar avanço de stage
      - Se todos os steps de um stage estão "done"
      - E o step gate está "done"
      - Move card pro próximo status no ClickUp
      - Cria comentário: "✅ Stage X completo → avançando pra Stage Y"
```

### FASE 3: Stage 1 funcionando (2-3 dias)

```
[ ] 3.1 Implementar Step 1.2: Enviar msg qualificação
      - Squad lê dados do card (nome, marca, deal)
      - Gera mensagem de qualificação personalizada
      - Posta no ClickUp como comentário (HITL)
      - Após aprovação: envia via Vialum Chat API

[ ] 3.2 Implementar Step 1.3: Aguardar e checar respostas
      - Verifica se há mensagens novas na conversa (via Vialum Chat API)
      - Se sim: extrai dados (nome, CPF, endereço, etc)
      - Se faltam dados: dispara Step 1.4

[ ] 3.3 Implementar Step 1.4: Pedir dados faltantes
      - Gera mensagem pedindo o que falta
      - HITL → aprovação → envio → aguarda resposta
      - Loop até completo

[ ] 3.4 Implementar Step 1.5: Adicionar respostas ao ClickUp
      - Atualiza descrição do card com dados extraídos
      - Seta custom fields (tipo_pessoa, classes, etc)

[ ] 3.5 Teste E2E Stage 1
      - Rodar *processar no card TESTE
      - Verificar: msg preparada → aprovada → enviada → resposta interpretada → ClickUp atualizado
```

### FASE 4: Stage 2 funcionando (1-2 dias)

```
[ ] 4.1 Integrar @protocolo existente
      - Quando card está em "contrato e procuracao"
      - *processar detecta e delega para @protocolo
      - @protocolo gera PDFs, faz upload, prepara msg envio

[ ] 4.2 Implementar HITL de envio de docs
      - Msg com contrato/procuração → HITL → envio WhatsApp

[ ] 4.3 Teste E2E Stage 2
```

### FASE 5: Stage 3 funcionando (0.5-1 dia)

```
[ ] 5.1 Implementar detecção de doc assinado
      - Monitora conversa (via Chat API)
      - Quando media chega: verifica se Classification Hub classificou
      - Se "documento assinado": cria step pra operador verificar

[ ] 5.2 Implementar gate de assinatura
      - Operador marca "Conferência" como done → stage avança

[ ] 5.3 Teste E2E Stage 3
```

### FASE 6: Stage 4 funcionando (1-2 dias)

```
[ ] 6.1 Implementar solicitação de docs
      - IA lista docs necessários (PF vs PJ)
      - HITL → envio WhatsApp

[ ] 6.2 Implementar loop de recebimento
      - Cada doc que chega: classificado pelo Switch
      - Operador verifica legibilidade
      - Se ilegível: msg de reenvio (HITL)
      - Se legível: marca como recebido

[ ] 6.3 Implementar verificação de completude
      - Compara necessários vs recebidos
      - Quando completo: gate

[ ] 6.4 Teste E2E Stage 4
```

### FASE 7: Stage 5 funcionando (1-2 dias)

```
[ ] 7.1 Implementar guia de dados pra e-INPI
      - IA prepara dados mastigados pra copiar/colar
      - HITL: operador aprova antes de usar

[ ] 7.2 Implementar steps manuais
      - Steps 5.2, 5.3, 5.4: humano faz, marca done no ClickUp

[ ] 7.3 Implementar envio de GRUs
      - HITL → envio WhatsApp

[ ] 7.4 Teste E2E Stage 5
```

### FASE 8: Stage 6 funcionando (1 dia)

```
[ ] 8.1 Implementar cobrança + follow-up
      - HITL → envio WhatsApp
      - Follow-up D+1, D+3, D+5

[ ] 8.2 Implementar detecção de comprovante
      - Classification Hub identifica comprovante
      - Operador/financeiro valida

[ ] 8.3 Teste E2E Stage 6
```

### FASE 9: Stage 7 funcionando (1 dia)

```
[ ] 9.1 Implementar envio de proposta
      - Steps 7.1, 7.2: humano faz
      - Step 7.3: IA formata → HITL → envio

[ ] 9.2 Implementar loop de aceite
      - Aguarda cliente → se não aceitou → analista ajusta → reenvia

[ ] 9.3 Teste E2E Stage 7
```

### FASE 10: Stage 8 funcionando (1 dia)

```
[ ] 10.1 Implementar checagem completa
       - System verifica todos pré-requisitos

[ ] 10.2 Implementar guia pra depósito
       - IA prepara dados mastigados com nomes/classes finais
       - HITL: operador aprova

[ ] 10.3 Implementar envio de comprovantes
       - Após protocolar: upload Drive → HITL → envio WhatsApp → card completo

[ ] 10.4 Teste E2E Stage 8
```

### FASE 11: Teste completo (1-2 dias)

```
[ ] 11.1 Teste PF completo
       - Criar card → qualificação → contrato → assinatura → docs → cadastro → pagamento → pré-protocolo → protocolo → completo

[ ] 11.2 Teste PJ completo
       - Mesmo fluxo com dados PJ

[ ] 11.3 Teste de edge cases
       - Cliente não responde (follow-up funciona?)
       - Doc ilegível (reenvio funciona?)
       - Cliente não aceita proposta (loop funciona?)
       - Múltiplas classes/marcas
```

### FASE 12: Cron na VPS (0.5 dia)

```
[ ] 12.1 Configurar cron
       */30 8-18 * * 1-5 cd /path && claude -p "@registro *processar"

[ ] 12.2 Configurar logs
       >> /var/log/registro-processar.log 2>&1

[ ] 12.3 Monitorar 1 semana
```

---

## Resumo de esforço

| Fase | O que | Esforço |
|------|-------|---------|
| 0 | Preparação ClickUp | 1-2h |
| 1 | Infraestrutura squad | 1 dia |
| 2 | Engine loop (*processar) | 2-3 dias |
| 3 | Stage 1 (Qualificação) | 2-3 dias |
| 4 | Stage 2 (Contrato) | 1-2 dias |
| 5 | Stage 3 (Assinatura) | 0.5-1 dia |
| 6 | Stage 4 (Documentos) | 1-2 dias |
| 7 | Stage 5 (Cadastro/GRU) | 1-2 dias |
| 8 | Stage 6 (Pagamento) | 1 dia |
| 9 | Stage 7 (Pré-protocolo) | 1 dia |
| 10 | Stage 8 (Protocolo) | 1 dia |
| 11 | Teste completo | 1-2 dias |
| 12 | Cron VPS | 0.5 dia |
| **Total** | | **~2-3 semanas** |

**Pode ser feito incrementalmente:** cada fase entrega valor. Após Fase 3, você já tem Stage 1 funcionando pra cards reais.

---

## Dependências externas

| O que | Status | Necessário pra |
|-------|--------|----------------|
| Vialum Chat API (enviar msg) | ✅ Funciona | Stage 1+ |
| Vialum Chat API (ler msgs) | ✅ Funciona | Stage 1+ |
| CRM Hub (ClickUp write) | ✅ Funciona | Todos |
| @protocolo squad existente | ✅ Funciona | Stage 2 |
| Classification Hub | ✅ Funciona | Stage 3, 4, 6 |
| Media Service | ✅ Funciona | Stage 3, 4 |
| Google Drive upload | ✅ Funciona | Stage 2, 8 |

**Tudo que precisa já existe.** Só falta o squad.

---

*Próximo passo: Fase 0 — ajustar card TESTE no ClickUp.*
