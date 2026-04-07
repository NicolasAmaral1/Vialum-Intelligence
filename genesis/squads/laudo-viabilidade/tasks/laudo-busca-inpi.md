# Task: Laudo — Busca Automatica INPI (FASE 2.5)

> **Comando:** `*busca-inpi` (ou Fase 2.5 do `*nova-analise`)
> **Agente:** @laudo (Mira)
> **Fase:** 2.5 — Busca Automatica de Anterioridades


---

## Purpose

Automatizar a busca de anterioridades no INPI. Usa a **Pesquisa Avançada** com
**análise por similaridade** (fonética, gráfica e conceitual) — não a busca por
radical da Pesquisa Básica. Executa busca por classe + busca geral (sem classe),
coleta fichas completas com **especificações expandidas** de TODAS as marcas
encontradas, usando **4 browsers paralelos** para performance sem rate limit.

Principio: NUNCA descartar informacao. Se o INPI retornou, é relevante.


---

## Prerequisites

* PARTE 1 aprovada (Checkpoint 1 concluido)
* `classes_aprovadas` disponiveis na sessao
* `nome_marca`, `cliente`, `pasta` disponiveis na sessao
* Playwright instalado: `pip install playwright && playwright install chromium`


---

## Execution Mode

**Automatico** — executa sem intervencao humana. Reporta resultado ao final.


---

## Implementation Steps

### Passo 1: Executar busca por similaridade

```bash
cd /Users/nicolasamaral/Vialum-Intelligence && \
python3 genesis/squads/laudo-viabilidade/scripts/busca_inpi_por_classe.py \
  "{nome_marca}" \
  --classes {classes_aprovadas_csv} \
  --pasta "laudos/{cliente}/{nome_marca}/" \
  --workers 4
```

O script executa automaticamente:

**Etapa 1 — Busca por similaridade (Pesquisa Avançada):**


1. Para cada classe aprovada: acessa `Pesquisa_classe_avancada.jsp`, seleciona
   `precisao=sim` (análise por similaridade), busca pelo nome da marca filtrado
   por classe NCL, 100 resultados por página, todas as páginas
2. Busca geral (sem classe) para capturar anterioridades em classes adjacentes
3. Deduplicação por número de processo entre todas as buscas

**Etapa 2 — Coleta de fichas completas (4 browsers paralelos):**


1. Abre 4 instâncias de Playwright com cookies zerados (contextos independentes)
2. Distribui protocolos round-robin entre os workers
3. Cada worker faz relogin a cada 2 buscas para evitar rate limit
4. Stagger de 5s entre starts dos workers
5. Delay de 6s entre cada busca individual
6. Expande divs ocultos de especificações (`div[id="especificacaoN"]`) via
   `style.display = 'block'` para obter texto completo — o INPI trunca as
   especificações na exibição padrão

**Saídas geradas em** `laudos/{cliente}/{nome_marca}/`:

* `classe-{N}-raw.md` — Texto bruto das páginas de busca (backup)
* `classe-{N}-marcas.json` — Marcas extraídas por classe
* `geral-raw.md` — Texto bruto da busca geral (todas as classes)
* `geral-marcas.json` — Marcas extraídas da busca geral
* `inpi-raw.txt` — Fichas completas consolidadas (com especificações expandidas)
* `busca-por-classe-relatorio.json` — Metadados do pipeline

Velocidade estimada: \~5s busca por classe + \~6s por protocolo detalhado / 4 workers.


---

### Passo 2: Verificar resultados

```bash
cat "laudos/{cliente}/{nome_marca}/busca-por-classe-relatorio.json"
```

Verificar:

* Quantas marcas por classe (campo `por_classe`)
* Resultados da busca geral (campo `busca_geral.novas_unicas`)
* Se houve falhas na busca detalhada (campo `falhas_detalhe`)
* Total de fichas detalhadas (campo `total_detalhadas`)

**Se houve falhas:** Os protocolos que falharam estao listados no relatorio.
Considerar rodar novamente com `--workers 2` (menos agressivo).


---

### Passo 3: Informar usuario

```
Busca automatica INPI concluida — {nome_marca}

Resumo por classe (Pesquisa Avançada — análise por similaridade):
  Classe {N}: {encontradas} marcas
  Classe {N}: {encontradas} marcas
  Classe {N}: campo livre (0 resultados)
  Busca geral: {novas_unicas} marcas adicionais

Total: {total_detalhadas} fichas com especificações completas em inpi-raw.txt
Falhas: {n_falhas} protocolos (listados no relatorio)

Prosseguindo para analise de colidencias (PARTE 2)...
```


---

## Fallback Manual

Se o pipeline falhar (INPI fora do ar, CAPTCHA, mudanca de layout):

```
A busca automatica falhou: {motivo}

Fallback manual:
1. Acesse: https://busca.inpi.gov.br/pePI/jsp/marcas/Pesquisa_classe_avancada.jsp
2. Selecione "Fuzzy" como tipo de pesquisa
3. Para cada classe aprovada:
   → Preencha o nome: "{nome_marca}"
   → Preencha a classe: {classe}
   → 100 resultados por pagina
4. Copie TODOS os resultados
5. Para cada marca, abra a ficha completa e CLIQUE NA ESPECIFICAÇÃO para expandir
6. Cole tudo em: laudos/{cliente}/{nome_marca}/inpi-raw.txt

Quando terminar, confirme: "ok, colei os dados"
```


---

## Veto Conditions

* **Playwright nao instalado:** VETO — instruir instalacao
* **INPI inacessivel apos 3 tentativas com backoff:** Fallback manual
* **Falhas na busca detalhada:** NAO é veto — continuar com o que tem e alertar


---

## Regras para a PARTE 2 (laudo-inpi.md)

A análise gerada na PARTE 2 deve seguir linguagem técnico-jurídica:

* **NUNCA** mencionar "fuzzy", "algoritmo fuzzy", "percentual fuzzy"
* Usar: "análise por similaridade fonética, gráfica e conceitual"
* Usar: "grau de similaridade segundo o INPI" (sem citar percentuais internos)
* Citar especificações COMPLETAS de cada anterioridade (não truncadas)
* Tom de advogado sênior — parecer técnico, não relatório de sistema


---

## Success Output

```
Busca automatica INPI concluida — {nome_marca}
   Classes: {n} | Geral: {novas} novas | Fichas: {detalhadas} | Falhas: {n_falhas}
Prosseguindo com analise de colidencias (PARTE 2)...
```


---

```yaml
metadata:
  version: 3.0.0
  squad: laudo-viabilidade
  phase: 2.5
  scripts:
    - busca_inpi_por_classe.py
  search_method: Pesquisa Avançada (similaridade/fuzzy)
  parallelism: 4 browsers independentes
  spec_expansion: div[id="especificacaoN"] force display
  next_task: laudo-inpi.md
  tags: [busca-inpi, playwright, similaridade, pesquisa-avancada, paralelo, specs-completas]
  updated_at: 2026-03-19
```


