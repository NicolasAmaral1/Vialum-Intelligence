# RELATÓRIO TÉCNICO DE VIABILIDADE MARCÁRIA
## {MARCA}
### {CLIENTE} — {ATIVIDADE}

---

**Data de Referência:** {DATA}
**Elaborado por:** Vialum Intelligence — Análise Automatizada com Revisão Jurídica
**Universo Analisado:** {N_COLETADAS} marcas coletadas no INPI | {N_TRIAGEM} analisadas na triagem | {N_TRIANGULOS} triangulações realizadas | {N_SPECS} especificações verificadas
**Classes Requeridas:** {CLASSES}
**Natureza do Sinal:** {NATUREZA} — Elemento distintivo: {ELEMENTO_DISTINTIVO}
**Postura da Análise:** {POSTURA} — {BASE_POSTURA}
**Risco Global:** {RISCO}

---

## 1. RESUMO EXECUTIVO

{Parágrafo: contexto da marca, atividade, classes. Não repetir o que já está no cabeçalho — ir direto ao ponto.}

**Decomposição do sinal:**

| Elemento | Classificação | Peso na análise |
|----------|--------------|-----------------|
| {ELEMENTO_1} | DISTINTIVO | Alto — núcleo individualizador |
| {ELEMENTO_2} | DESCRITIVO | Baixo — descreve atividade |
| {ELEMENTO_3} | DESCRITIVO | Baixo — descreve atividade |
| {ELEMENTO_4} | FILLER | Ignorado |

{Parágrafo: síntese do veredito por classe, chance de êxito estimada, recomendação principal.}

---

## 2. PANORAMA DA PESQUISA

### 2.1 Coleta

{Parágrafo: quantas marcas coletadas, por classe, método fuzzy, termos buscados.}

**Termos pesquisados:**

| Termo | Tipo | Classes | Resultados |
|-------|------|---------|------------|
| {MARCA_COMPLETA} | Marca completa | {CLASSES} | {N} marcas |
| {DISTINTIVO} | Elemento distintivo | {CLASSES} | {N} marcas |
| {TRADUCAO} | Tradução ({IDIOMA}) | {CLASSES} | {N} marcas |
| {MARCA_COMPLETA} (cross-class) | Nome exato, 45 classes | Todas | {N} alertas |

**Buscas que retornaram zero:**
{Lista de combinações termo × classe que retornaram 0 — mostra que foram pesquisadas.}
- "{TRADUCAO}" na classe {N}: 0 resultados
- "{DISTINTIVO}" na classe {N}: 0 resultados

### 2.2 Triagem Heurística

Das {N_COLETADAS} marcas coletadas (após deduplicação), {N_FILTRADAS} foram removidas automaticamente por serem marcas mortas ou indeferidas, restando {N_VIVAS} marcas vivas para triagem. A análise por relevância fonética ao elemento distintivo "{ELEMENTO_DISTINTIVO}" classificou:

| Tier | Descrição | Qtd | Destino |
|------|-----------|-----|---------|
| T1 | Contém elemento distintivo exato | {N} | Investigação completa |
| T2 | Fonética forte com distintivo | {N} | Investigação completa |
| T3 | Composição suspeita (fonética + contexto) | {N} | Investigação seletiva |
| T4 | Match apenas descritivo ({DESCRITIVO}) | {N} | Mapa de desgaste |
| T5 | Sem relevância | {N} | Descartada (ver 2.4) |

{Se flags:}

**Alertas automáticos identificados:**
- {FLAG_1}: {DESCRIÇÃO}
- {FLAG_2}: {DESCRIÇÃO}

### 2.3 Marcas Selecionadas para Investigação (T1-T3)

Das {N_T1T2T3} marcas classificadas em T1-T3, {N_SELECIONADAS} foram selecionadas para investigação após revisão:

**T1 — Contêm "{DISTINTIVO}" exato ({N_T1}):**
{Para cada:}
- **{MARCA}** — cl.{CLASSE} — {STATUS} — {TITULAR}

**T2 — Fonética forte ({N_T2}):**
{Para cada, agrupado pelo elemento que matchou:}

*{ELEMENTO} ≈ {DISTINTIVO}:*
- **{MARCA}** — cl.{CLASSE} — {STATUS}
- **{MARCA}** — cl.{CLASSE} — {STATUS}

**T3 — Composição suspeita ({N_T3}):**
- **{MARCA}** — cl.{CLASSE} — {STATUS} — match: {ELEMENTO}~{DISTINTIVO}

**Marcas revisadas e excluídas da investigação:**
{Marcas que estavam em T1-T3 mas foram desmarcadas pelo revisor no checkpoint:}
- **{MARCA}** — cl.{CLASSE} — Motivo: {por que foi excluída — ex: "segmento incompatível", "elemento INK refere-se a tinta, não a finança"}

### 2.4 Inventário Completo de Descartadas

#### T4 — Match apenas descritivo ({N_T4} marcas)

Marcas que contêm apenas o elemento descritivo "{DESCRITIVO}" sem qualquer proximidade com o elemento distintivo "{DISTINTIVO}". Estas marcas não representam risco de colidência direta mas alimentam o mapa de desgaste do termo (Seção 4).

{Por classe:}

**Classe {N} ({N_MARCAS} marcas com "{DESCRITIVO}"):**
{Lista compacta, 3-4 por linha:}
{MARCA_1} | {MARCA_2} | {MARCA_3} | {MARCA_4}
{MARCA_5} | {MARCA_6} | {MARCA_7} | {MARCA_8}

**Classe {N} ({N_MARCAS} marcas com "{DESCRITIVO}"):**
{Idem}

#### T5 — Sem relevância ({N_T5} marcas)

Marcas que apareceram na busca fuzzy do INPI mas não apresentam sobreposição fonética, gráfica ou ideológica com nenhum elemento do sinal analisado. Foram coletadas pelo algoritmo de similaridade do INPI por coincidência parcial e descartadas após análise individual.

{Por classe:}

**Classe {N} ({N_MARCAS}):**
{Lista compacta:}
{MARCA_1} | {MARCA_2} | {MARCA_3} | {MARCA_4}

#### Cross-class — Alertas fora do perímetro

{Se houve alertas:}
Foram identificadas {N} marcas idênticas ou quase idênticas em classes fora do perímetro de proteção:
- **{MARCA}** — cl.{CLASSE} — {STATUS} — similaridade {N}%

{Se não houve:}
Nenhuma marca idêntica identificada fora das classes analisadas.

---

## 3. TRIANGULAÇÃO DE PRECEDENTES

A triangulação consiste na verificação factual de como o INPI tratou marcas similares no passado. Cada "triângulo" relaciona a marca em análise com um precedente (marca similar que já teve decisão de mérito) e, quando identificado no despacho, com o bloqueador que fundamentou essa decisão. A especificação de cada marca é verificada para confirmar se o precedente é relevante para a atividade do cliente.

### 3.1 Triângulos Confirmados

{Para cada triângulo confirmado:}

**Triângulo {N}: {NOME_PRECEDENTE}**

| Vértice | Marca | Processo | Status | Spec |
|---------|-------|----------|--------|------|
| Nossa marca | {MARCA} | — | Em análise | {ATIVIDADE} |
| Precedente | {PRECEDENTE} | {PROC} | {STATUS} | {SPEC_RESUMIDA} |
| Bloqueador | {BLOQUEADOR} | {PROC} | {STATUS} | {SPEC_RESUMIDA} |

**Fato:** {descrição factual do que foi lido no despacho, sem dedução}

**Relevância para o caso:** A especificação do precedente sobrepõe a atividade do cliente em {GRAU}. {Explicação factual de por que este precedente é relevante.}

---

### 3.2 Triângulos Frustrados

{Para cada triângulo frustrado:}

- **{PRECEDENTE}** (proc. {PROC}) — Spec: "{SPEC_RESUMIDA}" — Sem sobreposição com a atividade do cliente. Descartado como precedente relevante.

### 3.3 Regras Extraídas dos Precedentes

Com base nos triângulos confirmados, observam-se os seguintes padrões factuais:

**Elemento "{ELEMENTO_1}":**
{Parágrafo factual: quantos triângulos envolvem este elemento, o que os precedentes mostram — sempre descritivo, nunca preditivo.}

**Elemento "{ELEMENTO_2}":**
{Parágrafo factual.}

### 3.4 Postura da Análise

A triangulação resultou em postura **{POSTURA}** para a continuidade da pesquisa.

{Se RESTRITIVA: "Os precedentes indicam campo hostil. A análise subsequente focou nas ameaças diretas já identificadas."}
{Se NEUTRA: "O cenário é misto. A análise expandiu para marcas de relevância moderada para resolver ambiguidades."}
{Se ABERTA: "Não foram identificados precedentes negativos diretos. A análise foi expandida para ameaças indiretas e classes adjacentes para confirmar a viabilidade."}

---

## 4. MAPA DE DESGASTE MARCÁRIO

{Mesmo formato do v3 — desgaste por elemento, por classe, com precedentes quantitativos.}

### 4.1 Elemento {DISTINTIVO}

**Natureza jurídica:** {ARBITRÁRIO/EVOCATIVO/DESCRITIVO} no segmento de {ATIVIDADE}.

**Desgaste quantitativo por classe:**
{Para cada classe: titulares ativos, indeferimentos, risco.}

**Conclusão sobre {DISTINTIVO}:** {Factual.}

### 4.2 Elemento {DESCRITIVO_1}

{Mesmo formato.}

### 4.3 Síntese do Desgaste por Classe

{Tabela ou parágrafos resumindo desgaste por classe.}

---

## 5. AMEAÇAS ATIVAS

Marcas sem decisão de mérito que disputam o mesmo espaço marcário. Não configuram precedente jurídico mas representam risco de oposição ou colidência futura.

{Para cada ameaça:}
- **{MARCA}** (proc. {PROC}) — cl.{CLASSE} — {STATUS} — Spec: {SPEC}

---

## 6. COLIDÊNCIAS RELEVANTES — ANÁLISE INDIVIDUAL

{Cotejo marca a marca das que passaram pela triangulação e specs. Formato do v3: fonética, gráfica, ideológica, specs, veredito por marca.}

### 6.1 {MARCA_COLIDÊNCIA_1}

**Processo:** {PROC}
**Classe:** {CLASSE}
**Status:** {STATUS}
**Titular:** {TITULAR}
**Especificação:** {SPEC_COMPLETA}

**Cotejo fonético:** {análise}
**Cotejo gráfico:** {análise}
**Cotejo ideológico:** {análise}
**Sobreposição de especificação:** {análise}

**Veredito individual:** Colidência {PROVÁVEL/POSSÍVEL/REMOTA}.

---

## 7. RISCO POR CLASSE — PARECER FUNDAMENTADO

{Para cada classe, parágrafo denso com:
- Desgaste do elemento distintivo nesta classe
- Triângulos relevantes nesta classe
- Ameaças ativas nesta classe
- Precedentes favoráveis e desfavoráveis
- Risco: BAIXO / MODERADO / ALTO
- Chance de êxito estimada}

### 7.1 Classe {N} — {NOME_CLASSE}

{Parecer fundamentado.}

---

## 8. CONCLUSÃO E RECOMENDAÇÕES ESTRATÉGICAS

{Parágrafo final com:
- Síntese do risco global
- Chance de êxito estimada por classe
- Recomendação: prosseguir / prosseguir com ressalvas / não prosseguir
- Alternativas se negativo
- Disclaimer figurativo}

**Disclaimer:** Esta análise abrange exclusivamente colidências nominativas. Para marcas mistas e figurativas, recomenda-se análise complementar de trade dress.

---

*Relatório gerado por Vialum Intelligence — Pipeline v4 (Triangulação Iterativa)*
*{DATA} — Equipe Genesis*
