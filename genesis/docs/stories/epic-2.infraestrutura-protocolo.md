# Epic 2: Infraestrutura do Protocolo Completo

## Status: InProgress

## Objetivo
Construir a infraestrutura base para o fluxo automatizado de registro de marcas,
incluindo object storage (MinIO), servicos de media, classificacao, e evolucoes no CRM Hub.

## PRD de referencia
- `prds-projeto/PRD-MEDIA-SERVICE.md`
- `prds-projeto/PRD-CRM-HUB-EVOLUCOES.md`
- `prds-projeto/PRD-CRM-HUB-WRITE-OPS-AGNOSTICO.md`
- `prds-projeto/PRD-VIALUM-SWITCH.md`
- `prds-projeto/PRD-PORTAL-ENGINE.md`
- `prds-projeto/PRD-SQUADS-PROTOCOLO.md`
- `prds-projeto/PLANO-IMPLEMENTACAO-PROTOCOLO.md`
- `prds-projeto/PLANO-SWITCH-REFACTOR.md`

## Stories

| # | Story | Status | Responsavel |
|---|-------|--------|-------------|
| 2.1 | MinIO Object Storage — Deploy na VPS | Done | @devops |
| 2.2 | CRM Hub — Organizacoes + ID Universal | Done | @dev |
| 2.3 | CRM Hub — ClickUp Write Operations (agnostico) | Done | @dev |
| 2.4 | Media Service — Projeto base + deploy | Done | @dev |
| 2.5 | Vialum Switch — Projeto base + refactor agnostico + PDF | Done | @dev |
| 2.5.1 | Vialum Chat — Media persist + textContent | Done | @dev |
| 2.5.2 | Vialum Chat — RBAC por Inbox | Done | @dev |
| 2.5.3 | Vialum Chat — Provider Abstraction Cleanup | Done | @dev |
| 2.5.4 | Vialum Chat — Hierarquia de Nomes de Contato | Done | @dev |
| 2.6.0 | Foundation — Infrastructure Hardening | Done | @dev |
| 2.6.1 | Vialum Hub — Identity Foundation | Done | @dev |
| 2.6.2 | Vialum Chat — Context API + Active Channels | Done | @dev |
| 2.6.3 | Vialum Hub — Proactive Sync + External ID Aliases | Done | @dev |
| 2.6.4 | Rename CRM Hub → Vialum Hub | Done | @dev |
| 2.7 | Portal Engine — Projeto base | Draft | @dev |
| 2.8 | Squads — Scripts compartilhados + @qualificacao | Draft | @dev |
| 2.9 | Squads — @contrato + @verificador + @documentos | Draft | @dev |
| 2.10 | Squad — @protocolo (supersquad) | Draft | @dev |
