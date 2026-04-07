# Task: Cotejador — Veredito Individual por Marca (Fase 5)

> **Sub-agente:** @cotejador
> **Modelo:** Opus (o mais crítico do pipeline)
> **Fase:** 5 — Veredito individual
> **Invocado por:** @laudo (Mira)

---

## Purpose

Para cada marca viva que passou na peneira (nível 1 e 2), emitir **cotejo
completo** seguindo os critérios do Manual de Marcas do INPI (seção 5.11),
integrando especificações, precedentes, isonomia e desgaste.

Este é o coração intelectual do pipeline. Cada veredito é um **mini-parecer
jurídico** fundamentado em dados concretos.

---

## Prerequisites

- `specs/specs-completas.json` (fichas com specs expandidas das vivas filtradas)
- `analise/precedentes-analise.json` (padrões de decisão e isonomia)
- `coexistencia/mapa-coexistencia.json` (clusters e desgaste)
- `peneira/peneira-resultado.json` (para saber o nível de cada marca)
- Dados do caso: `nome_marca`, `atividade`, `classes_aprovadas`, `tipo_marca`
- Especificações pretendidas pelo cliente (extraídas da PARTE 1 do PLANO DE ANÁLISE)

---

## Execution Mode

**Processamento em lotes.** Se > 15 marcas: lotes de 10.
Cada lote gera output parcial. Ao final, consolidar em `vereditos-individuais.json`.

Dentro de cada lote, processar marca por marca, sequencialmente.

---

## Cotejo por Marca — 7 Etapas

### Etapa 1: Cotejo de Sinais (Manual de Marcas INPI 5.11)

Comparar o nome da marca candidata com o nome da nossa marca em 3 dimensões:

**1a. Similaridade Fonética**
- Sequência de sílabas: quantas sílabas em comum? Na mesma posição?
- Entonação: tônica na mesma posição?
- Ritmo: mesmo número de sílabas? Mesma cadência ao falar?
- Regra INPI: "marcas são lembradas e mencionadas frequentemente em sua forma verbal" → fonética tem peso ELEVADO

Classificar: **ALTA** / **MÉDIA** / **BAIXA** / **NULA**
+ Justificativa de 1-2 frases citando os pontos de similaridade/diferença

**1b. Similaridade Gráfica**
- Sequência de letras: quantas letras idênticas na mesma posição?
- Número de caracteres: mesmo comprimento?
- Estrutura visual: mesmo "desenho" da palavra?
- Relevante mesmo em nominativas: "repetição de sequências de letras pode gerar confusão"

Classificar: **ALTA** / **MÉDIA** / **BAIXA** / **NULA** + justificativa

**1c. Similaridade Ideológica**
- Campo semântico: ambas evocam a mesma ideia/conceito?
- Significado: se o nome tem significado, é semelhante?
- Tradução: uma é tradução/adaptação da outra?
- Regra INPI: "sinais que evocam ideias idênticas ou semelhantes podem levar à confusão, MESMO COM DIFERENÇAS fonéticas ou gráficas"

Classificar: **ALTA** / **MÉDIA** / **BAIXA** / **NULA** + justificativa

### Etapa 2: Afinidade Mercadológica (8 critérios do Manual INPI)

Comparar a atividade/specs da marca candidata com a atividade do nosso cliente.

| # | Critério | Peso INPI | Pergunta |
|---|----------|-----------|----------|
| 1 | **Natureza** | Alto | Serviços da mesma categoria essencial? |
| 2 | **Finalidade** | Alto | Mesmo propósito? Contratados da mesma forma? |
| 3 | **Complementariedade** | Médio | Um é indispensável ou importante para o outro? |
| 4 | **Concorrência** | Alto | Podem ser substituídos um pelo outro? |
| 5 | **Canais** | Baixo | Mesmos canais de venda? (INPI: "não é definitivo") |
| 6 | **Público-alvo** | Baixo | Mesmo consumidor? (INPI: "não é determinante" isolado) |
| 7 | **Grau de atenção** | Médio | Consumidor compra com atenção alta ou baixa? |
| 8 | **Origem habitual** | Alto | Comum que mesma empresa forneça ambos? |

**Regra:** Só detalhar critérios que AGREGAM à análise. Se um critério é
irrelevante para este par de marcas, omitir em vez de escrever "não se aplica".

Classificar afinidade: **DIRETA** / **INDIRETA** / **SEM AFINIDADE**

### Etapa 3: Especificações vs. Atividade

Comparar a especificação COMPLETA da marca candidata (copiada do JSON, integral,
nunca truncada) com a atividade pretendida do nosso cliente.

- **SOBREPOSIÇÃO DIRETA:** specs descrevem exatamente a mesma atividade
  Ex: spec "serviços de clínica médica; serviços de saúde" vs atividade "serviços médicos"
- **SOBREPOSIÇÃO INDIRETA:** specs são do mesmo universo mas nicho diferente
  Ex: spec "serviços de salões de beleza" vs atividade "serviços médicos"
- **SEM SOBREPOSIÇÃO:** specs de segmento completamente distinto
  Ex: spec "jardinagem paisagística" vs atividade "serviços médicos"

**REGRA CRÍTICA:** A especificação citada DEVE ser COPIADA integralmente do
campo `especificacao_completa` do JSON. NUNCA parafrasear. NUNCA truncar com "...".

### Etapa 4: Isonomia

Buscar no `precedentes-analise.json`:
- Há precedente aplicável a este par (nossa marca vs candidata)?
- Qual a direção? FAVORÁVEL / DESFAVORÁVEL / MISTA / NEUTRA
- Citar o processo e a decisão de referência

Ex: "Processo 910456789 (PLENUS VIDA) foi indeferido por colidência com PLENUS
na mesma classe e specs similares. Por isonomia, PLENNUS SAÚDE (mesma classe,
specs similares) representa risco análogo para Plenya."

### Etapa 5: Desgaste

Buscar no `mapa-coexistencia.json`:
- O radical desta marca está em cluster desgastado?
- Quantos titulares distintos coexistem?
- Parecer de desgaste: FAVORÁVEL / PARCIAL / DESFAVORÁVEL / INCONCLUSIVO

### Etapa 6: Fatores Atenuantes e Agravantes

**Atenuantes (reduzem risco):**
- Elemento em comum desgastado (≥5 titulares no cluster)
- Diferença gráfica significativa (sufixo distinto, comprimento diferente)
- Especificações em nichos distintos dentro da mesma classe
- Nossa marca é fantasiosa → proteção ampla, mas menos confundível
- Precedente de convivência em recurso (2ª instância aceitou)

**Agravantes (aumentam risco):**
- Serviço de saúde → INPI aplica "exame especialmente cauteloso" (Manual 5.11)
- Reprodução com acréscimo (candidata contém nossa marca inteira + algo)
- Marca candidata é notoriamente conhecida no segmento
- Radical com histórico de indeferimento mantido em recurso
- Sobreposição direta de specs em atividade nuclear do cliente
- Decisão recente (2023-2026) no mesmo sentido

### Etapa 7: Veredito

**Regra de equilíbrio (Princípio da Especialidade — Manual INPI 5.11):**
> "Quanto menor a semelhança entre os sinais, maior deverá ser a afinidade
> mercadológica entre os produtos/serviços para caracterizar risco de confusão."

Inversamente proporcional:
- Similaridade ALTA + afinidade BAIXA → pode colidir (sinal domina)
- Similaridade BAIXA + afinidade ALTA → pode colidir (mercado domina)
- Similaridade BAIXA + afinidade BAIXA → sem colidência
- Similaridade ALTA + afinidade ALTA → colidência forte

Integrar com isonomia e desgaste para classificação final:

| Veredito | Quando |
|----------|--------|
| **COLIDÊNCIA PROVÁVEL** | Cotejo alto em ≥2 dimensões + afinidade direta + isonomia desfavorável ou neutra |
| **COLIDÊNCIA POSSÍVEL** | Cotejo médio + afinidade direta, OU cotejo alto + afinidade indireta, OU cotejo alto + afinidade direta + desgaste favorável |
| **COLIDÊNCIA REMOTA** | Cotejo baixo + afinidade indireta, OU similaridade alta + specs sem sobreposição |
| **SEM COLIDÊNCIA** | Cotejo baixo/nulo + sem sobreposição + isonomia favorável ou neutra |

+ **Fundamentação legal:** artigo da LPI aplicável + princípios invocados
+ **Estratégia de defesa:** como argumentar se houver exigência ou oposição

---

## Output — Schema por Marca

```json
{
  "numero_processo": "920123456",
  "nome_marca": "PLENNUS SAÚDE",
  "classe": 44,
  "situacao": "Registro de marca em vigor",
  "titular": "PLENNUS LTDA",
  "especificacao_completa": "serviços de clínica médica; serviços de saúde; assistência médica",
  "nivel_peneira": 1,

  "cotejo": {
    "fonetica": {
      "grau": "ALTA",
      "justificativa": "Radical 'plen-' idêntico (2 sílabas iniciais). Tônica na primeira sílaba em ambas. Diferença apenas no sufixo (-nya vs -nus), que é a parte menos lembrada na forma verbal."
    },
    "grafica": {
      "grau": "MÉDIA",
      "justificativa": "Primeiras 4 letras idênticas (P-L-E-N). Comprimento similar (6 vs 7 caracteres sem o sufixo 'SAÚDE'). Estrutura visual distinta no sufixo."
    },
    "ideologica": {
      "grau": "ALTA",
      "justificativa": "Ambas evocam o conceito de plenitude/completude. 'Plenya' remete a 'plena'. 'Plennus' remete a 'pleno'. Campo semântico idêntico: saúde integral, vida plena."
    }
  },

  "afinidade_mercadologica": {
    "grau": "DIRETA",
    "criterios": {
      "natureza": "Mesma categoria: serviços médicos e de saúde",
      "finalidade": "Mesmo propósito: cuidar da saúde do consumidor. Contratados da mesma forma (consulta, agendamento)",
      "concorrencia": "Plenamente permutáveis: consumidor que busca 'Plenya' pode contratar 'Plennus Saúde' para o mesmo fim",
      "origem_habitual": "Comum que mesma empresa ofereça clínica médica + assistência médica + serviços de saúde"
    }
  },

  "especificacoes_vs_atividade": {
    "spec_candidata": "serviços de clínica médica; serviços de saúde; assistência médica",
    "atividade_cliente": "Serviços médicos, bem-estar, nutrição, saúde, apoio psicológico, esportivo",
    "sobreposicao": "DIRETA",
    "analise": "'Serviços de clínica médica' e 'serviços de saúde' são exatamente a atividade nuclear do cliente. Sobreposição total nos primeiros 2 itens da spec."
  },

  "isonomia": {
    "aplicavel": true,
    "direcao": "DESFAVORÁVEL",
    "referencia": "PLENUS VIDA (910456789) indeferida por colidência com PLENUS (905123456) na classe 44 — radical idêntico (plen-), specs sobrepostas (serviços médicos). Mantida em 2ª instância (08/2023).",
    "aplicacao": "Se PLENUS VIDA foi barrada com radical plen- e specs médicas, PLENNUS SAÚDE (mesmo radical, mesmas specs) representa risco análogo para Plenya."
  },

  "desgaste": {
    "cluster": "plen- classe 44",
    "grau": "PARCIAL",
    "titulares_distintos": 3,
    "nota": "Convivência existe (3 titulares), mas indeferimento mantido no cluster"
  },

  "fatores_atenuantes": [
    "Sufixo distinto: -nya vs -nus (parte menos lembrada)",
    "Desgaste parcial do radical plen- (3 titulares coexistem)",
    "Plenya é fantasiosa (palavra inventada) vs Plennus é evocativa"
  ],
  "fatores_agravantes": [
    "Serviço de saúde — INPI aplica exame especialmente cauteloso",
    "Sobreposição direta de specs em atividade nuclear",
    "Precedente de indeferimento mantido em 2ª instância para radical plen- (2023)",
    "Radical plen- compartilhado + campo semântico idêntico"
  ],

  "veredito": "COLIDÊNCIA PROVÁVEL",
  "risco": "alto",
  "fundamentacao": "Art. 124, XIX LPI — imitação fonética (radical plen- idêntico) e ideológica (campo semântico de plenitude). Afinidade mercadológica direta (serviços de saúde). Precedente de indeferimento mantido em 2ª instância para radical plen- na mesma classe reforça risco por isonomia. Agravado por tratar-se de serviço de saúde (exame cauteloso INPI).",
  "estrategia": "1) Argumentar diferença do sufixo -nya vs -nus e apresentação visual distinta. 2) Invocar desgaste parcial: 3 titulares coexistem com plen- na classe 44. 3) Especificar atividade de Plenya de forma restrita (ex: 'bem-estar, nutrição e apoio psicológico' em vez de 'serviços médicos' genérico) para minimizar sobreposição com specs de PLENNUS. 4) Se houver oposição, fundamentar na Tese da Especialidade: nichos distintos dentro da mesma classe."
}
```

---

## Output Consolidado

Arquivo: `vereditos/vereditos-individuais.json`

```json
{
  "marca_analisada": "Plenya",
  "data_analise": "2026-03-30T16:00:00Z",
  "total_marcas_cotejadas": 35,

  "vereditos": [
    { ... marca 1 ... },
    { ... marca 2 ... }
  ],

  "resumo": {
    "colidencia_provavel": 5,
    "colidencia_possivel": 8,
    "colidencia_remota": 12,
    "sem_colidencia": 10
  }
}
```

---

## Edge Cases

### Especificação da candidata é vazia ou "não disponível"
→ Registrar: `"especificacao_completa": "não disponível no INPI"`
→ Avaliar afinidade pela CLASSE apenas (sem spec, assume afinidade pela classe)
→ Ser conservador: sem spec = risco não eliminável

### Marca sem titular definido
→ Registrar: `"titular": "não identificado"`
→ Não impacta cotejo (cotejo é sobre sinal e specs, não sobre titular)

### Marca com nome muito curto (1-2 caracteres)
→ Cotejo fonético/gráfico pode ser pouco significativo
→ Focar em ideológico e afinidade
→ Registrar: "nome curto — cotejo fonético/gráfico limitado"

### Múltiplas specs (marca com specs em várias classes)
→ Analisar a spec da classe relevante (a mesma do nosso caso)
→ Se marca tem spec em classe diferente da nossa → analisar afinidade inter-classe

### Sem precedente aplicável no precedentes-analise.json
→ `isonomia.aplicavel: false`
→ `isonomia.direcao: "NEUTRA"`
→ Não inventar precedente

### Sem cluster no mapa-coexistencia.json
→ `desgaste.grau: "INCONCLUSIVO"`
→ Marca pode ser muito única (radical incomum)

---

## Proibições

- ❌ NUNCA parafrasear especificações. COPIAR integralmente do JSON.
- ❌ NUNCA inventar número de processo.
- ❌ NUNCA inventar precedente de isonomia.
- ❌ NUNCA truncar specs com "...". Se é longa, copiar INTEIRA.
- ❌ NUNCA omitir fatores agravantes para parecer otimista.
- ❌ NUNCA omitir fatores atenuantes para parecer pessimista.
- ❌ NUNCA classificar como SEM COLIDÊNCIA se há sobreposição direta de specs + cotejo médio/alto.
- ❌ NUNCA pular uma marca. TODAS as nível 1 e 2 devem ser cotejadas.
- ❌ NUNCA usar a palavra "fuzzy" ou "score". Usar: "análise por similaridade".

---

## Success Output

```
Cotejo individual concluído — {marca}

Marcas cotejadas: {n}
  COLIDÊNCIA PROVÁVEL: {n}
  COLIDÊNCIA POSSÍVEL: {n}
  COLIDÊNCIA REMOTA: {n}
  SEM COLIDÊNCIA: {n}
```

---

```yaml
metadata:
  version: 3.0.0
  squad: laudo-viabilidade
  fase: 5
  sub_agente: cotejador
  modelo: opus
  fonte_criterios: "Manual de Marcas INPI, seção 5.11 (3ª edição, 6ª revisão, 20/08/2024)"
  input: [specs-completas.json, precedentes-analise.json, mapa-coexistencia.json, peneira-resultado.json]
  output: vereditos-individuais.json
  tags: [cotejo, veredito, fonetica, grafica, ideologica, afinidade, isonomia, desgaste, especialidade]
```
