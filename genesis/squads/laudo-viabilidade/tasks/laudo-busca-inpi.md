# Task: Laudo — Busca Automatica INPI (FASE 2.5)

> **Comando:** `*busca-inpi` (ou Fase 2.5 do `*nova-analise`)
> **Agente:** @laudo (Mira)
> **Fase:** 2.5 — Busca Automatica de Anterioridades

---

## Purpose

Automatizar a busca de anterioridades no INPI. Executa busca fuzzy POR CLASSE via
Playwright (uma classe por vez, devagar), coleta fichas completas de TODAS as marcas
encontradas (sem filtro — 100% do que o INPI retorna), e consolida em `inpi-raw.txt`.

Principio: NUNCA descartar informacao. Se o INPI retornou, é relevante.

---

## Prerequisites

- PARTE 1 aprovada (Checkpoint 1 concluido)
- `classes_aprovadas` disponiveis na sessao
- `nome_marca`, `cliente`, `pasta` disponiveis na sessao
- Playwright instalado: `pip install playwright && playwright install chromium`

---

## Execution Mode

**Automatico** — executa sem intervencao humana. Reporta resultado ao final.

---

## Implementation Steps

### Passo 1: Executar busca por classe

```bash
cd /Users/nicolasamaral/Vialum-Intelligence && \
python3 genesis/squads/laudo-viabilidade/scripts/busca_inpi_por_classe.py \
  "{nome_marca}" \
  --classes {classes_aprovadas_csv} \
  --pasta "laudos/{cliente}/{nome_marca}/"
```

O script executa para cada classe aprovada:
1. Busca fuzzy (radical) filtrada por classe NCL — 100 resultados/pagina, TODAS as paginas
2. Extrai marcas da tabela de resultados (sem filtrar nenhuma)
3. Busca ficha completa de cada marca por numero de protocolo (sequencial, lotes de 5)
4. Salva backup do texto bruto por classe (`classe-XX-raw.md`)
5. Consolida tudo em `inpi-raw.txt`

Velocidade: ~5s entre cada busca, 15s entre lotes, 10s entre classes.
Tempo estimado: 3-4 classes × 10-30 marcas × 5s = 3-10 minutos.

---

### Passo 2: Verificar resultados

```bash
cat "laudos/{cliente}/{nome_marca}/busca-por-classe-relatorio.json"
```

Verificar:
- Quantas marcas por classe
- Se houve falhas na busca detalhada (campo `falhas` e `falhas_detalhe`)
- Se alguma classe voltou vazia (campo livre)

**Se houve falhas:** Os protocolos que falharam estao listados no relatorio.
Eles existem no `classe-XX-marcas.json` mas NAO no `inpi-raw.txt`.
Considerar buscar manualmente ou rodar novamente.

---

### Passo 3: Informar usuario

```
Busca automatica INPI concluida — {nome_marca}

Resumo por classe:
  Classe {N}: {encontradas} marcas → {detalhadas} fichas coletadas
  Classe {N}: {encontradas} marcas → {detalhadas} fichas coletadas
  Classe {N}: campo livre (0 resultados)

Total: {total_detalhadas} fichas em inpi-raw.txt
Falhas: {n_falhas} protocolos (listados no relatorio)

Arquivos gerados em laudos/{cliente}/{nome_marca}/:
  classe-35-raw.md       Texto bruto paginas (backup)
  classe-35-marcas.json  Marcas extraidas da classe 35
  classe-42-raw.md       Texto bruto paginas (backup)
  classe-42-marcas.json  Marcas extraidas da classe 42
  inpi-raw.txt           Fichas completas consolidadas
  busca-por-classe-relatorio.json  Metadados do pipeline

Prosseguindo para analise de colidencias (PARTE 2)...
```

---

## Fallback Manual

Se o pipeline falhar (INPI fora do ar, CAPTCHA, mudanca de layout):

```
A busca automatica falhou: {motivo}

Fallback manual:
1. Acesse: https://busca.inpi.gov.br/pePI/jsp/marcas/Pesquisa_classe_basica.jsp
2. Para cada classe aprovada:
   → Selecione busca por radical (nao exata)
   → Preencha o nome: "{nome_marca}"
   → Preencha a classe: {classe}
   → 100 resultados por pagina
3. Copie TODOS os resultados (Ctrl+A → Ctrl+C)
4. Para cada marca relevante, abra a ficha completa e copie
5. Cole tudo em: laudos/{cliente}/{nome_marca}/inpi-raw.txt

Quando terminar, confirme: "ok, colei os dados"
```

---

## Veto Conditions

- **Playwright nao instalado:** VETO — instruir instalacao
- **INPI inacessivel apos 3 tentativas com backoff:** Fallback manual
- **Falhas na busca detalhada:** NAO é veto — continuar com o que tem e alertar

---

## Success Output

```
Busca automatica INPI concluida — {nome_marca}
   Classes: {n} | Marcas: {total} | Fichas: {detalhadas} | Falhas: {n_falhas}
Prosseguindo com analise de colidencias (PARTE 2)...
```

---

```yaml
metadata:
  version: 2.0.0
  squad: laudo-viabilidade
  phase: 2.5
  scripts:
    - busca_inpi_por_classe.py
  next_task: laudo-inpi.md
  tags: [busca-inpi, playwright, por-classe, sequencial, sem-filtro]
  updated_at: 2026-03-16
```
