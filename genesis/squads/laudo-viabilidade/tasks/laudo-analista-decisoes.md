# Task: Analista de Decisões — Isonomia e Padrões (Fase 4)

> **Sub-agente:** @analista-decisoes
> **Modelo:** Opus
> **Fase:** 4 — Análise de decisões e Princípio da Isonomia
> **Invocado por:** @laudo (Mira)

---

## Purpose

Cruzar precedentes, bloqueadores e mapa de coexistência para identificar
**padrões de decisão do INPI** e aplicar o **Princípio da Isonomia**:

> "Se o INPI decidiu de determinada forma para marcas similares à nossa,
> é razoável esperar que decida da mesma forma para a nossa."

Este é um trabalho de **raciocínio jurídico** — não é extração de dados nem
classificação mecânica. O analista cruza informações de múltiplas fontes e
emite conclusões ponderadas.

---

## Prerequisites

- `precedentes/precedentes-cadeia.json` (cadeias de bloqueio)
- `precedentes/bloqueadores-fichas.json` (fichas dos bloqueadores com specs)
- `coexistencia/mapa-coexistencia.json` (clusters e desgaste)
- Dados do caso: `nome_marca`, `atividade`, `classes_aprovadas`, `tipo_marca`

---

## Execution Mode

**Automático.** Analisa e retorna resultado estruturado.

---

## Passos de Execução

### Passo 1: Para cada cluster de decisões, responder 5 perguntas

**Pergunta 1 — QUANDO ocorreu?**
- Listar datas das decisões relevantes (indeferimentos, recursos)
- Decisões recentes (2023-2026) pesam MAIS que antigas (antes de 2020)
- O INPI pode ter mudado critérios ao longo do tempo
- Registrar: data e peso (recente / intermediário / antigo)

**Pergunta 2 — QUAL foi a decisão?**
- Indeferimento? Deferimento apesar de similaridade? Recurso provido?
- O FUNDAMENTO é crucial: art. 124 XIX (imitação)? VI (descritivo)? Outro?
- Se art. 124 XIX → colidência reconhecida pelo INPI
- Se art. 124 VI → INPI considerou o termo descritivo/genérico
- Registrar: decisão + fundamento + citação do despacho

**Pergunta 3 — QUEM decidiu?**
- 1ª instância (examinador) → peso normal
- 2ª instância (recurso) → peso ELEVADO (revisão da decisão)
- Câmara de recurso → peso MÁXIMO (decisão colegiada final)
- Uma decisão de 2ª instância vale mais que 3 de 1ª instância
- Registrar: instância + peso

**Pergunta 4 — PADRÃO identificável?**
Cruzar todas as decisões do cluster e identificar:
- "Na classe 44, o INPI indeferiu sistematicamente marcas com radical plen-"
- "Na classe 42, o INPI aceitou convivência de radical plen- entre titulares diferentes"
- "O INPI indeferiu plen- quando a spec sobrepõe 'serviços médicos', mas aceitou quando a spec é 'software'"
- Se padrão contraditório → registrar ambos com contexto
- Se sem padrão claro → registrar "sem padrão definido — decisões inconsistentes"

**Pergunta 5 — ISONOMIA aplicável à nossa marca?**
Com base no padrão identificado, responder:
- "Se o INPI indeferiu PLENUS VIDA por colidência com PLENUS na classe 44, e Plenya é foneticamente similar a PLENUS VIDA, então por isonomia, Plenya PODE ser indeferida pelo mesmo motivo"
- OU: "Se o INPI aceitou convivência de PLENA TECH com PLENSOFT na classe 42, então por isonomia, Plenya deveria ser aceita na classe 42"

Direção da isonomia:
- **FAVORÁVEL:** precedentes indicam que nossa marca deve ser aceita
- **DESFAVORÁVEL:** precedentes indicam que nossa marca pode ser barrada
- **MISTA:** precedentes conflitantes
- **NEUTRA:** sem precedentes relevantes o suficiente

### Passo 2: Análise de specs dos bloqueadores

Para cada bloqueador coletado na Fase 3B.3, verificar:
- A spec do bloqueador sobrepõe a atividade do nosso cliente?
- Se sim: o bloqueador é uma ameaça direta (pode nos bloquear também)
- Se não: o bloqueio foi específico ao caso anterior (spec diferente)

Isso refina a isonomia: "PLENUS bloqueou PLENUS VIDA na spec 'serviços médicos',
que é exatamente a atividade de Plenya → isonomia DIRETA e DESFAVORÁVEL"

### Passo 3: Ponderar recência

| Período | Peso | Justificativa |
|---------|------|---------------|
| 2024-2026 | ALTO | Decisão recente, critérios atuais do INPI |
| 2021-2023 | MÉDIO | Relativamente recente |
| 2018-2020 | BAIXO | INPI pode ter mudado critérios |
| Antes de 2018 | MUITO BAIXO | Contexto marcário pode ter mudado significativamente |

---

## Output — Schema Formal

Arquivo: `analise/precedentes-analise.json`

```json
{
  "marca_analisada": "Plenya",
  "data_analise": "2026-03-30T15:30:00Z",

  "padroes_por_classe": [
    {
      "classe": 44,
      "radical_analisado": "plen-",

      "decisoes": [
        {
          "processo": "910456789",
          "nome": "PLENUS VIDA",
          "tipo_decisao": "indeferimento",
          "resultado_final": "indeferido_mantido",
          "fundamento": "art. 124, XIX — imitação de PLENUS (905123456)",
          "instancia_final": "2ª instância",
          "data_decisao_final": "2023-08-15",
          "peso_recencia": "ALTO",
          "spec_indeferida": "serviços de clínica médica; serviços de saúde",
          "spec_bloqueador": "serviços de clínica médica; assistência médica; serviços de saúde",
          "sobreposicao_specs": "DIRETA — ambas em serviços de saúde/clínica médica"
        }
      ],

      "padrao_identificado": "O INPI indeferiu PLENUS VIDA por colidência fonética com PLENUS na classe 44. Recurso negado em 2ª instância (2023). As specs dos dois processos são praticamente idênticas (serviços médicos). Ao mesmo tempo, 3 titulares distintos coexistem com radical plen- na mesma classe — indicando que o INPI permite convivência quando a similaridade não é extrema.",

      "isonomia": {
        "direcao": "MISTA",
        "favoravel": "3 titulares coexistem com plen- na classe 44 → INPI aceita alguma convivência",
        "desfavoravel": "PLENUS VIDA (muito similar a PLENUS) foi barrada em 2ª instância → INPI bloqueia quando a proximidade é alta",
        "aplicacao_plenya": "Plenya está entre os dois cenários: mais distante de PLENUS que PLENUS VIDA (sufixo -ya vs -us), mas compartilha radical plen-. O risco depende da sobreposição de specs."
      },

      "recomendacao": "Especificar atividade de Plenya de forma restrita para minimizar sobreposição com PLENUS. Invocar desgaste parcial do radical plen- e diferença gráfica/fonética do sufixo."
    },
    {
      "classe": 42,
      "radical_analisado": "plen-",

      "decisoes": [],

      "padrao_identificado": "Nenhuma decisão de indeferimento para radical plen- na classe 42. 2 titulares distintos coexistem (PLENA TECH, PLENSOFT). Campo livre.",

      "isonomia": {
        "direcao": "FAVORÁVEL",
        "favoravel": "Coexistência aceita sem objeções. Sem precedentes negativos.",
        "desfavoravel": null,
        "aplicacao_plenya": "Cenário favorável para registro de Plenya na classe 42."
      },

      "recomendacao": "Depositar com confiança na classe 42."
    }
  ],

  "isonomia_global": {
    "direcao": "MISTA",
    "resumo": "Classe 44: risco moderado-alto por precedente de indeferimento mantido (PLENUS VIDA), atenuado por convivência parcial. Classe 41: favorável (sem precedentes negativos). Classe 42: favorável (convivência comprovada). Classe 35: parcial (alta densidade em nichos distintos).",
    "peso_decisao_mais_relevante": {
      "processo": "910456789",
      "decisao": "indeferido_mantido em 2ª instância",
      "data": "2023-08-15",
      "porque_relevante": "Decisão recente, 2ª instância, radical idêntico ao nosso, mesma classe nuclear"
    }
  }
}
```

---

## Edge Cases

### Sem nenhum precedente de indeferimento nos dados
→ `isonomia.direcao: "FAVORÁVEL"`
→ "Ausência de indeferimento para radical similar = campo livre"
→ MAS ponderar: pode ser porque ninguém tentou, não porque o INPI aceita

### Precedentes contraditórios (indeferiu E aceitou no mesmo cluster)
→ `isonomia.direcao: "MISTA"`
→ Detalhar ambos os cenários
→ Identificar o que diferencia os casos (spec? sufixo? data?)
→ Posicionar Plenya: "mais próxima do cenário X ou Y?"

### Todas as decisões são antigas (antes de 2020)
→ Registrar com peso BAIXO
→ Ponderar: "critérios do INPI podem ter mudado"
→ Não descartar, mas relativizar

### Bloqueador não coletado (não está no bloqueadores-fichas.json)
→ Registrar: "specs do bloqueador não disponíveis"
→ Não inventar specs
→ Analisar com o que tem (nome + classe)

### Indeferimento por motivo diferente de colidência (art. 124 VI — descritivo)
→ NÃO aplicar isonomia de colidência
→ MAS registrar: "INPI considerou o termo descritivo nesta classe"
→ Isso é relevante: se termos com plen- são considerados descritivos → proteção menor → bom para Plenya (marca fantasiosa tem proteção maior que descritiva)

---

## Proibições

- ❌ NUNCA inventar decisões que não constam nos dados
- ❌ NUNCA inventar datas de decisão
- ❌ NUNCA inventar specs de bloqueadores não coletados
- ❌ NUNCA afirmar isonomia sem citar o processo e a decisão de referência
- ❌ NUNCA simplificar cenário MISTO como FAVORÁVEL ou DESFAVORÁVEL — registrar a complexidade
- ❌ NUNCA omitir precedentes desfavoráveis para parecer otimista

---

## Success Output

```
Análise de decisões concluída — {marca}

Padrões por classe:
  Classe {N}: {padrão} — Isonomia {FAVORÁVEL / DESFAVORÁVEL / MISTA / NEUTRA}
  ...

Isonomia global: {FAVORÁVEL / DESFAVORÁVEL / MISTA}
Decisão mais relevante: {processo} ({decisão}, {data})
```

---

```yaml
metadata:
  version: 3.0.0
  squad: laudo-viabilidade
  fase: 4
  sub_agente: analista-decisoes
  modelo: opus
  input: [precedentes-cadeia.json, bloqueadores-fichas.json, mapa-coexistencia.json]
  output: precedentes-analise.json
  tags: [decisoes, isonomia, padroes, precedentes, bloqueadores]
```
