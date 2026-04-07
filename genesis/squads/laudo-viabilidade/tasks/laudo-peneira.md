# Task: Peneira — Classificação em 3 Níveis (Fase 2)

> **Sub-agente:** @peneira
> **Modelo:** Haiku
> **Fase:** 2 — Peneira
> **Invocado por:** @laudo (Mira)

---

## Purpose

Classificar CADA marca coletada na Fase 1 em 3 níveis de risco. É o primeiro
filtro inteligente do pipeline — decide quais marcas merecem busca de
especificação completa (Fases 3A/3B) e quais são descartadas.

A peneira trabalha APENAS com dados básicos (nome, classe, situação, titular).
NÃO tem acesso a especificações (ainda não foram coletadas).

---

## Prerequisites

Arquivos obrigatórios na pasta do caso:
- `coleta/bucket-a-vivas.json`
- `coleta/bucket-b-indeferidas.json`
- `coleta/bucket-c-mortas.json`

Dados do caso (recebidos no prompt):
- `nome_marca`: nome da marca em análise (ex: "Plenya")
- `atividade`: descrição da atividade do cliente
- `classes_aprovadas`: lista de classes NCL aprovadas
- `tipo_marca`: FANTASIOSO / EVOCATIVO / ARBITRÁRIO / DESCRITIVO

---

## Execution Mode

**Automático, sem interação humana.** Processa todas as marcas e retorna resultado.

Se o volume for alto (>100 marcas em um bucket), processar em lotes de 50
e retornar resultado consolidado.

---

## Dados de Entrada — Formato

Cada marca nos buckets tem esta estrutura:
```json
{
  "numero_processo": "940215020",
  "nome_marca": "PLENNUS SAÚDE",
  "situacao": "Registro de marca em vigor",
  "titular": "PLENNUS LTDA",
  "classe": 44,
  "similaridade_pct": 72,
  "bucket": "A",
  "fonte": "classe-44-pagina-1"
}
```

---

## Classificação — 3 Níveis

### Para Bucket A (marcas vivas)

Para cada marca, responder à pergunta:

> **"Se essa marca — '{nome_marca}' na classe {classe} — tivesse exatamente
> a mesma atividade e especificações que o nosso cliente pretende ({atividade}),
> traria problemas de colidência com '{nossa_marca}'?"**

A resposta determina o nível:

| Nível | Nome | Critério | Consequência |
|-------|------|----------|-------------|
| **1** | **Candidata** | Risco EVIDENTE. Nome muito similar em pelo menos 2 dimensões (fonética, gráfica, ideológica) E classe é a mesma ou diretamente relevante à atividade. | Busca spec → Cotejo completo → Seção individual no relatório |
| **2** | **Zona de Atenção** | Risco POSSÍVEL. Nome parcialmente similar (1 dimensão), OU classe adjacente, OU campo semântico ambíguo. Precisa ver spec para confirmar. | Busca spec → Cotejo completo → Seção individual no relatório |
| **3** | **Descartada** | Sem risco relevante. Nome muito diferente E/OU classe completamente sem afinidade com a atividade. | NÃO busca spec → Tabela de descartadas no relatório com justificativa |

### Para Bucket B + C (indeferidas + mortas)

Para cada marca, responder à pergunta:

> **"Essa marca — '{nome_marca}' na classe {classe}, com situação '{situacao}' —
> pode ser relevante como precedente para entender como o INPI trata termos
> similares a '{nossa_marca}' nesta classe?"**

Mesma classificação em 3 níveis:

| Nível | Critério |
|-------|----------|
| **1** | Nome muito similar + mesma classe. Precedente forte: saber o que aconteceu com essa marca é essencial. |
| **2** | Nome parcialmente similar OU classe adjacente. Pode revelar padrão do INPI. |
| **3** | Sem similaridade relevante. Não agrega como precedente. |

---

## Regras da Peneira

### Regra 1: Ultra-permissiva
- Na dúvida entre nível 2 e 3 → **escolhe 2** (Zona de Atenção)
- Na dúvida entre nível 1 e 2 → **escolhe 1** (Candidata)
- É MUITO melhor incluir uma marca irrelevante (falso positivo) do que perder uma colidência real (falso negativo)

### Regra 2: Análise rápida das 3 dimensões de similaridade
Para cada marca, avaliar rapidamente (sem score numérico):

- **Fonética:** Os nomes soam parecidos quando falados em voz alta?
  - "Plenya" vs "Plennus" → SIM (mesmo início "plen-", mesma tônica)
  - "Plenya" vs "Planitudo" → NÃO

- **Gráfica:** A sequência de letras é visualmente similar?
  - "Plenya" vs "Plenya Saúde" → SIM (contém o nome inteiro)
  - "Plenya" vs "PYL" → NÃO

- **Ideológica:** Evocam ideias semelhantes?
  - "Plenya" vs "Plena Vida" → SIM (ambas evocam plenitude)
  - "Plenya" vs "Phoenix" → NÃO

Se QUALQUER dimensão for "SIM" → no mínimo nível 2.
Se DUAS ou mais dimensões forem "SIM" + classe relevante → nível 1.

### Regra 3: Guia de adjacência (descarte automático por classe)

Antes de a IA analisar, aplicar o **guia de adjacência** gerado pela Mira na Fase P
(salvo em `coleta/guia-adjacencia.json`). O guia classifica cada classe NCL em 3 grupos:

- **Aprovadas + Adjacentes:** IA analisa normalmente (decide nível 1, 2 ou 3)
- **Sem afinidade:** descarte AUTOMÁTICO (nível 3) SEM gastar IA

**Exceção:** Se o nome da marca em classe sem afinidade for IDÊNTICO ou QUASE IDÊNTICO
à nossa marca (fonética ALTA + gráfica ALTA), sobe para nível 2.
Ex: "PLENYA" na classe 12 (veículos) → nível 2 pelo nome, apesar da classe.

O guia é gerado por caso (cada atividade tem classes adjacentes diferentes).
Ver: `resources/know-how/guia-adjacencia-classes.md` para referência.

### Regra 4: Marcas de alto renome
Se a marca analisada for reconhecidamente de alto renome (ex: marcas globais
amplamente conhecidas) E tiver o MÍNIMO de proximidade de nome com a nossa:
→ **Nível 1 automaticamente**
→ Adicionar flag `alto_renome_proximidade: true`

Marcas de alto renome são protegidas em TODAS as classes (art. 125 LPI).

### Regra 5: Marcas mistas
Se a marca for mista (nominativa + figurativa), analisar APENAS o elemento
nominativo. Ignorar o elemento figurativo para fins de classificação.

### Regra 6: Reprodução com acréscimo
Se a marca candidata CONTÉM o nome inteiro da nossa marca (ex: "PLENYA SAÚDE"
contém "PLENYA") → **Nível 1 automaticamente**, independente da classe.
Isso configura potencial reprodução com acréscimo (art. 124, XIX LPI).

### Regra 8: Classe desconhecida
Se a marca tem `classe_desconhecida: true` (veio da busca geral sem filtro de classe)
E tem similaridade de nome (qualquer dimensão):
→ **No mínimo nível 2** — precisa buscar spec para descobrir a classe real.
→ NUNCA descartar marca com classe desconhecida se o nome for similar.

### Regra 7: Bucket B+C mais permissivo
A peneira de precedentes é MAIS permissiva que a de vivas.
Para vivas, precisamos saber se é ameaça concreta.
Para mortas/indeferidas, qualquer indício de padrão do INPI é valioso.

---

## Output — Schema Formal

Arquivo: `peneira/peneira-resultado.json`

```json
{
  "marca_analisada": "Plenya",
  "atividade": "Serviços médicos, bem-estar, nutrição...",
  "classes_aprovadas": [44, 41, 42, 35],
  "tipo_marca": "FANTASIOSO/EVOCATIVO",
  "data_peneira": "2026-03-30T14:30:00Z",

  "vivas": {
    "nivel_1_candidatas": [
      {
        "numero_processo": "940215020",
        "nome_marca": "PLENNUS SAÚDE",
        "classe": 44,
        "nivel": 1,
        "justificativa": "Fonética alta (plen- idêntico), gráfica média, ideológica alta (ambas evocam plenitude). Classe 44 = mesma atividade."
      }
    ],
    "nivel_2_zona_atencao": [
      {
        "numero_processo": "920111222",
        "nome_marca": "PLENVIT",
        "classe": 44,
        "nivel": 2,
        "justificativa": "Fonética média (radical plen- comum, sufixo distinto). Classe 44 relevante. Precisa ver spec para confirmar."
      }
    ],
    "nivel_3_descartadas": [
      {
        "numero_processo": "935777888",
        "nome_marca": "PLANITUDO",
        "classe": 12,
        "nivel": 3,
        "justificativa": "Sem similaridade fonética/gráfica. Classe 12 (veículos) sem afinidade com saúde."
      }
    ]
  },

  "precedentes": {
    "nivel_1_candidatas": [],
    "nivel_2_zona_atencao": [],
    "nivel_3_descartadas": []
  },

  "listas_para_proximas_fases": {
    "processos_para_specs": ["940215020", "920111222"],
    "processos_para_precedentes": ["910456789", "905111222"]
  },

  "estatisticas": {
    "bucket_a_total": 89,
    "bucket_b_total": 22,
    "bucket_c_total": 50,
    "total_analisadas": 161,
    "vivas_nivel_1": 12,
    "vivas_nivel_2": 23,
    "vivas_nivel_3": 54,
    "precedentes_nivel_1": 8,
    "precedentes_nivel_2": 14,
    "precedentes_nivel_3": 50,
    "total_para_specs": 35,
    "total_para_precedentes": 22
  }
}
```

### Campos obrigatórios por marca classificada

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `numero_processo` | string | SIM | Número do processo INPI |
| `nome_marca` | string | SIM | Nome da marca (copiado do bucket) |
| `classe` | int | SIM | Classe NCL |
| `nivel` | int (1, 2, 3) | SIM | Nível de classificação |
| `justificativa` | string | SIM | 1-2 frases explicando o porquê do nível |
| `alto_renome_proximidade` | bool | NÃO | Flag se marca de alto renome com proximidade |

---

## Edge Cases

### Marca sem nome (nome_marca = null)
→ Nível 3 (descartada). Justificativa: "Nome não disponível na listagem do INPI."

### Marca sem situação (situacao = null)
→ Tratar como Bucket A (viva) — conservador.
→ Classificar normalmente pela similaridade do nome.

### Marca com nome idêntico ao nosso
→ **Nível 1 obrigatório**, qualquer que seja a classe.
→ Justificativa: "Nome idêntico à marca em análise."

### Marca com nome contendo o nosso inteiramente
→ **Nível 1 obrigatório** (Regra 6 — reprodução com acréscimo).

### Classe 0 ou None (marca da busca geral sem classe definida)
→ Não descartar por classe. Classificar pela similaridade do nome.
→ Se nome é similar (nível 1 ou 2), manter. A classe será descoberta na spec.

### Volume muito alto (>200 marcas num bucket)
→ Processar em lotes de 50. Retornar resultado consolidado.
→ Manter a mesma qualidade — não apressar por causa do volume.

---

## Proibições

- ❌ NUNCA inventar número de processo. Copiar do bucket de input.
- ❌ NUNCA alterar o nome da marca. Copiar exatamente como está no bucket.
- ❌ NUNCA classificar como nível 3 na dúvida. Na dúvida, nível 2.
- ❌ NUNCA pular marcas. TODAS devem ser classificadas.
- ❌ NUNCA fazer análise de especificação (não existe ainda nesta fase).

---

## Atualização do fonte-bruta.json

Após a peneira, o @laudo (orquestrador) enriquece o fonte-bruta.json
adicionando a cada processo:

```json
{
  "peneira": {
    "nivel": 1,
    "justificativa": "Fonética alta, classe relevante",
    "destino": "fase-3a-specs"
  }
}
```

Destinos possíveis:
- `"fase-3a-specs"` — nível 1 ou 2 de vivas
- `"fase-3b-precedentes"` — nível 1 ou 2 de indeferidas/mortas
- `"descartada"` — nível 3

---

## Success Output

```
Peneira concluída — {marca}

Vivas:     {n1} candidatas | {n2} zona de atenção | {n3} descartadas
Precedentes: {n1} candidatas | {n2} zona de atenção | {n3} descartadas

→ {total_specs} marcas seguem para coleta de specs (Fase 3A)
→ {total_prec} marcas seguem para análise de precedentes (Fase 3B)
```

---

```yaml
metadata:
  version: 3.0.0
  squad: laudo-viabilidade
  fase: 2
  sub_agente: peneira
  modelo: haiku
  input: [bucket-a-vivas.json, bucket-b-indeferidas.json, bucket-c-mortas.json]
  output: peneira-resultado.json
  principio: ultra-permissivo (falso positivo > falso negativo)
  tags: [peneira, classificacao, nivel-1, nivel-2, nivel-3, triagem]
```
