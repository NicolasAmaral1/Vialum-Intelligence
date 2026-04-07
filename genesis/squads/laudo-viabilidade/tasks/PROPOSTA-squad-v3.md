# PROPOSTA: Squad Laudo v3 — Pipeline Inteligente de Viabilidade Marcária

> **Status:** Proposição — aguardando aprovação
> **Data:** 30/03/2026
> **Substitui:** Pipeline atual (busca bruta → narrativa direta)

---

## Princípio Arquitetural

O pipeline é dividido em **camadas com responsabilidades claras**:

- **Camadas de coleta** (Playwright, sem IA): raspam dados do INPI, salvam em disco
- **Camadas de inteligência** (IA): analisam, classificam, emitem pareceres
- **Camada de redação** (IA): transforma inteligência em documento jurídico

Cada camada produz um artefato em disco que alimenta a próxima. Se qualquer camada falhar, pode ser reexecutada sem perder o trabalho anterior.

---

## Visão Geral do Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│  FASE 0 — PRELIMINAR (já existe)                            │
│  Monitorar → Coletar → Análise Intrínseca (PARTE 1) → CP1  │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  FASE 1 — COLETA GERAL + SEPARAÇÃO (Playwright, sem IA)     │
│  Busca fuzzy por classe (4 browsers) → página a página      │
│  Corte: % similaridade < 30% ou 10 páginas                  │
│  Separação mecânica: Bucket A (vivas) / B (indeferidas) /   │
│  C (mortas) + fonte-bruta.json (master)                     │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  FASE 2 — PENEIRA (IA)                                      │
│  Bucket A: "traria problemas de colidência?" → sim/não      │
│  Bucket B+C: "precedente relevante?" → sim/não              │
└──────────┬──────────────────────────────────┬───────────────┘
           ▼                                  ▼
┌────────────────────────┐    ┌──────────────────────────────┐
│  FASE 3A — SPECS       │    │  FASE 3B — PRECEDENTES       │
│  (Playwright paralelo) │    │  (Playwright + IA paralelo)  │
│                        │    │                              │
│  Só as vivas que       │    │  Indeferidas + mortas da     │
│  passaram na peneira   │    │  peneira: fichas completas   │
│  → abrir ficha         │    │  + despachos.                │
│  → expandir specs      │    │  IA extrai: motivo, quem     │
│  → salvar completo     │    │  bloqueou, recurso, resultado│
│                        │    │  Disparar workers para       │
│  Output:               │    │  buscar BLOQUEADORES com     │
│  specs-completas.json  │    │  rastreabilidade + specs.    │
│                        │    │  Cadeia até 2 níveis.        │
│                        │    │                              │
│                        │    │  Output:                     │
│                        │    │  precedentes-cadeia.json     │
│                        │    │  bloqueadores-fichas.json    │
└──────────┬─────────────┘    └──────────────┬───────────────┘
           ▼                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  FASE 3C — MAPA DE COEXISTÊNCIA E DESGASTE (IA)            │
│  Agrupar por radical/elemento comum                         │
│  Contar titulares distintos por cluster                     │
│  Cruzar com indeferimentos: desgastado ou protegido?        │
│  Output: mapa-coexistencia.json                             │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  FASE 4 — ANÁLISE DE DECISÕES (IA)                          │
│                                                             │
│  Ponderar: quando ocorreu, qual a decisão, quem decidiu.    │
│  Princípio da Isonomia: "se aconteceu com outros termos     │
│  parecidos, conosco pode ocorrer também."                   │
│                                                             │
│  Cruzar: padrões de deferimento/indeferimento para termos   │
│  similares na mesma classe.                                 │
│                                                             │
│  Output: precedentes-analise.json                           │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  FASE 5 — VEREDITO INDIVIDUAL (IA)                          │
│                                                             │
│  Para cada marca ativa/em processo que passou na peneira:   │
│  - Cotejo: fonética + gráfica + ideológica                  │
│  - Afinidade mercadológica (8 critérios INPI)               │
│  - Especificações completas vs. atividade do cliente        │
│  - Princípio da Isonomia (baseado na Fase 4)                │
│  - Princípios próprios do INPI (Manual de Marcas 5.11)      │
│  → VEREDITO por marca                                       │
│                                                             │
│  Output: vereditos-individuais.json                         │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  FASE 6 — RELATÓRIO TÉCNICO (IA)                            │
│                                                             │
│  Consolida tudo num documento de trabalho:                  │
│  - Panorama de densidade por classe                         │
│  - Cotejo individual com parecer (marca a marca)            │
│  - Precedentes de indeferimento com cadeia de causalidade   │
│  - Veredito por classe + veredito global                    │
│                                                             │
│  Output: {marca} - RELATÓRIO TÉCNICO DE COTEJO.md           │
│  → CHECKPOINT 1.5 (revisão humana)                          │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  FASE 7 — REDATOR (IA — Mira)                              │
│                                                             │
│  Narrativa jurídica (PARTE 2) baseada no relatório técnico. │
│  Tom de advogado sênior. Parágrafos contínuos.              │
│  → CHECKPOINT 2 (revisão humana)                            │
│  → Gerar PDF + DOCX + Drive + ClickUp                      │
└─────────────────────────────────────────────────────────────┘
```

---

## FASE 1 — COLETA GERAL + SEPARAÇÃO POR STATUS

### Objetivo
Raspar do INPI todos os processos retornados pela busca por similaridade, classe por classe, página por página, até esgotar. Ao final, separar mecanicamente por situação processual. **Sem IA, sem filtro subjetivo, sem julgamento.**

### Execução — Etapa 1.1: Coleta

```
Para cada classe aprovada (ex: 44, 41, 42, 35):
  1. Abrir Pesquisa Avançada → similaridade → preencher nome + classe
  2. Página 1: capturar TODOS os processos (número + nome + situação + titular + % similaridade)
  3. Se há página 2: navegar, capturar tudo
  4. ... continuar até:
     - A menor % de similaridade da página cair abaixo de 30%, OU
     - Atingir 10 páginas (cap de segurança = 1000 resultados por classe)
  5. Salvar classe-{N}-lista.json

Depois, busca geral (sem classe): mesmo processo.

Deduplicar por número de processo.
```

### Paralelismo

**4 browsers simultâneos** — 1 por classe. Cada browser faz login independente, navega suas páginas, salva seu JSON. Não compartilham sessão.

Se houver mais de 4 classes, as excedentes aguardam um browser ficar livre.

A busca geral roda depois (precisa das listas por classe para deduplicar).

### Execução — Etapa 1.2: Separação por Status (mecânica, imediata)

Logo que a coleta termina, o script classifica cada marca pelo campo `situacao` em 3 buckets:

**BUCKET A — VIVAS (potenciais ameaças → Peneira → Fase 3A specs)**
```
- "Registro de marca em vigor"
- "Pedido de registro de marca"
- "Deferido" / "Deferida"
- "Publicado" / "Publicada"
- "Sobrestamento" / "Sobrestado"
- "Aguardando exame de mérito"
- "Recurso aguardando julgamento" (titular recorreu de oposição, marca pode viver)
```

**BUCKET B — INDEFERIDAS/EM RECURSO (precedentes → Peneira → Fase 3B despachos)**
```
- "Indeferido" / "Indeferida" (qualquer variação)
- "Recurso contra indeferimento" (marca morta, titular tentando reviver)
- "Nulidade" (em processo de anulação)
```

**BUCKET C — MORTAS (precedentes históricos → Peneira → Fase 3B despachos)**
```
- "Extinta" / "Extinção"
- "Arquivado" / "Arquivada"
- "Anulada"
```

**IMPORTANTE:** Bucket C **NÃO é lixo**. Marcas mortas contêm inteligência crítica:
- Uma extinta que foi indeferida antes de morrer → quem a bloqueou?
- Uma arquivada por falta de pagamento que tinha colidência → padrão de mercado
- O histórico de indeferimentos numa classe revela se o INPI trata o radical como desgastado ou não

Bucket B e C seguem para a mesma análise de precedentes (Fase 3B). A diferença é de prioridade: B primeiro (mais relevantes), C depois (contexto histórico).

A classificação é por **string matching** no campo situação — sem ambiguidade, sem IA.

### Output

```
coleta/
├── classe-44-lista.json         # lista bruta por classe
├── classe-41-lista.json
├── classe-42-lista.json
├── classe-35-lista.json
├── geral-lista.json             # marcas novas não vistas nas buscas por classe
├── coleta-consolidada.json      # todas deduplicadas + metadados
├── bucket-a-vivas.json          # só ativas/em processo → input da Peneira (Fase 2)
├── bucket-b-indeferidas.json    # só indeferidas/em recurso → input da Fase 3B
├── bucket-c-mortas.json         # extintas/arquivadas → precedentes históricos
└── fonte-bruta.json             # MASTER: todas as marcas indexadas por nº processo
```

`fonte-bruta.json` — fonte da verdade, indexada por número de processo:
```json
{
  "940215020": {
    "nome_marca": "PLENYA SAÚDE",
    "classe": 44,
    "situacao": "Registro de marca em vigor",
    "titular": "PLENYA LTDA",
    "similaridade_pct": 85,
    "bucket": "A",
    "fonte": "classe-44-pagina-1",
    "coletado_em": "2026-03-30T11:22:33"
  },
  "936580372": {
    "nome_marca": "PLENNUS",
    "classe": 44,
    "situacao": "Indeferido",
    "titular": "FULANO ME",
    "similaridade_pct": 72,
    "bucket": "B",
    "fonte": "classe-44-pagina-1",
    "coletado_em": "2026-03-30T11:22:33"
  }
}
```

Conforme as fases seguintes coletam mais dados (specs, despachos, bloqueadores), o `fonte-bruta.json` vai sendo **enriquecido** — novos campos são adicionados ao objeto de cada processo, nunca sobrescritos. Assim, no final do pipeline, esse arquivo tem TUDO.

### O que NÃO faz nesta fase
- Não abre ficha individual
- Não busca especificações
- Não faz julgamento subjetivo
- Não descarta nenhuma marca — apenas classifica por status

### Tempo estimado
~30s por classe (formulário + páginas) × 4 classes paralelas = **~40s total** + busca geral ~20s + separação instantânea = **~1 minuto**.

---

## FASE 2 — PENEIRA (IA)

### Objetivo
Recebe os 3 buckets da Fase 1 e decide quais marcas merecem aprofundamento em cada trilha.

**Input:**
- `bucket-a-vivas.json` (marcas ativas/em processo)
- `bucket-b-indeferidas.json` (marcas indeferidas/em recurso)
- `bucket-c-mortas.json` (extintas/arquivadas — precedentes históricos)
- Dados do caso: `nome_marca`, `atividade`, `classes_aprovadas`

### Passo 1: Peneira das vivas — Bucket A (IA)

Para cada marca do Bucket A, a IA responde UMA pergunta:

> **"Se essa marca — '{nome_marca}' na classe {classe} — tivesse exatamente
> a mesma atividade e especificações que o nosso cliente pretende ({atividade}),
> traria problemas de colidência?"**

A IA avalia com base em:
- Similaridade fonética do nome (impressão geral, sem score numérico)
- Similaridade gráfica
- Similaridade ideológica (campo semântico)
- Classe em comum ou adjacente

Resposta: **SIM** (segue para Fase 3A) ou **NÃO** (descartada) + justificativa de 1 frase.

### Passo 2: Peneira das indeferidas + mortas — Bucket B + C (IA)

Para cada marca do Bucket B e C, a IA avalia:

> **"Essa marca — '{nome_marca}' na classe {classe}, com situação '{situacao}' —
> pode ser relevante como precedente para entender como o INPI trata termos
> similares a '{nossa_marca}' nesta classe?"**

Critérios:
- Nome tem similaridade fonética/gráfica/ideológica com a nossa marca?
- Está na mesma classe ou classe adjacente?
- O histórico dessa marca pode revelar um padrão do INPI? (indeferimento recorrente, aceitação de convivência, etc.)

Resposta: **SIM** (segue para Fase 3B) ou **NÃO** (descartada) + justificativa.

**Nota:** A peneira é mais permissiva com B+C do que com A. Para vivas precisamos saber se é ameaça concreta. Para mortas/indeferidas, qualquer indício de padrão do INPI é valioso.

### Output

```
peneira/
└── peneira-resultado.json
    {
      "vivas_para_specs": [...],                # números → Fase 3A
      "precedentes_para_analise": [...],        # números (B+C) → Fase 3B
      "descartadas_peneira_vivas": [...],       # vivas sem risco
      "descartadas_peneira_precedentes": [...], # B+C irrelevantes
      "estatisticas": {
        "bucket_a_total": 89,
        "bucket_b_total": 22,
        "bucket_c_total": 50,
        "passaram_peneira_vivas": 35,
        "passaram_peneira_precedentes": 28
      }
    }
```

### Atualização do fonte-bruta.json
Cada marca recebe campo `peneira`:
```json
{
  "940215020": {
    "...campos existentes...",
    "peneira": {
      "resultado": "SIM",
      "justificativa": "similaridade fonética alta — Plenya vs Plenya Saúde",
      "destino": "fase-3a-specs"
    }
  }
}
```

### Tempo estimado
~3-4 minutos (IA analisa ~160 marcas dos 3 buckets com dados básicos).

---

## FASE 3A — COLETA DE ESPECIFICAÇÕES (Playwright paralelo)

### Objetivo
Para as marcas que passaram na peneira (ativas com risco), buscar ficha completa com **especificações expandidas**.

### Execução

```
Input: peneira-resultado.json → ativas_para_specs (ex: 35 protocolos)

Para cada protocolo:
  1. Busca por número de processo
  2. Abre ficha de detalhe
  3. Expande divs ocultos de especificação (JS: style.display = 'block')
  4. Extrai texto completo: nome, situação, titular, especificação COMPLETA, despachos
  5. Salva no JSON
```

### Paralelismo
**6-8 workers** (browsers independentes). Com ~35 marcas e 6s cada = **~35s**.

### Output

```
specs/
└── specs-completas.json
    [
      {
        "numero_processo": "920123456",
        "nome_marca": "PLENNUS SAÚDE",
        "classe": 44,
        "situacao": "Registro de marca em vigor",
        "titular": "PLENNUS LTDA",
        "especificacao_completa": "serviços de clínica médica; serviços de saúde; ...",
        "despachos": [...],
        "rastreabilidade": "peneira: SIM — similaridade fonética alta com Plenya"
      },
      ...
    ]
```

### O que NÃO faz
- Nenhum juízo de valor
- Não analisa, não classifica, não opina
- Só coleta e salva

---

## FASE 3B — INTELIGÊNCIA DE PRECEDENTES (Playwright + IA, paralelo)

### Objetivo
Para as marcas indeferidas E mortas que passaram na peneira, entender:
1. **O que aconteceu** com cada uma (motivo, decisão)
2. **Quem bloqueou** (qual marca causou o indeferimento)
3. **As specs de ambas** (indeferida + bloqueadora)
4. **Se foi mantido ou reformado** em recurso
5. **Padrão de coexistência** — marcas similares vivas de titulares diferentes

### Sub-etapa 3B.1: Coleta de fichas (Playwright, paralelo)

```
Input: peneira-resultado.json → precedentes_para_analise (ex: 28 protocolos — B + C)

Workers paralelos (6-8 browsers):
Para cada protocolo:
  1. Buscar ficha completa (despachos, especificações expandidas, titular, tudo)
  2. Salvar ficha inteira no fonte-bruta.json (enriquecimento)
  3. Salvar ficha estruturada em precedentes-fichas.json
```

### Sub-etapa 3B.2: IA lê despachos e extrai cadeia de bloqueio

Para cada ficha coletada, a IA lê os despachos cronológicos e extrai:

```json
{
  "processo": "910456789",
  "nome_marca": "PLENUS VIDA",
  "classe": 44,
  "situacao": "Indeferido",
  "titular": "FULANO LTDA",
  "especificacao_completa": "serviços de clínica médica; serviços de saúde",

  "historico_decisoes": [
    {
      "data": "2022-03-10",
      "despacho": "Exigência formulada (art. 124, XIX)",
      "instancia": "examinador"
    },
    {
      "data": "2022-09-15",
      "despacho": "Indeferimento do pedido",
      "instancia": "examinador",
      "fundamento": "art. 124, XIX — imitação de marca anterior",
      "processo_bloqueador": "905123456",
      "nome_bloqueador": "PLENUS"
    },
    {
      "data": "2023-02-20",
      "despacho": "Recurso interposto",
      "instancia": "titular"
    },
    {
      "data": "2023-08-15",
      "despacho": "Recurso negado — indeferimento mantido",
      "instancia": "2ª instância"
    }
  ],

  "resultado_final": "indeferido_mantido",
  "bloqueador": {
    "processo": "905123456",
    "nome": "PLENUS",
    "a_buscar": true
  },

  "rastreabilidade": "Bucket B — peneira: similaridade fonética com Plenya"
}
```

**Classificação do resultado final:**

| Resultado | Significado | Valor como precedente |
|-----------|------------|----------------------|
| `indeferido_mantido` | INPI indeferiu, recurso negado ou não houve recurso | FORTE — INPI confirmou que há colidência |
| `indeferido_reformado` | INPI indeferiu, mas recurso reverteu a decisão | FORTE (inverso) — INPI aceitou convivência em 2ª instância |
| `indeferido_pendente` | Recurso em andamento | Fraco — resultado incerto |
| `extinto_apos_indeferimento` | Foi indeferido e depois extinto (abandonou) | Moderado — indica que o mercado desistiu |
| `extinto_sem_indeferimento` | Marca viveu e morreu naturalmente (caducidade, não-renovação) | Fraco para colidência, útil para densidade |
| `arquivado_por_desistencia` | Titular desistiu do pedido | Fraco — pode não ter relação com colidência |

### Sub-etapa 3B.3: Buscar bloqueadores (Playwright, COM rastreabilidade)

Os processos bloqueadores identificados na 3B.2 são buscados para entender seu status atual E suas especificações.

```
Input: lista de processos bloqueadores (extraídos dos despachos)

Workers paralelos:
Para cada bloqueador:
  1. Buscar ficha completa (nome, classe, situação, titular, ESPECIFICAÇÃO COMPLETA, despachos)
  2. Salvar com RASTREABILIDADE — POR QUE essa busca foi feita:

  {
    "processo": "905123456",
    "nome_marca": "PLENUS",
    "classe": 44,
    "situacao": "Registro de marca em vigor",
    "titular": "PLENUS SAUDE LTDA",
    "especificacao_completa": "serviços de clínica médica; assistência médica; serviços de saúde",

    "rastreabilidade": {
      "buscado_porque": "bloqueou processo 910456789 (PLENUS VIDA) na classe 44",
      "relevancia_para_caso": "se PLENUS bloqueou PLENUS VIDA (fonética similar), pode bloquear PLENYA também",
      "originado_na_fase": "3B.2"
    }
  }
```

**CADEIA COMPLETA montada:**
```
PLENUS VIDA (indeferida) ──bloqueada por──→ PLENUS (em vigor)
   │                                          │
   │ specs: "clínica médica; saúde"           │ specs: "clínica médica; assistência médica; saúde"
   │ recurso: negado (mantido)                │ titular: PLENUS SAUDE LTDA
   │                                          │
   └──→ IMPACTO PARA PLENYA:
        Se PLENUS bloqueou PLENUS VIDA (plen- → plen-),
        pode bloquear PLENYA (plen- → plen-) na mesma classe
        com especificações sobrepostas.
```

### Sub-etapa 3B.4: Segundo nível da cadeia (opcional, máx 2 níveis)

Se um bloqueador TAMBÉM foi indeferido por outra marca, seguir a cadeia:

```
PLENUS VIDA ──bloqueada por──→ PLENUS ──bloqueada por──→ ???
```

Máximo 2 níveis para não explodir. Registrar no JSON:
```json
{
  "cadeia": [
    {"nivel": 0, "processo": "910456789", "nome": "PLENUS VIDA", "resultado": "indeferido_mantido"},
    {"nivel": 1, "processo": "905123456", "nome": "PLENUS", "resultado": "em_vigor"},
    {"nivel": 2, "processo": "890111222", "nome": "PLENA", "resultado": "em_vigor", "nota": "raiz da cadeia"}
  ]
}
```

### Output

```
precedentes/
├── precedentes-fichas.json      # fichas completas dos B+C com despachos
├── precedentes-cadeia.json      # cadeia: indeferido → bloqueador → status + specs
├── bloqueadores-fichas.json     # fichas dos bloqueadores (com rastreabilidade)
└── fila-busca-bloqueadores.json # lista de processos a buscar (com motivo)
```

Todos os dados coletados **enriquecem o fonte-bruta.json**.

### Tempo estimado
~28 fichas × 6s / 6 workers = ~30s (coleta) + IA ~3min (análise despachos) + ~15 bloqueadores × 6s / 6 workers = ~15s (coleta bloqueadores) = **~4-5 minutos**.

---

## FASE 3C — MAPA DE COEXISTÊNCIA E DESGASTE (IA)

### Objetivo
Analisar as marcas VIVAS com termos similares para determinar se o INPI trata o radical/termo como **desgastado** (coexistência aceita) ou **protegido** (exclusividade mantida).

### Conceito

O Manual de Marcas INPI diz:
> "Quando o elemento em comum entre dois sinais já faz parte de diversas marcas
> registradas de diferentes titulares, fica reduzida a possibilidade de confusão
> ou associação indevida."

Isso é a prova de **desgaste**. Se existem 8 marcas com "PLEN-" na classe 44 de 6 titulares diferentes e todas convivem, o INPI já demonstrou — na prática — que não considera o radical exclusivo.

### Execução

**Input:**
- `bucket-a-vivas.json` (TODAS as vivas, não só as que passaram na peneira)
- `precedentes-cadeia.json` (indeferidos e seus bloqueadores)

**A IA faz:**

1. **Agrupar por radical/elemento comum**
   - Identificar quais marcas compartilham radical, prefixo, sufixo ou campo semântico
   - Ex: "PLEN-" → PLENUS, PLENNUS, PLENYA, PLENA SAÚDE, PLEN VITA

2. **Contar titulares distintos por cluster**
   - Cluster "PLEN-" classe 44: 6 marcas de 4 titulares distintos → evidência de desgaste
   - Cluster "PLEN-" classe 42: 2 marcas de 2 titulares → evidência fraca

3. **Cruzar com indeferimentos**
   - Se no mesmo cluster houve indeferimentos → o INPI NÃO trata como desgastado (barrou)
   - Se no mesmo cluster todas convivem → o INPI trata como desgastado (aceita)
   - Se teve indeferimento MAS foi reformado em recurso → desgaste parcial

4. **Emitir parecer de desgaste por classe**

### Output

```json
{
  "clusters": [
    {
      "radical": "plen-",
      "classe": 44,
      "marcas_vivas": [
        {"processo": "905123456", "nome": "PLENUS", "titular": "A"},
        {"processo": "920111222", "nome": "PLENNUS SAÚDE", "titular": "B"},
        {"processo": "930333444", "nome": "PLENA VIDA", "titular": "C"},
        {"processo": "940555666", "nome": "PLEN VITA", "titular": "D"}
      ],
      "titulares_distintos": 4,
      "marcas_indeferidas_no_cluster": [
        {"processo": "910456789", "nome": "PLENUS VIDA", "resultado": "indeferido_mantido", "bloqueador": "PLENUS"}
      ],
      "desgaste": "PARCIAL",
      "justificativa": "4 titulares distintos coexistem com radical plen- na classe 44, o que sugere desgaste. Porém, PLENUS VIDA foi indeferida por colidência com PLENUS — indicando que o INPI ainda protege o termo quando a similaridade fonética é muito alta. Desgaste do radical, mas não da marca idêntica.",
      "impacto_plenya": "Plenya se diferencia graficamente de PLENUS (sufixo -ya vs -us), mas compartilha radical e campo semântico. O desgaste parcial favorece a tese de convivência, desde que as especificações sejam delimitadas."
    },
    {
      "radical": "plen-",
      "classe": 42,
      "marcas_vivas": [
        {"processo": "915777888", "nome": "PLENA TECH", "titular": "E"},
        {"processo": "925999000", "nome": "PLENSOFT", "titular": "F"}
      ],
      "titulares_distintos": 2,
      "marcas_indeferidas_no_cluster": [],
      "desgaste": "FAVORÁVEL",
      "justificativa": "2 titulares distintos coexistem, nenhum indeferimento no cluster. Campo aberto.",
      "impacto_plenya": "Cenário favorável para registro na classe 42."
    }
  ],

  "resumo_desgaste": {
    "classe_44": "PARCIAL — convivência existe mas com indeferimentos pontuais",
    "classe_41": "FAVORÁVEL — campo livre, sem precedentes negativos",
    "classe_42": "FAVORÁVEL — coexistência aceita",
    "classe_35": "PARCIAL — alta densidade mas em nichos distintos"
  }
}
```

Salvo em:
```
coexistencia/
└── mapa-coexistencia.json
```

### Tempo estimado
~3-4 minutos (IA agrupa, cruza e emite pareceres).

### O que alimenta

O mapa de coexistência é input direto para:
- **Fase 5 (Veredito):** fator atenuante/agravante por marca
- **Fase 6 (Relatório):** seção de desgaste com dados concretos
- **Fase 7 (Redator):** argumento jurídico de convivência fundamentado em precedentes reais

---

## FASE 4 — ANÁLISE DE DECISÕES (IA)

### Objetivo
Entender os padrões de decisão do INPI para termos similares ao da nossa marca. Aplicar o **Princípio da Isonomia**: se aconteceu com os outros, conosco pode ocorrer também.

### Input
- `indeferidos-cadeia.json` (quem foi indeferido, por quem, resultado)
- `bloqueadores-fichas.json` (status atual dos bloqueadores)
- `specs-completas.json` (marcas ativas relevantes)

### Análise

A IA responde, para cada cluster de decisões:

1. **Quando ocorreu?** Data da decisão — decisões recentes pesam mais
2. **Qual foi a decisão?** Indeferimento mantido? Reformado? Por qual fundamento?
3. **Quem decidiu?** 1ª instância (examinador) ou 2ª instância (recurso)?
4. **Padrão identificável?**
   - "Na classe 44, termos com radical 'plen-' foram sistematicamente indeferidos por colidência com PLENUS (processo X)"
   - "Na classe 42, termos com radical 'plen-' convivem — 3 marcas ativas de titulares diferentes"
5. **Isonomia aplicável?**
   - Se PLENUS VIDA foi indeferida por PLENUS → PLENYA pode sofrer o mesmo destino
   - Se PLENUS VIDA foi reformada em recurso → há precedente de que convivência é possível

### Output

```
analise/
└── precedentes-analise.json
    {
      "clusters": [
        {
          "radical": "plen-",
          "classe": 44,
          "marcas_envolvidas": ["PLENUS", "PLENUS VIDA", "PLENNUS SAÚDE"],
          "padrao": "indeferimentos recorrentes por colidência com PLENUS (905123456)",
          "isonomia": "DESFAVORÁVEL — INPI bloqueia sistematicamente termos com radical plen- na classe 44",
          "impacto_plenya": "alto — Plenya compartilha radical e campo semântico",
          "decisoes": [
            {
              "processo": "910456789",
              "marca": "PLENUS VIDA",
              "decisao": "indeferido, mantido em recurso",
              "data": "2023-08-15",
              "bloqueador": "905123456 (PLENUS)",
              "fundamento": "art. 124, XIX"
            }
          ]
        },
        {
          "radical": "plen-",
          "classe": 42,
          "padrao": "convivência aceita — múltiplos titulares",
          "isonomia": "FAVORÁVEL — precedente de que plen- coexiste na classe 42",
          "impacto_plenya": "baixo"
        }
      ],
      "conclusao_isonomia": "Na classe 44, risco elevado por padrão de indeferimento. Na classe 42, cenário favorável."
    }
```

### Tempo estimado
~3-5 minutos (IA analisa padrões cruzados).

---

## FASE 5 — VEREDITO INDIVIDUAL (IA)

### Objetivo
Para cada marca ativa/em processo que passou na peneira, emitir veredito fundamentado considerando:

1. **Cotejo clássico** (fonética + gráfica + ideológica)
2. **Afinidade mercadológica** (8 critérios do Manual INPI seção 5.11)
3. **Especificações completas** (da Fase 3A) vs. atividade do cliente
4. **Princípio da Isonomia** (da Fase 4) — se termos parecidos foram barrados/aceitos
5. **Princípios próprios do INPI** (especialidade, impressão de conjunto, elemento desgastado)

### Framework de Cotejo por Marca

```json
{
  "processo": "920123456",
  "nome": "PLENNUS SAÚDE",
  "classe": 44,

  "cotejo": {
    "fonetica": {"grau": "alta", "justificativa": "..."},
    "grafica": {"grau": "média", "justificativa": "..."},
    "ideologica": {"grau": "alta", "justificativa": "..."}
  },

  "afinidade_mercadologica": {
    "grau": "direta",
    "criterios_relevantes": {
      "natureza": "mesma categoria (serviços médicos)",
      "finalidade": "mesmo propósito",
      "concorrencia": "permutáveis",
      "origem_habitual": "comum que mesma empresa ofereça ambos"
    }
  },

  "especificacoes_vs_atividade": {
    "spec_marca": "serviços de clínica médica; serviços de saúde; assistência médica",
    "atividade_cliente": "serviços médicos, bem-estar, nutrição, saúde, apoio psicológico, esportivo",
    "sobreposicao": "direta — 'serviços de clínica médica' e 'serviços de saúde' são exatamente a atividade pretendida"
  },

  "isonomia": {
    "aplicavel": true,
    "referencia": "PLENUS VIDA (910456789) indeferida por colidência com marca de mesmo radical na classe 44 — mantida em recurso",
    "direcao": "DESFAVORÁVEL para Plenya"
  },

  "fatores_atenuantes": ["diferença gráfica: Plenya vs Plennus (6 letras vs 7, sufixo distinto)"],
  "fatores_agravantes": ["serviço de saúde = exame cauteloso INPI", "radical plen- com histórico de indeferimento"],

  "veredito": "COLIDÊNCIA PROVÁVEL",
  "risco": "alto",
  "fundamentacao": "Art. 124 XIX — imitação fonética e ideológica. Afinidade mercadológica direta. Precedente de indeferimento (isonomia) reforça o risco.",
  "estrategia": "Argumentar diferença gráfica e sufixo. Invocar desgaste do radical se houver múltiplos titulares. Especificar atividade de forma restrita para minimizar sobreposição."
}
```

### Classificação final

| Veredito | Quando |
|----------|--------|
| **COLIDÊNCIA PROVÁVEL** | Cotejo alto em ≥2 dimensões + afinidade direta + isonomia desfavorável |
| **COLIDÊNCIA POSSÍVEL** | Cotejo médio + afinidade direta, OU cotejo alto + afinidade indireta |
| **COLIDÊNCIA REMOTA** | Cotejo baixo + afinidade indireta, OU alta similaridade + specs sem sobreposição |
| **SEM COLIDÊNCIA** | Cotejo baixo + specs sem sobreposição + isonomia favorável ou neutra |

### Output

```
vereditos/
└── vereditos-individuais.json
```

---

## FASE 6 — RELATÓRIO TÉCNICO (IA)

### Objetivo
Consolidar toda a inteligência num documento de trabalho legível, marca a marca, com parecer.

### Estrutura

```markdown
# {MARCA} - RELATÓRIO TÉCNICO DE COTEJO

**Marca:** {marca} | **Atividade:** {atividade} | **Tipo:** {FANTASIOSO/EVOCATIVO}
**Classes:** {lista} | **Data:** {data}
**Total INPI:** {n} | **Após peneira:** {n} | **Com veredito:** {n}

---

## PANORAMA DE DENSIDADE
{Parágrafo analítico}

## PRECEDENTES E ISONOMIA
{Para cada cluster de decisões: o que aconteceu, com quem, quando, impacto}
{Cadeia de causalidade: marca indeferida → marca bloqueadora → rastreabilidade}

## COTEJO INDIVIDUAL

### [1] {MARCA} — Processo {n} — Classe {n} — {VEREDITO}
| Situação | Titular | Especificação completa |
|----------|---------|----------------------|
| {status} | {nome}  | {spec integral}       |

**Fonética:** {grau} — {justificativa}
**Gráfica:** {grau} — {justificativa}
**Ideológica:** {grau} — {justificativa}
**Afinidade:** {grau} — {critérios relevantes}
**Specs vs. atividade:** {sobreposição}
**Isonomia:** {aplicável? direção? referência?}
**Atenuantes:** {lista}
**Agravantes:** {lista}

**PARECER:** {COLIDÊNCIA PROVÁVEL / POSSÍVEL / REMOTA / SEM COLIDÊNCIA}
**Fundamentação:** {base legal + isonomia}
**Estratégia:** {como defender}

---

### [2] {PRÓXIMA MARCA} ...

## MARCAS DESCARTADAS
{Tabela: nome | processo | classe | motivo do descarte}

## VEREDITO POR CLASSE
{Por classe: veredito + fundamentação + riscos + isonomia}

## VEREDITO GLOBAL
**{VEREDITO}** — {parágrafo fundamentado com estratégia mestra}
```

### Checkpoint
**CHECKPOINT 1.5** — o usuário revisa este relatório antes da narrativa jurídica.

---

## FASE 7 — REDATOR (Mira ⚖️)

### Objetivo
Transformar o relatório técnico em narrativa jurídica para o cliente (PARTE 2 do PLANO DE ANÁLISE).

### Input
- Relatório técnico aprovado (Fase 6)
- Vereditos individuais (Fase 5)
- Precedentes e isonomia (Fase 4)

### Regras (mantidas do squad atual)
- Tom de advogado sênior
- Parágrafos contínuos, sem bullets, sem tabelas, sem subcapítulos numerados
- Especificações citadas por extenso
- Nunca mencionar "fuzzy", "algoritmo", "score"
- Usar: "análise por similaridade fonética, gráfica e conceitual"

### Diferença do squad atual
Hoje a Mira escreve a narrativa "olhando" os dados brutos do INPI. No v3, ela escreve **a partir do relatório técnico já fundamentado** — com vereditos, isonomia e estratégia prontos. A qualidade da narrativa sobe porque a inteligência já foi produzida antes.

### Output
- PARTE 2 substituída no PLANO DE ANÁLISE
- **CHECKPOINT 2** → revisão humana → gerar PDF + DOCX

---

## Estrutura de Arquivos por Caso

```
laudos/{cliente}/{marca}/
│
├── fonte-bruta.json                          # MASTER — todas as marcas, enriquecido a cada fase
│
├── {marca} - PLANO DE ANÁLISE.md             # Parte 1 + Parte 2 (documento do cliente)
├── {marca} - RELATÓRIO TÉCNICO DE COTEJO.md  # Documento de trabalho (interno)
│
├── coleta/                                   # Fase 1
│   ├── classe-44-lista.json
│   ├── classe-41-lista.json
│   ├── classe-42-lista.json
│   ├── classe-35-lista.json
│   ├── geral-lista.json
│   ├── coleta-consolidada.json
│   ├── bucket-a-vivas.json
│   ├── bucket-b-indeferidas.json
│   └── bucket-c-mortas.json
│
├── peneira/                                  # Fase 2
│   └── peneira-resultado.json
│
├── specs/                                    # Fase 3A
│   └── specs-completas.json
│
├── precedentes/                              # Fase 3B
│   ├── precedentes-fichas.json
│   ├── precedentes-cadeia.json
│   ├── bloqueadores-fichas.json
│   └── fila-busca-bloqueadores.json
│
├── coexistencia/                             # Fase 3C
│   └── mapa-coexistencia.json
│
├── analise/                                  # Fase 4
│   └── precedentes-analise.json
│
├── vereditos/                                # Fase 5
│   └── vereditos-individuais.json
│
└── output/                                   # Fase 7 + geração
    ├── {marca} - LAUDO DE VIABILIDADE.pdf
    └── {marca} - LAUDO DE VIABILIDADE.docx
```

---

## Scripts Necessários

### Modificar

| Script | Mudança |
|--------|---------|
| `busca_inpi_por_classe.py` | Separar Etapa 1 (coleta de lista) da Etapa 3 (coleta de fichas). Etapa 1 vira paralela (1 browser por classe). Etapa 3 recebe lista filtrada como input. |
| `filtrar_colidencias.py` | Adicionar tier A/B/C. Será usado como pré-filtro rápido antes da peneira IA. |

### Criar

| Script | Responsabilidade |
|--------|-----------------|
| `coletar_lista.py` | Fase 1: busca fuzzy paralela, coleta apenas lista (número + nome + situação). 1 browser por classe. |
| `coletar_specs.py` | Fase 3A: recebe lista de protocolos, abre fichas, expande specs, salva JSON. N workers paralelos. |
| `coletar_indeferidos.py` | Fase 3B: busca fichas de indeferidos, extrai despachos. Workers paralelos com rastreabilidade. |

### Tasks (Mira)

| Task | Fase | Responsabilidade |
|------|------|-----------------|
| `laudo-coleta.md` | 1 | Orquestrar coleta geral |
| `laudo-peneira.md` | 2 | IA classifica: sim/não por marca |
| `laudo-aprofundamento.md` | 3A+3B | Orquestrar coleta de specs + indeferidos |
| `laudo-decisoes.md` | 4 | IA analisa padrões de decisão + isonomia |
| `laudo-veredito.md` | 5 | IA emite veredito por marca |
| `laudo-relatorio.md` | 6 | IA gera relatório técnico |
| `laudo-redator.md` | 7 | Mira escreve narrativa jurídica |

---

## Tempos Estimados

| Fase | Tipo | Tempo estimado |
|------|------|---------------|
| 1 — Coleta geral | Playwright paralelo | ~1 min |
| 2 — Peneira | IA | ~2-3 min |
| 3A — Specs | Playwright paralelo | ~1-2 min (só filtradas) |
| 3B — Indeferidos | Playwright + IA | ~4 min |
| 4 — Decisões | IA | ~3-5 min |
| 5 — Veredito | IA | ~5-8 min |
| 6 — Relatório | IA | ~5 min |
| 7 — Redator | IA | ~5-8 min |
| **TOTAL** | | **~25-35 min** (vs. ~45 min hoje, com resultado muito superior) |

---

## Decisões em Aberto

1. **Quantos workers na Fase 3A?** 6 ou 8? (mais = mais rápido, mas mais agressivo com o INPI)
2. **Peneira (Fase 2) é IA pura ou IA + score numérico?** Proposta: score numérico como pré-filtro, IA só para os que ficam na zona cinzenta (score 10-40).
3. **Fase 3B — profundidade da cadeia:** se o bloqueador também foi indeferido por outro, seguir a cadeia? (sugestão: máximo 2 níveis)
4. **Fase 4 — onde guardar os precedentes?** Só no JSON do caso ou num banco de precedentes compartilhado entre laudos? (sugestão: ambos — JSON local + append num `precedentes-globais.json`)

---

```yaml
metadata:
  status: proposta
  versao: 3.0
  substitui: pipeline-atual (busca-bruta → narrativa)
  fonte_criterios: "Manual de Marcas INPI, seção 5.11 (3ª edição, 6ª revisão, 20/08/2024)"
  fases: 7
  scripts_novos: [coletar_lista.py, coletar_specs.py, coletar_indeferidos.py]
  tasks_novas: [laudo-coleta, laudo-peneira, laudo-aprofundamento, laudo-decisoes, laudo-veredito, laudo-relatorio, laudo-redator]
  tags: [squad-v3, pipeline, coleta, peneira, specs, indeferidos, isonomia, veredito, relatorio, redator]
```
