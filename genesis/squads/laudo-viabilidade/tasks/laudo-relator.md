# Task: Relator — Relatório Técnico de Cotejo (Fase 6)

> **Sub-agente:** @relator
> **Modelo:** Sonnet
> **Fase:** 6 — Relatório Técnico
> **Invocado por:** @laudo (Mira)

---

## Purpose

Consolidar TODA a inteligência produzida nas Fases 1-5 em um documento
de trabalho completo, legível, marca a marca, sem resumos.

O relatório é:
- Para a **equipe** (revisão interna)
- Para o **cliente** (documento de suporte ao laudo)
- O **checkpoint 1.5** — humano revisa antes da narrativa jurídica

---

## Prerequisites

Todos os JSONs das fases anteriores:
- `fonte-bruta.json` (master)
- `peneira/peneira-resultado.json`
- `specs/specs-completas.json`
- `precedentes/precedentes-cadeia.json`
- `precedentes/bloqueadores-fichas.json`
- `coexistencia/mapa-coexistencia.json`
- `analise/precedentes-analise.json`
- `vereditos/vereditos-individuais.json`
- Dados do caso: nome_marca, atividade, classes, tipo_marca, cliente

---

## Execution Mode

**Automático.** Gera o .md completo.

Se > 20 marcas com cotejo individual: processar em blocos (seções do .md)
e concatenar. Cada bloco é autocontido.

---

## Estrutura do Relatório

O arquivo gerado é: `{marca} - RELATÓRIO TÉCNICO DE COTEJO.md`

```markdown
# {MARCA} - RELATÓRIO TÉCNICO DE COTEJO

**Marca em análise:** {marca}
**Cliente:** {cliente}
**Tipo de sinal:** {FANTASIOSO / EVOCATIVO / etc.}
**Atividade:** {atividade}
**Classes analisadas:** {lista}
**Data da análise:** {data}

**Estatísticas da coleta:**
- Total INPI (busca por similaridade): {n} marcas
- Bucket A (vivas): {n} | Bucket B (indeferidas): {n} | Bucket C (mortas): {n}
- Após peneira: {n} vivas para cotejo | {n} precedentes para análise
- Marcas com cotejo individual: {n}

---

## 1. PANORAMA DE DENSIDADE

{Análise por classe:
 - Quantas marcas total, quantas vivas, quantas indeferidas, quantas mortas
 - Radicais dominantes no campo marcário
 - Classes com maior/menor densidade
 - Impressão geral: campo saturado ou aberto?}

---

## 2. MAPA DE COEXISTÊNCIA E DESGASTE

{Para cada cluster de radical, POR CLASSE:}

### Cluster "{radical}" — Classe {N}

**Marcas vivas de titulares distintos:**
| # | Processo | Nome | Titular | Situação |
|---|----------|------|---------|----------|
| 1 | {nº} | {nome} | {titular} | {situação} |
| 2 | ... | ... | ... | ... |

**Titulares distintos:** {n}

**Indeferimentos no cluster:**
| Processo | Nome | Resultado | Bloqueador |
|----------|------|-----------|------------|
| {nº} | {nome} | {indeferido_mantido / reformado} | {processo + nome do bloqueador} |

**Parecer de desgaste:** {FAVORÁVEL / PARCIAL / DESFAVORÁVEL / INCONCLUSIVO}
{Justificativa com dados concretos}

**Impacto para {marca}:** {análise específica}

---

## 3. PRECEDENTES E ISONOMIA

{Para cada cadeia de bloqueio relevante:}

### Precedente: {nome da marca indeferida} (Processo {nº})

**Cadeia:**
```
{marca indeferida} ({situação})
  └── bloqueada por: {marca bloqueadora} ({situação})
       ├── Specs indeferida: {spec completa}
       ├── Specs bloqueadora: {spec completa}
       └── Titular bloqueadora: {nome}
```

**Motivo:** {artigo LPI + fundamento}
**Recurso:** {houve? resultado? data? instância?}
**Resultado final:** {indeferido_mantido / reformado / etc.}

**Rastreabilidade:** {por que essa busca foi feita}

**Isonomia para {marca}:**
- Direção: {FAVORÁVEL / DESFAVORÁVEL / MISTA}
- Análise: {como este precedente impacta especificamente a nossa marca}

---

## 4. COTEJO INDIVIDUAL

### CANDIDATAS (Nível 1 — risco evidente)

#### [{n}] {NOME DA MARCA} — Processo {nº} — Classe {N}

| Campo | Valor |
|-------|-------|
| Situação | {status completo} |
| Titular | {nome do titular} |
| Nível peneira | 1 — Candidata |
| Especificação completa | {TEXTO INTEGRAL — nunca truncado, copiado do JSON} |

**Similaridade fonética:** {ALTA / MÉDIA / BAIXA / NULA}
{Justificativa: 1-2 frases com pontos concretos}

**Similaridade gráfica:** {ALTA / MÉDIA / BAIXA / NULA}
{Justificativa}

**Similaridade ideológica:** {ALTA / MÉDIA / BAIXA / NULA}
{Justificativa}

**Afinidade mercadológica:** {DIRETA / INDIRETA / SEM AFINIDADE}
{Critérios relevantes detalhados — só os que agregam}

**Especificações vs. atividade:**
- Spec da candidata: {texto integral}
- Atividade do cliente: {atividade}
- Sobreposição: {DIRETA / INDIRETA / SEM SOBREPOSIÇÃO}
- Análise: {onde exatamente se sobrepõe ou não}

**Isonomia:** {aplicável? direção? processo de referência?}

**Desgaste:** {cluster + grau + titulares distintos}

**Atenuantes:** {lista — ou "nenhum identificado"}
**Agravantes:** {lista — ou "nenhum identificado"}

**PARECER: {COLIDÊNCIA PROVÁVEL / POSSÍVEL / REMOTA / SEM COLIDÊNCIA}**
**Fundamentação:** {base legal + isonomia + desgaste — 2-3 frases}
**Estratégia de defesa:** {como argumentar — 2-3 frases}

---

#### [{n+1}] {PRÓXIMA MARCA} ...
{Mesma estrutura. TODAS as marcas nível 1.}

---

### ZONA DE ATENÇÃO (Nível 2 — risco possível)

#### [{n}] {MARCA} — Processo {nº} — Classe {N}
{Mesma estrutura completa. Sem atalhos. Sem resumos.}

---

### DESCARTADAS NA PENEIRA (Nível 3)

{Tabela completa de TODAS as marcas descartadas — para transparência:}

| # | Processo | Nome | Classe | Situação | Bucket | Nível | Justificativa |
|---|----------|------|--------|----------|--------|-------|---------------|
| 1 | {nº} | {nome} | {N} | {situação} | {A/B/C} | 3 | {justificativa da peneira} |
| 2 | ... | ... | ... | ... | ... | 3 | ... |
| ... | | | | | | | |

**Total descartadas:** {n} marcas

---

## 5. VEREDITO POR CLASSE

### Classe {N}

| Métrica | Valor |
|---------|-------|
| Vivas relevantes (cotejadas) | {n} |
| COLIDÊNCIA PROVÁVEL | {n} |
| COLIDÊNCIA POSSÍVEL | {n} |
| COLIDÊNCIA REMOTA | {n} |
| SEM COLIDÊNCIA | {n} |
| Densidade | {alta / média / baixa} |
| Desgaste do radical | {FAVORÁVEL / PARCIAL / DESFAVORÁVEL} |
| Isonomia predominante | {FAVORÁVEL / DESFAVORÁVEL / MISTA} |

**VEREDITO CLASSE {N}: {MUITO PROVÁVEL / PROVÁVEL / POSSÍVEL COM ESTRATÉGIA / IMPROVÁVEL}**

{Parágrafo fundamentado: síntese dos riscos, desgaste, isonomia, estratégia
recomendada para esta classe}

---

{Repete para cada classe}

---

## 6. VEREDITO GLOBAL

**VEREDITO: {MUITO PROVÁVEL / PROVÁVEL / POSSÍVEL COM ESTRATÉGIA / IMPROVÁVEL}**

{Parágrafo fundamentado cruzando todas as classes:
 - Principais ameaças
 - Pontos fortes (desgaste favorável, classes livres)
 - Isonomia: o que os precedentes dizem
 - Estratégia mestra: recomendação integrada para o depósito
 - O que fazer se houver exigência/oposição em cada classe}
```

---

## Regras Inegociáveis

1. **NADA é resumido.** Cada marca nível 1 e 2 tem seção individual COMPLETA.
2. **Especificações INTEGRAIS.** Copiadas do JSON. Nunca truncadas com "...".
3. **Descartadas listadas.** Tabela completa com justificativa — transparência.
4. **Tom técnico-analítico.** Dados explícitos, frases diretas. NÃO é narrativa jurídica (isso é Fase 7).
5. **Acessível para equipe e cliente.** Sem jargão interno do sistema. Sem referências a JSONs, scripts, buckets ou fases.
6. **Dados sempre verificáveis.** Todo número de processo, nome e spec vem do fonte-bruta.json.
7. **Nunca usar** "fuzzy", "score", "bucket", "pipeline", "sub-agente", "Haiku", "Sonnet", "Opus".

---

## Edge Cases

### Mais de 30 marcas com cotejo individual
→ Processar em blocos de 15 marcas
→ Cada bloco gera uma seção do .md
→ Concatenar no final mantendo numeração contínua

### Marca sem spec coletada (falha no coletar_specs.py)
→ Registrar: "Especificação: não disponível — coleta falhou"
→ Prosseguir com análise baseada no que tem (nome + classe)

### Nenhuma colidência provável encontrada
→ Veredito global: "MUITO PROVÁVEL" (de registro, não de colidência)
→ Detalhar por que o cenário é favorável

### Todas as marcas são colidência provável
→ Veredito global: "IMPROVÁVEL" (de registro)
→ Detalhar estratégia de defesa classe por classe

### Cluster de coexistência sem dados suficientes
→ Seção 2 registra "INCONCLUSIVO" com nota
→ Não impacta veredito negativamente (ausência de dados ≠ risco)

---

## Proibições

- ❌ NUNCA resumir seções individuais em "ver marca anterior"
- ❌ NUNCA truncar especificações
- ❌ NUNCA omitir marcas descartadas da tabela
- ❌ NUNCA usar linguagem técnica de sistema (JSON, script, bucket, pipeline)
- ❌ NUNCA inventar dados que não estejam nos JSONs de input
- ❌ NUNCA omitir fatores agravantes do veredito
- ❌ NUNCA usar emojis

---

## Success Output

```
Relatório técnico concluído — {marca}

Documento: {marca} - RELATÓRIO TÉCNICO DE COTEJO.md
Marcas cotejadas individualmente: {n}
Marcas descartadas (listadas na tabela): {n}
Veredito global: {MUITO PROVÁVEL / PROVÁVEL / POSSÍVEL COM ESTRATÉGIA / IMPROVÁVEL}

→ Pronto para CHECKPOINT 1.5 (revisão humana)
```

---

```yaml
metadata:
  version: 3.0.0
  squad: laudo-viabilidade
  fase: 6
  sub_agente: relator
  modelo: sonnet
  input: [fonte-bruta.json, peneira-resultado.json, specs-completas.json, precedentes-cadeia.json, bloqueadores-fichas.json, mapa-coexistencia.json, precedentes-analise.json, vereditos-individuais.json]
  output: "{marca} - RELATÓRIO TÉCNICO DE COTEJO.md"
  tags: [relatorio, tecnico, cotejo, consolidacao, checkpoint]
```
