# Task: Laudo — Análise Preliminar (PARTE 1)

> **Comando:** `*preliminar` (ou Fase 2 do `*nova-analise`)
> **Agente:** @laudo (Mira)
> **Fase:** 2 — Análise Preliminar

---

## Purpose

Executar a SKILL `analise-preliminar`: analisar a marca quanto à VERACIDADE, LICEIDADE e
DISTINTIVIDADE, sugerir classes NCL pertinentes com especificações, e gerar a PARTE 1 do
`[Marca] - PLANO DE ANÁLISE.md`. Apresentar ao usuário para aprovação antes de prosseguir.

---

## Prerequisites

- Dados da sessão disponíveis: `nome_marca`, `cliente`, `atividade`, `pasta`
- Pasta `laudos/{cliente}/{nome_marca}/` criada

---

## Execution Mode

**Automático até o Checkpoint** — gera PARTE 1 autonomamente, então pausa para aprovação humana.

---

## Implementation Steps

### Passo 1: Carregar contexto da SKILL analise-preliminar

A sinapse `.synapse/analise-preliminar` está ativa. Seguir RIGOROSAMENTE todas as regras
carregadas: tom, vocabulário, estrutura do Markdown, proibições.

---

### Passo 2: Consultar know-how NCL

Para cada classe a ser sugerida, OBRIGATORIAMENTE ler o arquivo correspondente em:
`squads/laudo-viabilidade/resources/know-how/ncl-classes/NCL-[XX].md`

Isso garante que as especificações sugeridas estão dentro da lista oficial do INPI.

---

### Passo 3: Escrever PARTE 1 do PLANO DE ANÁLISE

Gerar conteúdo seguindo EXATAMENTE a estrutura abaixo:

```markdown
# {MARCA} - PLANO DE ANÁLISE DE VIABILIDADE

**Cliente:** {cliente}
**Marca Principal:** {nome_marca}
**Marcas Alternativas:** {alternativos ou "Não informadas"}
**Atividade:** {atividade}
**Data:** {data_atual}

---

## PARTE 1: ANÁLISE PRELIMINAR

## ANÁLISE DOS REQUISITOS (VERACIDADE, LICEIDADE E DISTINTIVIDADE)

{NARRATIVA JURÍDICA — Parágrafos contínuos, sem listas.
 VERACIDADE, LICEIDADE e DISTINTIVIDADE em CAIXA ALTA.
 Analisar 4 níveis INPI: FANTASIOSO, ARBITRÁRIO, EVOCATIVO, DESCRITIVO.
 Tom de advogado sênior.}

## LAUDO DESCRITIVO POR CLASSE

Nesta seção, iremos expor nossas sugestões sobre quais classes independentes são
aconselháveis para registro conforme o seguimento da empresa. Sabe-se que a empresa
tem como atividade {atividade}.

**Classe {N} (muito recomendável)** – {especificações da NCL-XX.md}
{Parágrafo: por que essa classe protege a atividade do cliente}

**Classe {N} (muito recomendável)** – {especificações}
{Parágrafo de aplicação}

**Classe {N} (recomendável)** – {especificações}
{Parágrafo de aplicação}

{Classes adicionais com "possui sinergia" se necessário}

## PARTE 2: ANÁLISE DE COLIDÊNCIAS INPI

⚠️ **AGUARDANDO PROCESSAMENTO DOS DADOS DO INPI**
```

Regras obrigatórias:
- NUNCA usar "licitude" — sempre LICEIDADE
- SEMPRE 5 classes, sem exceção
- Distribuição obrigatória: pelo menos 2 "muito recomendável" (às vezes 3), pelo menos 1 "recomendável" (às vezes 2), e o restante "possui sinergia"
- Ordem de apresentação: muito recomendável primeiro, depois recomendável, depois possui sinergia
- NÃO incluir separadores `---` no final das seções
- Especificações de cada classe extraídas do arquivo NCL correspondente

---

### Passo 4: Salvar arquivo

```bash
# Salvar PLANO DE ANÁLISE na pasta do caso
# Arquivo: laudos/{cliente}/{nome_marca}/{nome_marca} - PLANO DE ANÁLISE.md
```

Gravar o conteúdo completo da PARTE 1 no arquivo `.md`.

---

### Passo 5: CHECKPOINT 1 — Aprovação do usuário

```
✅ Análise preliminar concluída — {nome_marca}

Revise o arquivo:
  laudos/{cliente}/{nome_marca}/{nome_marca} - PLANO DE ANÁLISE.md

Verifique:
  → As classes sugeridas estão adequadas ao negócio?
  → As especificações cobrem a atividade corretamente?
  → A análise de DISTINTIVIDADE faz sentido para essa marca?

Após revisar, informe quais classes deseja buscar no INPI.
(Confirme com "ok" ou liste as classes aprovadas)
```

**AGUARDAR** aprovação do usuário.

---

### Passo 6: Registrar classes aprovadas

Após confirmação, registrar na sessão:
- `classes_aprovadas`: lista de números de classes (ex: [35, 42, 44])

Retornar para o workflow:
```json
{
  "plano_md": "laudos/{cliente}/{nome_marca}/{nome_marca} - PLANO DE ANÁLISE.md",
  "classes_aprovadas": [35, 42],
  "checkpoint_1": "aprovado"
}
```

---

## Veto Conditions

- **Atividade insuficiente para determinar classes:** VETO — solicitar mais detalhes
- **Marca tecnicamente irregistrável** (ex: nome genérico puro, sigla proibida por lei):
  Informar ao usuário com fundamentação jurídica antes de prosseguir

---

## Success Output

```
✅ PARTE 1 concluída e aprovada — {nome_marca}
   Classes aprovadas para busca INPI: {lista}
➡️ Prosseguindo com *inpi — busca e análise de colidências...
```

---

```yaml
metadata:
  version: 1.0.0
  squad: laudo-viabilidade
  phase: 2
  sinapse_ativa: analise-preliminar
  ncl_path: squads/laudo-viabilidade/resources/know-how/ncl-classes/
  next_task: laudo-inpi.md
  tags: [preliminar, veracidade, liceidade, distintividade, ncl, classes, parte1]
  updated_at: 2026-02-27
```
