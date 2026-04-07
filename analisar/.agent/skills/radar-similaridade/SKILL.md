---
name: Radar de Similaridade
description: Triagem rápida de todas as marcas do INPI com scoring 0-100 para identificar candidatas a colidência por análise fonética, gráfica e ideológica. Fase de filtro antes da análise profunda.
---

# SKILL: Radar de Similaridade (Triagem de Colidências)

## Propósito

Você é um **especialista em Propriedade Intelectual**. Esta SKILL é a **primeira fase da análise de colidências**: um radar rápido que varre TODAS as marcas retornadas pelo INPI, atribui um **score de similaridade (0-100)** para cada uma, e decide se ela é uma **candidata a colidência** ou pode ser **descartada**.

O objetivo é **filtrar ruído** antes da análise profunda de especificações, gerando um panorama visual completo e auditável.

## Input

* `cases/[Cliente]/[Marca]/inpi-raw-processed.json` — JSON com todas as marcas do INPI
* `[Marca] - PLANO DE ANÁLISE.md` — Parte 1 já existente (para consultar a marca e atividade)

## Output

* `cases/[Cliente]/[Marca]/[Marca] - RADAR.md` — Relatório completo da triagem
* `cases/[Cliente]/[Marca]/[Marca] - RADAR.json` — Dados estruturados para geração visual

---

## Sistema de Scoring (0-100)

Cada marca recebe um **score composto** baseado nos 3 eixos:

### Pesos dos Eixos
| Eixo | Peso | Justificativa |
|------|------|---------------|
| Fonético | **40%** | Principal critério do INPI para confusão |
| Gráfico | **30%** | Visual é o segundo critério de confusão |
| Ideológico | **30%** | Conceito semântico completa a análise |

### Escala por Eixo (0-100)
| Score | Nível | Descrição |
|-------|-------|-----------|
| **80-100** | ALTA | Praticamente idêntico neste eixo |
| **50-79** | MÉDIA | Similaridade perceptível, requer atenção |
| **20-49** | BAIXA | Similaridade tênue, risco reduzido |
| **0-19** | NULA | Sem relação perceptível |

### Score Final Composto
```
Score = (Fonético × 0.40) + (Gráfico × 0.30) + (Ideológico × 0.30)
```

### Faixas de Decisão
| Score Final | Veredito | Ação |
|-------------|----------|------|
| **60-100** | CANDIDATA | Avança para Fase 2 |
| **35-59** | LIMÍTROFE | Avança por precaução |
| **0-34** | DESCARTADA | Eliminada da análise profunda |

---

## Critérios de Avaliação por Eixo

### 1. Similaridade FONÉTICA (peso 40%)
- Sons similares ao pronunciar? (ex: "Wills" vs "Willis", "Burger" vs "Burguer")
- Considere sotaque brasileiro, reduções vocálicas, consoantes mudas
- Radicais compartilhados contam (ex: "WILL" presente em ambas)
- **90-100**: Pronúncia idêntica ou quase (ex: "Will's" vs "Wills")
- **70-89**: Radical principal idêntico + diferença menor (ex: "Will's Burger" vs "Williams Burger")
- **50-69**: Radical similar mas distinguível (ex: "Will's" vs "Wilson")
- **20-49**: Alguma semelhança fonética parcial
- **0-19**: Sem relação sonora

### 2. Similaridade GRÁFICA (peso 30%)
- Escrita visual parecida? (ex: "Will's" vs "Wills" vs "Wil's")
- Considere: letras trocadas, apóstrofos, hífens, acentos, caixa alta/baixa
- Marcas curtas com 1-2 letras de diferença = alta similaridade gráfica
- **90-100**: Escrita praticamente idêntica
- **70-89**: Muito parecida, diferença em 1-2 caracteres
- **50-69**: Radical gráfico compartilhado
- **20-49**: Alguma semelhança visual parcial
- **0-19**: Escrita totalmente diferente

### 3. Similaridade IDEOLÓGICA (peso 30%)
- Evocam o mesmo conceito, ideia ou imagem mental?
- Traduções, sinônimos, alusões ao mesmo universo semântico
- **90-100**: Mesmo conceito (ex: "Burger King" vs "Rei do Hambúrguer")
- **70-89**: Conceitos muito próximos (ex: "Burger House" vs "Casa do Burger")
- **50-69**: Mesmo campo semântico (ex: "Will's Burger" vs "John's Grill")
- **20-49**: Campo semântico tangencialmente relacionado
- **0-19**: Conceitos sem relação

---

## Regras Especiais

### Regra de Ouro
> **Na dúvida, inclua.** O radar é um filtro largo. O afunilamento real acontece na Fase 2 com as especificações. Aqui o erro grave é descartar uma marca que depois se revela colidência.

### Critérios Automáticos de Descarte (safe-list)
Marcar como DESCARTADA (score 0) automaticamente se:
- Status "Extinto" ou "Arquivado definitivamente" (mortas, sem efeito jurídico)
- A marca não compartilha **nenhum** radical, fonema ou conceito com a marca do cliente

### ⚠️ NÃO descartar automaticamente:
- Marcas com mesmo radical, mesmo que em segmento diferente
- Marcas com status "Indeferido" mas em recurso
- Marcas com similaridade fonética mesmo que graficamente diferentes

---

## Formato do RADAR.json (dados estruturados)

```json
{
  "marca_cliente": "Will's Burger",
  "data_analise": "28/03/2026",
  "total_marcas": 25,
  "resumo": {
    "candidatas": 5,
    "limitrofes": 3,
    "descartadas": 17
  },
  "marcas": [
    {
      "nome": "WILLS BURGUER",
      "processo": "000000000",
      "titular": "Fulano de Tal",
      "status": "Registro de marca em vigor",
      "scores": {
        "fonetico": 95,
        "grafico": 90,
        "ideologico": 95
      },
      "score_final": 93,
      "veredito": "CANDIDATA",
      "justificativa": {
        "fonetico": "Pronúncia idêntica — 'Wills Burguer' é foneticamente igual a 'Will's Burger'",
        "grafico": "Escrita muito similar — diferença apenas no apóstrofo e grafia 'ue' vs 'er'",
        "ideologico": "Mesmo conceito — hamburgueria associada ao nome Will"
      },
      "especificacoes": "Serviços de restaurantes, lanchonetes..."
    }
  ]
}
```

---

## Formato do RADAR.md (relat��rio visual)

```markdown
# [MARCA] - RADAR DE SIMILARIDADE

**Marca Analisada:** [Marca do cliente]
**Data:** [Data atual]
**Total de marcas na base:** [N]
**Candidatas:** [N] | **Limítrofes:** [N] | **Descartadas:** [N]

---

## RESUMO EXECUTIVO

[Parágrafo breve: quantas marcas foram analisadas, quantas passaram o radar, principais clusters de risco identificados]

---

## PANORAMA COMPLETO (todas as marcas, ordenadas por score)

| # | Marca | Processo | Score | Fon. | Grá. | Ide. | Veredito |
|---|-------|----------|-------|------|------|------|----------|
| 1 | **WILLS BURGUER** | 000000000 | **93** | 95 | 90 | 95 | CANDIDATA |
| 2 | **WILL BURGER** | 000000001 | **88** | 90 | 85 | 90 | CANDIDATA |
| 3 | WILLIS FOOD | 000000002 | **45** | 60 | 50 | 20 | LIMÍTROFE |
| 4 | MEGA BURGER | 000000003 | **32** | 10 | 10 | 70 | DESCARTADA |
| ... | ... | ... | ... | ... | ... | ... | ... |

> Tabela ordenada por score decrescente. Todas as marcas presentes — nenhuma omitida.

---

## DETALHAMENTO: CANDIDATAS (score >= 60)

### 1. WILLS BURGUER (Proc. 000000000) — Score: 93
**Titular:** Fulano de Tal | **Status:** Em vigor
- **Fonético (95):** Pronúncia idêntica — 'Wills Burguer' = 'Will's Burger'
- **Gráfico (90):** Diferença apenas no apóstrofo e 'ue' vs 'er'
- **Ideológico (95):** Mesmo conceito — hamburgueria + nome Will
- **Especificações:** [Copiar na íntegra do JSON]

[Repetir para cada candidata]

---

## DETALHAMENTO: LIMÍTROFES (score 35-59)

### 1. WILLIS FOOD (Proc. 000000002) — Score: 45
**Titular:** Ciclano | **Status:** Em vigor
- **Motivo da inclusão:** Radical "WILL" próximo foneticamente, mesmo universo alimentício
- **Especificações:** [Se disponível]

---

## DESCARTADAS (score < 35)

| # | Marca | Processo | Score | Motivo do Descarte |
|---|-------|----------|-------|--------------------|
| 1 | MEGA BURGER | 000000003 | 32 | Sem sobreposição fonética/gráfica com "Will's" — "Burger" é termo genérico |
| 2 | ... | ... | ... | ... |

---

## PRÓXIMO PASSO

As [N] marcas candidatas e [N] limítrofes (total: [N]) serão submetidas à **Fase 2: Confronto de Especificações**.
```

---

## Execução Passo a Passo

1. **Leia o JSON integralmente** — Carregue todas as marcas do `inpi-raw-processed.json`
2. **Leia a Parte 1 do Plano** — Extraia a marca do cliente e a atividade descrita
3. **Para cada marca no JSON:**
   a. Atribua score fonético (0-100)
   b. Atribua score gráfico (0-100)
   c. Atribua score ideológico (0-100)
   d. Calcule score final composto
   e. Determine veredito pela faixa
   f. Registre justificativa por eixo
4. **Ordene por score decrescente**
5. **Monte o RADAR.json** com todos os dados estruturados
6. **Monte o RADAR.md** com o relatório visual
7. **Salve ambos** na pasta do caso
8. **Apresente ao usuário** o resumo executivo e a tabela panorâmica

### ⚠️ AUDITABILIDADE
- Toda marca que apareceu na busca DEVE estar no relatório (`.md`) E no JSON (`.json`)
- **Nenhuma marca pode sumir.** Ambos os arquivos são prova de que todas foram avaliadas.
- O JSON é a fonte de verdade para geração visual automatizada.

---

## Dicas de Performance

- Se houver muitas marcas (50+), agrupe as descartadas por motivo em vez de justificar uma a uma
- Foque a justificativa detalhada nas candidatas e limítrofes
- Se uma marca tem especificação disponível no JSON, já copie para o relatório (economiza tempo na Fase 2)
