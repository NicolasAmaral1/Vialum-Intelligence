# Task: Analista de Coexistência — Mapa de Desgaste (Fase 3C)

> **Sub-agente:** @analista-coexistencia
> **Modelo:** Sonnet
> **Fase:** 3C — Mapa de coexistência e desgaste
> **Invocado por:** @laudo (Mira)
> **Depende de:** Fase 3A (specs) e Fase 3B (precedentes) — roda após ambas

---

## Purpose

Determinar se o INPI trata o radical/elemento comum da nossa marca como
**desgastado** (aceita convivência de múltiplos titulares) ou **protegido**
(bloqueia marcas similares).

Isso é feito agrupando TODAS as marcas (vivas + indeferidas + mortas) por
radical/elemento comum e cruzando convivência com indeferimentos.

O resultado é evidência concreta para os argumentos do laudo:
- Se desgastado → "o INPI aceita convivência, portanto Plenya deve ser aceita"
- Se protegido → "o INPI bloqueia, portanto Plenya tem risco"

---

## Prerequisites

- `coleta/bucket-a-vivas.json` (TODAS as vivas — não só as filtradas pela peneira)
- `precedentes/precedentes-cadeia.json` (cadeias de bloqueio com resultados)
- `specs/specs-completas.json` (specs das vivas filtradas, se disponível)
- `coleta/bucket-b-indeferidas.json` (para contexto)
- `coleta/bucket-c-mortas.json` (para contexto)
- Dados do caso: `nome_marca`, `classes_aprovadas`

---

## Execution Mode

**Automático.** Analisa todos os dados e gera mapa de coexistência.

---

## Passos de Execução

### Passo 1: Identificar o radical/elemento da nossa marca

Analisar `nome_marca` e extrair:
- **Radical:** primeiras letras que formam o núcleo do nome (ex: "Plenya" → "plen-")
- **Campo semântico:** conceito evocado (ex: "plenitude", "completo")
- **Variações previsíveis:** grafias alternativas que o INPI captura (plen, plenn, pleny, plena)

### Passo 2: Agrupar TODAS as marcas por proximidade com nosso radical

Percorrer os 3 buckets (A, B, C) e as cadeias de precedentes.
Agrupar marcas que compartilham:
- Mesmo radical/prefixo (ex: "plen-" → PLENUS, PLENNUS, PLENA, PLENYA)
- Mesmo campo semântico (ex: variações de "pleno/plena/plenitude")
- Mesma raiz com sufixos diferentes

Cada marca pode pertencer a mais de um cluster se tiver múltiplas similaridades.

**Agrupar por classe:** cada cluster é específico de uma classe NCL.
"PLENUS" na classe 44 e "PLENUS" na classe 42 são clusters diferentes.

### Passo 3: Para cada cluster, analisar convivência

**REGRA CRÍTICA: Só marcas JULGADAS contam como prova de coexistência.**
- CONTAM: "Registro de marca em vigor", "Deferido" — o INPI JULGOU e ACEITOU
- NÃO CONTAM: "Aguardando exame", "Aguardando oposição", "Em exame" — pipeline, não prova
- Marcas em processo: listar separadamente como contexto, NUNCA como prova de coexistência
- Cada marca citada DEVE ter classe + especificação COMPLETA (sem spec = análise pobre)

**Contar titulares distintos com marcas JULGADAS (em vigor/deferidas):**
- Titular A tem "PLENUS" em vigor → 1
- Titular B tem "PLENNUS SAÚDE" em vigor → 2
- Titular C tem "PLENA VIDA" em vigor → 3
- Titular A tem "PLENUS MED" em vigor → ainda 3 (mesmo titular)
- Titular D tem "PLENNA X" aguardando exame → NÃO CONTA (não julgada)

**Contar indeferimentos no cluster:**
- Quantas marcas do cluster foram indeferidas?
- Por quem? (bloqueador está no cluster?)
- Resultado do recurso?

**Contar extintas no cluster:**
- Quantas morreram?
- Morreram após indeferimento? Ou por caducidade?

### Passo 4: Emitir parecer de desgaste

| Cenário | Parecer | Justificativa |
|---------|---------|---------------|
| ≥ 5 titulares distintos vivos, sem indeferimento no cluster | **FAVORÁVEL** | Ampla convivência aceita pelo INPI. Termo claramente desgastado. |
| 3-4 titulares distintos vivos, sem indeferimento | **FAVORÁVEL** | Convivência comprovada. Forte evidência de desgaste. |
| 2+ titulares vivos + indeferimento REFORMADO em recurso | **FAVORÁVEL** | INPI em 2ª instância aceitou convivência apesar de indeferimento em 1ª. |
| 2+ titulares vivos + indeferimento MANTIDO no cluster | **PARCIAL** | Convivência existe, mas INPI bloqueou quando similaridade é muito alta. Desgaste do radical, mas não da marca idêntica. |
| 1-2 titulares + múltiplos indeferimentos mantidos | **DESFAVORÁVEL** | INPI protege o termo. Não há convivência relevante. |
| Poucas marcas no cluster (< 3 total) | **INCONCLUSIVO** | Base insuficiente para determinar padrão. |

### Passo 5: Avaliar impacto específico para a nossa marca

Para cada cluster, responder:
- "Considerando o desgaste (ou falta dele), qual o impacto para {nossa_marca}?"
- Usar dados concretos: "4 titulares convivem, mas PLENUS VIDA foi barrada por PLENUS — Plenya é mais próxima de PLENUS VIDA que de PLENUS, logo risco é alto neste cluster"

---

## Output — Schema Formal

Arquivo: `coexistencia/mapa-coexistencia.json`

```json
{
  "marca_analisada": "Plenya",
  "radical_principal": "plen-",
  "data_analise": "2026-03-30T15:00:00Z",

  "clusters": [
    {
      "radical": "plen-",
      "classe": 44,

      "marcas_vivas": [
        {
          "processo": "905123456",
          "nome": "PLENUS",
          "titular": "PLENUS SAUDE LTDA",
          "situacao": "Registro de marca em vigor"
        },
        {
          "processo": "920111222",
          "nome": "PLENNUS SAÚDE",
          "titular": "OUTRO TITULAR LTDA",
          "situacao": "Registro de marca em vigor"
        },
        {
          "processo": "930333444",
          "nome": "PLENA VIDA",
          "titular": "TERCEIRO TITULAR ME",
          "situacao": "Pedido de registro"
        }
      ],
      "titulares_distintos_vivos": 3,

      "marcas_indeferidas": [
        {
          "processo": "910456789",
          "nome": "PLENUS VIDA",
          "resultado_final": "indeferido_mantido",
          "bloqueador": "905123456 (PLENUS)",
          "recurso": "negado"
        }
      ],

      "marcas_extintas": [
        {
          "processo": "900888777",
          "nome": "PLEN CARE",
          "resultado_final": "extinto_apos_indeferimento"
        }
      ],

      "desgaste": "PARCIAL",
      "justificativa": "3 titulares distintos coexistem com radical plen- na classe 44 (PLENUS, PLENNUS SAÚDE, PLENA VIDA), o que indica aceitação parcial de convivência. Porém, PLENUS VIDA foi indeferida por colidência com PLENUS e o recurso foi negado — o INPI protege quando a similaridade fonética é muito alta. 1 marca extinta após indeferimento reforça o padrão.",

      "impacto_plenya": "Risco MODERADO-ALTO. Plenya compartilha radical plen- e campo semântico de plenitude. O desgaste parcial favorece a tese de convivência, mas a decisão mantida contra PLENUS VIDA (ainda mais similar que Plenya a PLENUS) sugere que o INPI pode barrar. Estratégia: delimitar especificações para evitar sobreposição com PLENUS."
    },
    {
      "radical": "plen-",
      "classe": 42,

      "marcas_vivas": [
        {
          "processo": "915777888",
          "nome": "PLENA TECH",
          "titular": "TITULAR E LTDA",
          "situacao": "Registro de marca em vigor"
        },
        {
          "processo": "925999000",
          "nome": "PLENSOFT",
          "titular": "TITULAR F ME",
          "situacao": "Registro de marca em vigor"
        }
      ],
      "titulares_distintos_vivos": 2,

      "marcas_indeferidas": [],
      "marcas_extintas": [],

      "desgaste": "FAVORÁVEL",
      "justificativa": "2 titulares distintos coexistem com radical plen- na classe 42, sem nenhum indeferimento no cluster. Campo aberto para registro.",

      "impacto_plenya": "Risco BAIXO. Cenário favorável para registro de Plenya na classe 42."
    }
  ],

  "resumo_desgaste": {
    "44": "PARCIAL — convivência existe mas com indeferimentos pontuais",
    "41": "FAVORÁVEL — campo livre, sem precedentes negativos",
    "42": "FAVORÁVEL — coexistência aceita",
    "35": "PARCIAL — alta densidade mas em nichos distintos"
  }
}
```

---

## Edge Cases

### Radical pouco comum (< 3 marcas no total)
→ `desgaste: "INCONCLUSIVO"`
→ Registrar: "Base insuficiente — poucas marcas com este radical nesta classe"
→ Isso é informação válida: radical raro = marca forte (menos conflito)

### Todos os titulares são o mesmo
→ Não conta como convivência. 1 titular com 5 marcas ≠ 5 titulares distintos.
→ Registrar o número real de titulares distintos.

### Marca sem titular definido
→ Contar como titular único ("TITULAR NÃO IDENTIFICADO-{processo}")
→ Conservador: pode ser um titular diferente.

### Cluster com marcas em classes adjacentes
→ Manter clusters separados por classe.
→ Mas no campo `impacto_plenya`, mencionar se o desgaste é consistente entre classes.

### Bloqueador que não está nos nossos dados de busca
→ Mencioná-lo na cadeia mas sem dados completos.
→ Notar: "specs do bloqueador não disponíveis — não coletado na busca"

---

## Proibições

- ❌ NUNCA inventar marcas que não existem nos buckets ou cadeias
- ❌ NUNCA inventar titulares
- ❌ NUNCA afirmar desgaste sem dados concretos (processos + nomes)
- ❌ NUNCA omitir indeferimentos do cluster — se houve, registrar
- ❌ NUNCA confundir número de titulares com número de marcas

---

## Success Output

```
Mapa de coexistência concluído — {marca}

Clusters identificados: {n}
Desgaste por classe:
  Classe {N}: {FAVORÁVEL / PARCIAL / DESFAVORÁVEL / INCONCLUSIVO}
  ...
```

---

```yaml
metadata:
  version: 3.0.0
  squad: laudo-viabilidade
  fase: 3C
  sub_agente: analista-coexistencia
  modelo: sonnet
  input: [bucket-a-vivas.json, precedentes-cadeia.json, specs-completas.json]
  output: mapa-coexistencia.json
  tags: [coexistencia, desgaste, radical, titulares, convivencia]
```
