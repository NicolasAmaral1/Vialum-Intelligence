---
name: Inteligência Marcária
description: Fase 1.5 — Análise de jurisprudência orbitante, coexistência, titulares e saturação para fundamentar defesa e estratégia de depósito.
---

# SKILL: Inteligência Marcária (Fase 1.5)

## Propósito

Você é um **especialista em Propriedade Intelectual e Estratégia Marcária**. Esta SKILL opera entre o Radar (Fase 1) e o Confronto (Fase 2), aprofundando a análise das candidatas para extrair inteligência jurídica e mercadológica que fundamenta a defesa do registro.

## Input

* `cases/[Cliente]/[Marca]/inpi-raw-processed.json` — fichas detalhadas com publicações e despachos
* `cases/[Cliente]/[Marca]/[Marca] - RADAR.json` — candidatas com scores
* Busca adicional no INPI (Playwright) — para fichas das marcas conflitantes citadas em indeferimentos

## Output

* `cases/[Cliente]/[Marca]/[Marca] - INTELIGENCIA.md` — relatório completo
* `cases/[Cliente]/[Marca]/[Marca] - INTELIGENCIA.json` — dados estruturados

---

## Módulo 1: Jurisprudência Orbitante

### O que faz
Para cada candidata/limítrofe com status "indeferido":
1. Extrai o motivo do indeferimento (campo `detalhes_indeferimento` ou `publicacoes`)
2. Identifica os processos conflitantes citados pelo INPI como razão do indeferimento
3. Busca a ficha completa dessas marcas conflitantes (Playwright)
4. Classifica: mantido em recurso / reformado / sem recurso
5. Verifica se a marca conflitante TAMBÉM conflita com o nosso cliente

### Cadeia de decisão
```
[Marca Indeferida] --barrada por--> [Marca Conflitante]
                                           |
                                    Conflita conosco? SIM/NÃO
                                    Status: Em vigor / Extinta / Indeferida
```

### Classificação de precedentes
- **FAVORÁVEL**: Marca similar à nossa foi indeferida mas reformada em recurso = INPI reconheceu coexistência
- **FAVORÁVEL**: Marca que barrou um concorrente nosso foi posteriormente extinta/arquivada = barreira removida
- **DESFAVORÁVEL**: Marca similar à nossa foi indeferida e mantida em recurso = INPI é firme
- **NEUTRO**: Sem recurso apresentado = posição padrão do INPI, mas não testada em grau superior

### Ameaças indiretas
Marcas que não são candidatas diretas do Radar mas que barraram concorrentes similares ao nosso cliente. Se essa marca está em vigor e tem specs sobrepostas, ela é uma ameaça que o Radar não capturou.

---

## Módulo 2: Mapa de Coexistência

### O que faz
Identifica pares de marcas que:
1. São similares entre si (fonética/gráfica)
2. Ambas estão em vigor
3. Estão na mesma classe

### Por que importa
Se o INPI permitiu que "BULL BURGER" e "FULL BURGER" coexistam na mesma classe com specs sobrepostas, isso é PRECEDENTE CONCRETO de que marcas com a estrutura "[X] BURGER" podem coexistir. Quanto mais pares de coexistência encontramos, mais forte a tese de marca fraca/diluída.

### Output
Lista de pares de coexistência com:
- Nomes das duas marcas
- Processos
- Classes
- Specs sobrepostas
- Grau de similaridade entre elas

---

## Módulo 3: Análise de Titulares

### O que faz
Mapeia os titulares das candidatas e limítrofes para identificar:
1. **Tubarões**: Titulares com 2+ marcas no segmento — tendem a opor novos registros
2. **Pessoas físicas vs jurídicas**: PF geralmente não opõe; PJ com departamento jurídico sim
3. **Concentração**: Um titular domina o campo? Ou é pulverizado?

### Por que importa
Se um único titular possui 5 marcas com "Burger" e costuma opor, é uma ameaça real. Se são 50 titulares diferentes, ninguém tem força para bloquear.

---

## Módulo 4: Timeline de Saturação

### O que faz
Agrupa os depósitos das marcas similares por ano para mostrar a evolução da saturação:
- Quantas marcas com "Burger" foram depositadas por ano?
- Quantas com radicais próximos a "Will"?
- Há tendência de crescimento? (mais saturado = mais fraco = mais fácil registrar)

### Por que importa
Um gráfico mostrando que 200+ marcas com "Burger" foram depositadas nos últimos 5 anos demonstra empiricamente que o termo é diluído e não merece proteção exclusiva.

---

## Formato do INTELIGENCIA.json

```json
{
  "marca_cliente": "Will's Burger",
  "data_analise": "29/03/2026",
  "jurisprudencia": {
    "indeferidos_analisados": 8,
    "precedentes_favoraveis": [...],
    "precedentes_desfavoraveis": [...],
    "ameacas_indiretas": [...],
    "cadeias": [
      {
        "marca_indeferida": "Willa's Burger DELIVERY",
        "processo_indeferido": "917415604",
        "marca_conflitante": "XXXXXXX",
        "processo_conflitante": "XXXXXXX",
        "specs_conflitante": "...",
        "status_conflitante": "Em vigor",
        "conflita_conosco": true,
        "resultado_recurso": "sem recurso",
        "classificacao": "DESFAVORÁVEL"
      }
    ]
  },
  "coexistencia": {
    "pares_encontrados": 15,
    "pares": [
      {
        "marca_a": "BULL BURGER",
        "processo_a": "...",
        "marca_b": "FULL BURGER",
        "processo_b": "...",
        "classe": 43,
        "similaridade": 0.78
      }
    ]
  },
  "titulares": {
    "total_unicos": 180,
    "tubaroes": [...],
    "concentracao": "pulverizada"
  },
  "saturacao": {
    "por_ano": {"2020": 45, "2021": 52, ...},
    "tendencia": "crescente"
  }
}
```
