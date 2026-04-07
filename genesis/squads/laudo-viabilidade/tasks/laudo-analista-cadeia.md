# Task: Analista de Cadeia — Extração de Precedentes (Fase 3B.2)

> **Sub-agente:** @analista-cadeia
> **Modelo:** Sonnet
> **Fase:** 3B.2 — Análise de cadeia de bloqueio
> **Invocado por:** @laudo (Mira)

---

## Purpose

Ler os despachos (histórico de decisões) de marcas indeferidas e mortas
coletadas na Fase 3B.1 e extrair informação estruturada:

1. **Motivo** do indeferimento (artigo da LPI, fundamento)
2. **Quem bloqueou** (número de processo e nome da marca responsável)
3. **Se houve recurso** e qual o resultado
4. **Classificação** do resultado final
5. **Fila de bloqueadores** para busca na Fase 3B.3 (com rastreabilidade)

---

## Prerequisites

- `precedentes/precedentes-fichas.json` (fichas completas com despachos, da Fase 3B.1)
- Dados do caso: `nome_marca`, `atividade`, `classes_aprovadas`

---

## Execution Mode

**Automático.** Processa todas as fichas e retorna resultado estruturado.

Se volume alto (>30 fichas): processar em lotes de 15.

---

## Dados de Entrada

Cada ficha em `precedentes-fichas.json` tem:
```json
{
  "numero_processo": "910456789",
  "nome_marca": "PLENUS VIDA",
  "classe": 44,
  "situacao": "Indeferido",
  "titular": "FULANO LTDA",
  "especificacao_completa": "serviços de clínica médica; serviços de saúde",
  "texto_bruto": "... (texto completo da ficha incluindo despachos) ...",
  "coletado_em": "2026-03-30T12:00:00Z"
}
```

O campo `texto_bruto` contém o histórico de despachos do INPI — uma lista
cronológica de decisões (datas, códigos de despacho, descrições).

---

## Passos de Execução

### Passo 1: Ler despachos de cada ficha

No `texto_bruto`, identificar a seção de despachos. O formato típico do INPI é:

```
Despachos:
Data         Despacho
15/03/2022   IPAS 003 - Exigência formulada...
22/09/2022   IPAS 039 - Indeferimento do pedido...
10/01/2023   IPAS 049 - Recurso interposto...
15/08/2023   IPAS 059 - Recurso negado...
```

Os códigos de despacho variam, mas os padrões comuns são:
- Exigência → marca teve objeção, pode ter citação de anterioridade
- Indeferimento → decisão final negativa
- Recurso → titular apelou
- Recurso provido/negado → decisão de 2ª instância

### Passo 2: Extrair informação estruturada

Para cada ficha, extrair:

**a) Motivo do indeferimento:**
- Buscar nos despachos: referências a artigos da LPI (art. 124, XIX; art. 124, VI; etc.)
- Buscar: menção a outra marca/processo como anterioridade
- Se não encontrar motivo explícito → registrar `"motivo_nao_disponivel"`
- **NUNCA inventar motivo que não consta nos despachos**

**b) Processo bloqueador:**
- Buscar nos despachos: números de processo citados (6-9 dígitos)
- Buscar: nomes de marca citados como anterioridade
- Se encontrar → registrar processo + nome
- Se não encontrar → registrar `"bloqueador_nao_identificado"`

**c) Recurso:**
- Buscar nos despachos: menção a recurso, apelação, 2ª instância
- Resultado: provido (reformado), negado (mantido), pendente, não houve

**d) Classificação do resultado final:**

| Código | Significado | Como identificar |
|--------|------------|-----------------|
| `indeferido_mantido` | Indeferido + recurso negado ou sem recurso | Último despacho = indeferimento ou recurso negado |
| `indeferido_reformado` | Indeferido + recurso provido (marca foi aceita) | Despacho de recurso provido/deferimento após indeferimento |
| `indeferido_pendente` | Indeferido + recurso em andamento | Despacho de recurso interposto sem decisão |
| `extinto_apos_indeferimento` | Foi indeferido e depois extinto | Despachos de indeferimento seguidos de extinção |
| `extinto_sem_indeferimento` | Morreu naturalmente (caducidade, não-renovação) | Sem despacho de indeferimento, só extinção |
| `arquivado_por_desistencia` | Titular desistiu do pedido | Despacho de desistência ou arquivamento por falta de cumprimento |
| `nao_classificavel` | Despachos insuficientes para determinar | Ficha sem despachos ou com despachos ilegíveis |

### Passo 3: Montar fila de bloqueadores

Para cada marca que teve um processo bloqueador identificado, criar entrada
na fila com **rastreabilidade completa**:

```json
{
  "processo": "905123456",
  "nome": "PLENUS",
  "buscado_porque": "Citado como anterioridade no indeferimento do processo 910456789 (PLENUS VIDA) na classe 44",
  "relevancia_para_caso": "Se PLENUS bloqueou PLENUS VIDA (radical plen-), pode bloquear Plenya na mesma classe",
  "processo_origem": "910456789",
  "nome_origem": "PLENUS VIDA",
  "classe_origem": 44,
  "nivel_cadeia": 1
}
```

---

## Output — Schema Formal

### Arquivo: `precedentes/precedentes-cadeia.json`

```json
{
  "marca_analisada": "Plenya",
  "data_analise": "2026-03-30T14:45:00Z",
  "total_fichas_analisadas": 22,

  "cadeias": [
    {
      "processo": "910456789",
      "nome_marca": "PLENUS VIDA",
      "classe": 44,
      "situacao_original": "Indeferido",
      "titular": "FULANO LTDA",
      "especificacao_completa": "serviços de clínica médica; serviços de saúde",

      "motivo_indeferimento": "art. 124, XIX — reprodução/imitação de marca anterior",
      "motivo_detalhado": "Indeferido por colidência fonética com marca PLENUS (processo 905123456) na classe 44",
      "artigo_lpi": "124, XIX",

      "bloqueador": {
        "processo": "905123456",
        "nome": "PLENUS",
        "identificado": true
      },

      "recurso": {
        "houve": true,
        "resultado": "negado",
        "data_recurso": "2023-01-10",
        "data_decisao_recurso": "2023-08-15",
        "instancia": "2ª instância"
      },

      "resultado_final": "indeferido_mantido",

      "despachos_extraidos": [
        {
          "data": "2022-03-10",
          "codigo": "IPAS 003",
          "descricao": "Exigência formulada — colidência com processo 905123456",
          "tipo": "exigencia"
        },
        {
          "data": "2022-09-15",
          "codigo": "IPAS 039",
          "descricao": "Indeferimento do pedido de registro",
          "tipo": "indeferimento"
        },
        {
          "data": "2023-01-10",
          "codigo": "IPAS 049",
          "descricao": "Recurso interposto pelo titular",
          "tipo": "recurso_interposto"
        },
        {
          "data": "2023-08-15",
          "codigo": "IPAS 059",
          "descricao": "Recurso negado — indeferimento mantido",
          "tipo": "recurso_negado"
        }
      ],

      "relevancia_para_caso": "ALTA — radical plen- bloqueado na classe 44. Isonomia desfavorável para Plenya."
    }
  ],

  "sem_despachos_detalhados": [
    {
      "processo": "900888777",
      "nome_marca": "PLEN SOFT",
      "classe": 42,
      "resultado_final": "nao_classificavel",
      "nota": "Ficha sem despachos detalhados — motivo de indeferimento não disponível"
    }
  ]
}
```

### Arquivo: `precedentes/fila-busca-bloqueadores.json`

```json
[
  {
    "processo": "905123456",
    "nome": "PLENUS",
    "buscado_porque": "Citado como anterioridade no indeferimento do processo 910456789 (PLENUS VIDA) na classe 44",
    "relevancia_para_caso": "Se PLENUS bloqueou PLENUS VIDA (radical plen-), pode bloquear Plenya na mesma classe",
    "processo_origem": "910456789",
    "nome_origem": "PLENUS VIDA",
    "classe_origem": 44,
    "nivel_cadeia": 1
  }
]
```

---

## Edge Cases

### Despachos ilegíveis ou ausentes
→ `resultado_final: "nao_classificavel"`
→ `motivo_indeferimento: "motivo_nao_disponivel"`
→ Mover para lista `sem_despachos_detalhados`
→ **NUNCA inventar motivo**

### Múltiplos bloqueadores citados
→ Registrar TODOS na cadeia
→ Criar entrada na fila para CADA bloqueador

### Marca indeferida por motivo diferente de colidência
→ Registrar o motivo real (ex: "art. 124, VI — caráter descritivo")
→ `bloqueador: { identificado: false }`
→ Não gerar entrada na fila de bloqueadores (não houve bloqueador)
→ Mas registrar — indeferimento por descritivo é precedente relevante

### Marca extinta sem nenhum despacho de indeferimento
→ `resultado_final: "extinto_sem_indeferimento"`
→ Provavelmente morreu por caducidade ou não-renovação
→ Registrar, mas com relevância menor

### Processo bloqueador que já está na nossa busca fuzzy
→ Registrar na fila mesmo assim — a ficha do bloqueador pode não ter sido
   coletada na Fase 3A (se foi descartada na peneira, por exemplo)
→ O script `coletar_bloqueadores.py` vai deduplicar

### Recurso parcialmente provido
→ `recurso.resultado: "parcialmente_provido"`
→ Registrar detalhes no `motivo_detalhado`
→ `resultado_final: "indeferido_reformado"` (tratamos como reforma)

---

## Proibições

- ❌ NUNCA inventar número de processo bloqueador que não consta nos despachos
- ❌ NUNCA inventar motivo de indeferimento
- ❌ NUNCA inferir resultado de recurso sem despacho explícito
- ❌ NUNCA pular fichas — todas devem ser processadas
- ❌ NUNCA alterar dados da ficha (nome, processo, classe, spec)

---

## Success Output

```
Análise de cadeia concluída — {marca}

Fichas analisadas: {n}
Cadeias com bloqueador identificado: {n}
Sem despachos detalhados: {n}
Bloqueadores na fila: {n}

Classificação:
  indeferido_mantido: {n}
  indeferido_reformado: {n}
  indeferido_pendente: {n}
  extinto_apos_indeferimento: {n}
  extinto_sem_indeferimento: {n}
  arquivado_por_desistencia: {n}
  nao_classificavel: {n}
```

---

```yaml
metadata:
  version: 3.0.0
  squad: laudo-viabilidade
  fase: 3B.2
  sub_agente: analista-cadeia
  modelo: sonnet
  input: precedentes-fichas.json
  output: [precedentes-cadeia.json, fila-busca-bloqueadores.json]
  tags: [precedentes, cadeia, bloqueio, despachos, recurso, rastreabilidade]
```
