# PROPOSTA: Fase de Triagem e Aprofundamento (Fase 2.7)

> **Status:** Proposição — aguardando aprovação
> **Autor:** Mira ⚖️ + Nicolas
> **Data:** 30/03/2026

---

## Problema

Hoje o workflow pula de **dados brutos do INPI** (Fase 2.5) direto para **narrativa jurídica** (Fase 3). Não existe uma fase intermediária de triagem inteligente. O resultado é que a Mira escreve sobre marcas irrelevantes e não aprofunda onde deveria. Falta:

1. Classificação em 3 tiers (não só binário investigar/baixo_risco)
2. Aprofundamento em indeferidos (mantidos vs reformados em recurso)
3. Análise de especificações uma por uma contra a atividade do cliente
4. Veredito estruturado ANTES de escrever o documento jurídico

---

## Proposta: Nova Fase 2.7 — Triagem e Aprofundamento

Inserida entre a busca INPI (2.5) e a análise de colidências (3):

```
2.5 Busca INPI → [2.7 TRIAGEM E APROFUNDAMENTO] → 3 Narrativa Jurídica
```

### Etapa 1: Classificação em 3 Tiers

Usar `filtrar_colidencias.py` (já existe) com output reformulado em 3 buckets:

| Tier | Nome | Score | Ação |
|------|------|-------|------|
| **A** | **Candidatas** | ≥ 40 | Colidência provável. Análise individual obrigatória. Buscar especificações, indeferidos, recursos. |
| **B** | **Zona de Atenção** | 15–39 | Colidência possível. Analisar especificações para confirmar ou descartar afinidade mercadológica. |
| **C** | **Descartadas** | < 15 | Sem risco relevante. Registrar no relatório para transparência, não analisar individualmente. |

**Mudança no script:** Alterar `filtrar_colidencias.py` para retornar `tier: "A" | "B" | "C"` em vez do binário `investigar | baixo_risco`.

**Output:** `triagem.json` — lista classificada com tier, score, motivos.

---

### Etapa 2: Aprofundamento de Indeferidos

Para marcas Tier A e Tier B com situação "indeferido":

1. **Buscar por número de protocolo** (via `busca_inpi_protocolo.py`, já existe) para obter a ficha completa com despachos
2. **Classificar o indeferimento:**

| Subtipo | Significado | Impacto na análise |
|---------|------------|-------------------|
| **Indeferido (mantido)** | INPI indeferiu E o titular não recorreu ou perdeu recurso | Precedente FAVORÁVEL — o INPI já decidiu que marcas similares não passam nesta classe |
| **Indeferido (reformado em recurso)** | INPI indeferiu MAS o titular ganhou em recurso e obteve registro | Precedente DESFAVORÁVEL — indica que o INPI aceita convivência neste nicho |
| **Indeferido (sem info de recurso)** | Só consta "indeferido" sem desdobramento | Precedente parcialmente favorável — usar com ressalva |

3. **Extrair fundamento do indeferimento:** Se disponível nos despachos, identificar se foi por:
   - Colidência com outra marca específica (art. 124, XIX)
   - Caráter descritivo/genérico (art. 124, VI)
   - Outro motivo

**Novo script necessário:** `aprofundar_indeferidos.py`
- Input: lista de protocolos indeferidos (do triagem.json)
- Usa `busca_inpi_protocolo.py` para buscar fichas completas
- Extrai despachos e classifica em mantido/reformado/sem info
- Output: `indeferidos-aprofundamento.json`

**Valor:** Entender a densidade com precedentes reais. Se 5 marcas similares foram indeferidas na mesma classe, isso é munição para argumentar que a NOSSA marca também enfrenta risco — ou, invertendo, que o INPI tem padrão de barrar similares e o campo está "limpo" para quem passar.

---

### Etapa 3: Análise de Especificações vs. Atividade

Para cada marca Tier A e Tier B que permanece viva (em vigor / registro / aguardando):

1. **Ler especificação completa** (já extraída na Fase 2.5 com expand de divs)
2. **Comparar contra a atividade do cliente**, classificando em:

| Classificação | Critério | Exemplo (Plenya — saúde/bem-estar) |
|---------------|----------|--------------------------------------|
| **Afinidade direta** | Especificação descreve exatamente a mesma atividade | "serviços de clínica médica; serviços de saúde" |
| **Afinidade indireta** | Especificação é do mesmo universo mas nicho diferente | "serviços de salões de beleza; manicure" |
| **Sem afinidade** | Especificação é de segmento completamente distinto | "jardinagem paisagística; horticultura" |

3. **Para cada marca com afinidade direta:** É a colidência real. Vai para a narrativa com destaque.
4. **Para cada marca com afinidade indireta:** Registrar como risco menor. Mencionar na narrativa como contexto de densidade.
5. **Para cada marca sem afinidade:** Descartar da análise individual. Conta apenas como número na estatística de densidade.

**Execução:** Esta etapa é feita pelo Claude (Mira), não por script — exige julgamento jurídico para avaliar se "serviços de terapia" tem afinidade com "nutrição" (sim) ou se "serviços de tatuagem" tem afinidade com "apoio psicológico" (não). Mas o output é estruturado.

**Output:** `especificacoes-analise.json` — cada marca com `afinidade: "direta" | "indireta" | "sem_afinidade"` + justificativa.

---

### Etapa 4: Veredito Estruturado (pré-narrativa)

Antes de escrever qualquer parágrafo jurídico, consolidar:

```markdown
## VEREDITO PRÉ-NARRATIVA — {marca}

### Panorama por Classe

**Classe 44:**
- Total encontradas: {n}
- Tier A (candidatas): {n} → {n} com afinidade direta
- Tier B (atenção): {n} → {n} com afinidade indireta
- Tier C (descartadas): {n}
- Indeferidos relevantes: {n} (mantidos: {n}, reformados: {n})
- VEREDITO CLASSE: {MUITO PROVÁVEL | PROVÁVEL | POSSÍVEL COM ESTRATÉGIA | IMPROVÁVEL}

**Classe 41:**
(...)

### Colidências Críticas (afinidade direta, em vigor)
1. {Marca} — processo {n} — spec: {resumo} — RISCO: {alto/médio}
2. (...)

### Precedentes de Indeferimento
1. {Marca} indeferida por colidência com {outra} — art. 124, XIX — MANTIDO
2. (...)

### Estratégia Mestra
{Texto corrido: qual a melhor abordagem considerando o cenário por classe}

### Veredito Global
{MUITO PROVÁVEL | PROVÁVEL | POSSÍVEL COM ESTRATÉGIA | IMPROVÁVEL}
```

**Este veredito é o checkpoint de qualidade.** Só depois dele aprovado a Mira escreve a narrativa jurídica da PARTE 2.

---

### Etapa 5: Relatório Técnico de Cotejo (documento intermediário)

Antes da narrativa jurídica, gerar o arquivo `{marca} - RELATÓRIO TÉCNICO DE COTEJO.md` na pasta do caso. Este relatório é um **documento de trabalho interno** — não vai para o cliente, mas serve como base fundamentada para a narrativa e como registro de análise para a equipe.

#### Estrutura do Relatório

```markdown
# {MARCA} - RELATÓRIO TÉCNICO DE COTEJO

**Marca em análise:** {marca}
**Atividade:** {atividade}
**Tipo de sinal:** {FANTASIOSO / EVOCATIVO / etc.}
**Classes analisadas:** {lista}
**Data:** {data}
**Total de anterioridades encontradas:** {n}
**Total após triagem (Tier A + B):** {n}
**Total com cotejo individual:** {n}

---

## PANORAMA DE DENSIDADE

{Parágrafo: quantas marcas por classe, distribuição por situação (vigor/indeferidas/extintas),
concentração de elementos comuns, grau de saturação do campo marcário}

---

## COTEJO INDIVIDUAL

### [1] {NOME DA MARCA} — Processo {número}

| Campo | Valor |
|-------|-------|
| Classe | {N} |
| Situação | {em vigor / indeferida (mantida) / indeferida (reformada) / extinta} |
| Titular | {nome do titular} |
| Especificação completa | {texto integral expandido} |

**Similaridade fonética:** {ALTA / MÉDIA / BAIXA / NULA} — {justificativa em 1-2 frases}
**Similaridade gráfica:** {ALTA / MÉDIA / BAIXA / NULA} — {justificativa}
**Similaridade ideológica:** {ALTA / MÉDIA / BAIXA / NULA} — {justificativa}

**Afinidade mercadológica:** {DIRETA / INDIRETA / SEM AFINIDADE}
- Natureza: {análise}
- Finalidade: {análise}
- Concorrência: {análise}
- Origem habitual: {análise}
{demais critérios relevantes — omitir os que não agregam}

**Atenuantes:** {lista ou "nenhum identificado"}
**Agravantes:** {lista ou "nenhum identificado"}

**PARECER:** {COLIDÊNCIA PROVÁVEL / POSSÍVEL / REMOTA / SEM COLIDÊNCIA}
**Fundamentação:** {1-2 frases com base legal (art. 124 XIX, princípio da especialidade, etc.)}
**Estratégia sugerida:** {como defender se houver exigência/oposição}

---

### [2] {PRÓXIMA MARCA} — Processo {número}
{mesma estrutura}

---

## MARCAS DESCARTADAS (Tier C)

{Tabela resumo: nome | processo | classe | score | motivo do descarte}

---

## PRECEDENTES DE INDEFERIMENTO

{Para cada indeferido relevante: processo, motivo, se foi mantido ou reformado,
como isso informa a viabilidade da nossa marca}

---

## VEREDITO POR CLASSE

**Classe {N}:** {MUITO PROVÁVEL / PROVÁVEL / POSSÍVEL COM ESTRATÉGIA / IMPROVÁVEL}
- Colidências críticas: {n}
- Densidade: {alta / média / baixa}
- Fundamentação: {resumo}

{repete por classe}

---

## VEREDITO GLOBAL

**{MUITO PROVÁVEL / PROVÁVEL / POSSÍVEL COM ESTRATÉGIA / IMPROVÁVEL}**

{Parágrafo fundamentado: síntese do cenário, principais riscos, estratégia mestra recomendada}
```

#### Regras do Relatório

- **Tom:** Técnico-analítico, não jurídico-narrativo. Frases curtas, dados explícitos.
- **Especificações:** SEMPRE completas, nunca truncadas.
- **Parecer por marca:** Obrigatório. Cada marca recebe um veredito individual fundamentado.
- **Marcas sem colidência:** Não ganham seção individual — vão para a tabela resumo de descartadas.
- **Precedentes:** Seção própria, separada do cotejo individual.
- **Este relatório é o CHECKPOINT 1.5** — o usuário revisa antes de a Mira escrever a narrativa.

---

### Etapa 3.5: Julgamento por IA — Cotejo Individual (INPI-grade)

Para cada marca Tier A e Tier B que sobreviveu às etapas anteriores, a IA (Mira) executa um **cotejo completo** seguindo os critérios do Manual de Marcas do INPI (seção 5.11). Este é o coração da análise — transforma dados brutos em parecer técnico por marca.

#### Inputs por marca analisada

- Nome da marca candidata
- Nome da nossa marca
- Especificação completa da candidata (expandida)
- Atividade do nosso cliente
- Classe(s) em comum
- Situação processual (em vigor / indeferida / extinta)
- Tipo da nossa marca (fantasioso / evocativo / etc.)
- Se indeferida: resultado do aprofundamento (mantida / reformada / sem info)

#### Framework de Cotejo (baseado no Manual de Marcas INPI, seção 5.11)

A IA avalia cada marca em **3 dimensões de similaridade** + **1 dimensão de mercado**, gerando um parecer por marca:

**DIMENSÃO 1 — Similaridade Fonética**
- Sequência de sílabas, entonação, ritmo
- Regra INPI: "marcas são lembradas e mencionadas frequentemente em sua forma verbal" — fonética tem peso elevado
- Output: `fonetica: alta | média | baixa | nula` + justificativa

**DIMENSÃO 2 — Similaridade Gráfica**
- Sequência de letras, número de palavras, estrutura
- Dimensão e posição dos elementos no conjunto
- Relevante mesmo em nominativas: "repetição de sequências de letras pode gerar confusão"
- Output: `grafica: alta | média | baixa | nula` + justificativa

**DIMENSÃO 3 — Similaridade Ideológica**
- Evocam ideias idênticas ou semelhantes?
- Análise conceitual: significado, campo semântico, traduções
- Regra INPI: "sinais que evocam ideias idênticas ou semelhantes podem levar à confusão, mesmo com diferenças fonéticas ou gráficas"
- Output: `ideologica: alta | média | baixa | nula` + justificativa

**DIMENSÃO 4 — Afinidade Mercadológica (8 critérios do Manual)**

| Critério INPI | Pergunta que a IA responde | Peso |
|---------------|---------------------------|------|
| **Natureza** | Os serviços são da mesma categoria essencial? | Alto |
| **Finalidade e modo de utilização** | Servem para o mesmo propósito? São contratados da mesma forma? | Alto |
| **Complementariedade** | Um é indispensável ou importante para o outro? | Médio |
| **Concorrência/permutabilidade** | Podem ser substituídos um pelo outro? Mesmo público? | Alto |
| **Canais de distribuição** | Compartilham mesmos canais de venda/contratação? | Baixo (INPI: "não é definitivo") |
| **Público-alvo** | Visam o mesmo consumidor? | Baixo (INPI: "não é determinante" isoladamente) |
| **Grau de atenção** | O consumidor compra com atenção alta ou baixa? Serviço de saúde = atenção alta | Médio |
| **Origem habitual** | É comum que a mesma empresa forneça ambos os serviços? | Alto |

Output: `afinidade: direta | indireta | sem_afinidade` + análise dos 8 critérios

#### Regra de Equilíbrio (Princípio da Especialidade — INPI)

> "Quanto **menor a semelhança entre os sinais**, maior deverá ser a afinidade mercadológica para caracterizar risco de confusão."

A IA aplica esta regra inversamente proporcional:
- Similaridade ALTA + afinidade BAIXA → ainda pode colidir (sinal domina)
- Similaridade BAIXA + afinidade ALTA → ainda pode colidir (mercado domina)
- Similaridade BAIXA + afinidade BAIXA → descarta
- Similaridade ALTA + afinidade ALTA → colidência forte

#### Fatores Atenuantes e Agravantes

**Atenuantes (reduzem risco):**
- Elemento em comum é **desgastado** (presente em muitas marcas de titulares diferentes na mesma classe) → "público habituado à presença do elemento"
- Marca candidata tem **elemento nominativo irregistrável** como componente principal
- Especificações em **nichos distintos** dentro da mesma classe
- Nossa marca é **fantasiosa** (proteção ampla, mas difícil de confundir com evocativas do mesmo campo)

**Agravantes (aumentam risco):**
- Marca candidata é de **alto renome** → proteção em todos os ramos
- Produtos/serviços que **interferem na saúde** → "exame especialmente cauteloso" (INPI)
- Reprodução com acréscimo (art. 124 XIX) — contém nossa marca inteira + algo a mais
- Candidata é **notoriamente conhecida** no segmento (art. 126 LPI)

#### Output por Marca — `cotejo-individual.json`

```json
{
  "marca": "PLENNUS SAÚDE",
  "processo": "920.123.456",
  "classe": 44,
  "situacao": "em vigor",
  "especificacao_completa": "serviços de clínica médica; serviços de saúde; assistência médica",

  "cotejo": {
    "fonetica": { "grau": "alta", "justificativa": "..." },
    "grafica": { "grau": "média", "justificativa": "..." },
    "ideologica": { "grau": "alta", "justificativa": "ambas evocam plenitude/completude" },
    "afinidade": {
      "grau": "direta",
      "criterios": {
        "natureza": "mesma categoria (serviços médicos)",
        "finalidade": "mesmo propósito (saúde/bem-estar)",
        "complementariedade": "não complementares, concorrentes",
        "concorrencia": "permutáveis — mesmo público, mesma finalidade",
        "canais": "mesmos canais (clínicas, plataformas de saúde)",
        "publico_alvo": "mesmo público (consumidor geral buscando saúde)",
        "grau_atencao": "alto — serviços de saúde exigem atenção",
        "origem_habitual": "comum que mesma empresa ofereça ambos"
      }
    },
    "principio_especialidade": "similaridade ALTA + afinidade DIRETA = risco elevado",
    "fatores_atenuantes": ["elemento 'plen' desgastado em marcas de saúde?"],
    "fatores_agravantes": ["serviço de saúde = exame cauteloso INPI"],
    "elemento_desgastado": false
  },

  "veredito_marca": "COLIDÊNCIA PROVÁVEL",
  "risco": "alto",
  "fundamentacao": "Art. 124 XIX — imitação fonética e ideológica com afinidade mercadológica direta em serviços de saúde. O INPI aplica exame cauteloso neste segmento.",
  "estrategia_defesa": "Argumentar diferença gráfica (Plenya vs Plennus) e apresentação visual distinta. Invocar desgaste do radical 'plen-' se houver múltiplas marcas com esse radical na classe."
}
```

#### Classificação Final por Marca

| Veredito | Critério | Ação na narrativa |
|----------|----------|------------------|
| **COLIDÊNCIA PROVÁVEL** | Similaridade alta em ≥2 dimensões + afinidade direta | Destaque máximo. Análise detalhada com estratégia de defesa. |
| **COLIDÊNCIA POSSÍVEL** | Similaridade média + afinidade direta, OU similaridade alta + afinidade indireta | Análise moderada. Mencionar risco e atenuantes. |
| **COLIDÊNCIA REMOTA** | Similaridade baixa + afinidade indireta, OU alta similaridade + sem afinidade | Menção breve como contexto de densidade. |
| **SEM COLIDÊNCIA** | Similaridade baixa/nula + sem afinidade | Não entra na narrativa. Conta apenas na estatística. |

#### Verificação de Desgaste (elemento em comum)

Antes de fechar o veredito de cada marca, a IA verifica:

1. Quantas outras marcas de **titulares diferentes** usam o mesmo radical/elemento na mesma classe?
2. Se ≥ 5 marcas de titulares distintos → elemento **desgastado** → atenua risco
3. Regra INPI: "quando o elemento em comum já faz parte de diversas marcas registradas de diferentes titulares, fica reduzida a possibilidade de confusão"

Isso alimenta o argumento de convivência na narrativa final.

---

## Fluxo Completo Revisado

```
Fase 0   — Monitorar ClickUp
Fase 1   — Coletar dados do card
Fase 2   — Análise Preliminar (PARTE 1) → CHECKPOINT 1
Fase 2.5 — Busca automática INPI (Playwright)
Fase 2.7 — TRIAGEM E APROFUNDAMENTO (NOVO)
           ├── 2.7.1  Classificar em 3 tiers (A/B/C)
           ├── 2.7.2  Aprofundar indeferidos (mantidos/reformados)
           ├── 2.7.3  Analisar especificações vs. atividade
           ├── 2.7.4  Cotejo individual por IA (fonética + gráfica + ideológica + afinidade 8 critérios INPI)
           ├── 2.7.5  Verificação de desgaste (elemento em comum em múltiplos titulares)
           ├── 2.7.6  Veredito estruturado (consolidação)
           └── 2.7.7  RELATÓRIO TÉCNICO DE COTEJO (.md) → CHECKPOINT 1.5
Fase 3   — Narrativa Jurídica (PARTE 2) → CHECKPOINT 2
Fase 4   — Gerar PDF + DOCX + Drive + ClickUp
```

---

## Impacto nos Artefatos Existentes

### Modificar

| Artefato | Mudança |
|----------|---------|
| `filtrar_colidencias.py` | Adicionar campo `tier: A/B/C` no output (hoje é `investigar/baixo_risco`) |
| `workflows/nova-analise.md` | Inserir Fase 2.7 entre 2.5 e 3 |
| `.synapse/analise-inpi` | Ajustar para receber veredito estruturado como input (não mais JSON bruto) |
| `laudo-inpi.md` (task) | Prerequisite passa a ser veredito aprovado, não apenas inpi-raw.txt |

### Criar

| Artefato | Tipo | Descrição |
|----------|------|-----------|
| `aprofundar_indeferidos.py` | Script | Busca fichas de indeferidos, classifica mantido/reformado |
| `laudo-triagem.md` | Task | Define a execução da Fase 2.7 completa (etapas 1-6) |
| `.synapse/cotejo-inpi` | Synapse | Framework de cotejo individual: 3 dimensões de similaridade + 8 critérios de afinidade mercadológica + princípio da especialidade + atenuantes/agravantes. Baseado na seção 5.11 do Manual de Marcas INPI. |

### Não modificar

| Artefato | Motivo |
|----------|--------|
| `busca_inpi_por_classe.py` | Já faz tudo que precisa (busca + expand specs) |
| `busca_inpi_protocolo.py` | Já busca por número — será chamado pelo novo script |
| `processar_inpi.py` | Continua processando dados brutos normalmente |
| `laudo-preliminar.md` | PARTE 1 não muda |
| `laudo-gerar.md` | Geração de docs não muda |

---

## Decisões em Aberto

1. **Nome do tier intermediário:** "Zona de Atenção" está bom ou preferem outro nome?
2. **Veredito estruturado como arquivo separado ou inline no PLANO DE ANÁLISE?** Sugestão: arquivo separado (`veredito.md`) que alimenta a narrativa, sem aparecer no documento final do cliente.
3. **Checkpoint entre 2.7 e 3?** O veredito estruturado seria um checkpoint humano (2.5 checkpoints no total) ou é aprovação automática se a Mira está confiante?
4. **Threshold do Tier A (≥ 40):** Conservador demais? Pouco conservador? Calibrar com casos reais.
5. **Cotejo individual — execução:** A IA analisa marca por marca sequencialmente (mais profundo, mais lento) ou em lotes de 5 com resumo (mais rápido, menos granular)?
6. **Grau de atenção para saúde:** O Manual diz que serviços de saúde = "exame especialmente cauteloso". Isso deve ser hard-coded como agravante automático ou a IA avalia caso a caso?

---

```yaml
metadata:
  status: proposta
  fase_proposta: 2.7
  dependencias_existentes: [filtrar_colidencias.py, busca_inpi_protocolo.py]
  artefatos_novos: [aprofundar_indeferidos.py, laudo-triagem.md, .synapse/cotejo-inpi]
  artefatos_modificados: [filtrar_colidencias.py, nova-analise.md, analise-inpi, laudo-inpi.md]
  fonte_criterios: "Manual de Marcas INPI, seção 5.11 (3ª edição, 6ª revisão, 20/08/2024)"
  estimated_effort: medium-high
  tags: [triagem, tiers, indeferidos, especificacoes, cotejo, afinidade-mercadologica, veredito, fase-2.7]
```
