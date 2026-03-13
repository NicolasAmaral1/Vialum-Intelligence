# Epic 1: genesis-laudo — Dashboard HITL para laudo-viabilidade

## Status: InProgress

## Descrição

Criar um serviço web standalone (`genesis-laudo`) que expõe o squad `laudo-viabilidade`
como um dashboard visual com HITL integrado.

O squad hoje roda 100% via CLI (`@laudo *nova-analise`). O dashboard não substitui o CLI —
ele orquestra o Claude Code CLI como worker, capturando aprovações humanas nos 2 checkpoints
obrigatórios do fluxo de análise marcária.

**Visão de longo prazo:** a plataforma genesis-laudo será a base do sistema de controle de
tarefas HITL para toda a empresa Vialum — outros squads poderão ser integrados futuramente.

## Decisões arquiteturais (aprovadas)

| Decisão | Escolha |
|---------|---------|
| LLM execution | `claude` CLI via child_process (aiOS na VPS) |
| Backend | Node.js 20 + Express + EJS |
| Banco de dados | PostgreSQL 16 dedicado (novo, isolado) |
| Schema | Idempotente desde o início |
| Deploy | VPS vps-nova + Docker + Traefik |
| URL | api.luminai.ia.br/laudo/ |

## Stories

| # | Story | Status | Executor |
|---|-------|--------|----------|
| 1.1 | Estrutura base do serviço | Done | @dev |
| 1.2 | PostgreSQL + schema idempotente | Done | @data-engineer |
| 1.3 | ClickUp service + dashboard com fila real | Draft | @dev |
| 1.4 | Claude CLI integration + logging | Draft | @dev |
| 1.5 | HITL checkpoints UI | Draft | @dev |
| 1.6 | Geração PDF/DOCX + SSE + Drive + ClickUp | Draft | @dev |
| 1.7 | Deploy VPS | Draft | @devops |

## Acceptance Criteria do Epic

1. Dashboard exibe fila ClickUp ("para fazer") em tempo real
2. Usuário pode iniciar análise a partir de um card ClickUp
3. CHECKPOINT 1 bloqueante: PARTE 1 exibida, aprovação necessária para avançar
4. CHECKPOINT 2 bloqueante: PARTE 2 exibida após paste INPI, aprovação necessária
5. PDF e DOCX gerados, enviados ao Drive, ClickUp atualizado para "feito"
6. Todas as operações registradas em PostgreSQL (analyses + events + cli_executions)
7. Serviço acessível em api.luminai.ia.br/laudo/ com TLS via Traefik

## Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-02-28 | 0.1 | Epic criado (retroativo — código das stories 1.1 e 1.2 já existe) | @dev |
