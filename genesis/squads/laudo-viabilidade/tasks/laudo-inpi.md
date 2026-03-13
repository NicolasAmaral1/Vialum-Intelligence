# Task: Laudo — Análise de Colidências INPI (PARTE 2)

> **Comando:** `*inpi` (ou Fase 3 do `*nova-analise`)
> **Agente:** @laudo (Mira)
> **Fase:** 3 — Processamento INPI + Análise de Colidências

---

## Purpose

Instruir o usuário a realizar a busca no INPI e colar os dados brutos. Processar o texto
via `processar_inpi.py` para gerar JSON estruturado. Executar a SKILL `analise-inpi`
para produzir a PARTE 2 do laudo: narrativa jurídica exaustiva de colidências, sem bullets,
sem tabelas, sem subcapítulos numerados. Aguardar aprovação do usuário antes de prosseguir.

---

## Prerequisites

- PARTE 1 aprovada (Checkpoint 1 concluído)
- `classes_aprovadas` disponíveis na sessão
- `plano_md` disponível na sessão
- Pasta `laudos/{cliente}/{nome_marca}/` existe com `inpi-raw.txt` criado

---

## Execution Mode

**Semi-interativo** — aguarda dois inputs do usuário: (1) confirmação de dados colados no INPI; (2) aprovação da análise gerada.

---

## Implementation Steps

### Passo 1: Instruir busca no INPI

```
⚖️ Mira — Hora da busca no INPI.

Classes aprovadas para pesquisa: {classes_aprovadas}

Siga estes passos:
1. Acesse: https://busca.inpi.gov.br/pePI/servlet/MarcasServlet
2. Para cada classe aprovada ({lista}):
   → Busque pelo nome: "{nome_marca}"
   → Se necessário, busque também por variações similares
3. Selecione TODOS os resultados (Ctrl+A)
4. Copie (Ctrl+C)
5. Cole em: laudos/{cliente}/{nome_marca}/inpi-raw.txt

Quando terminar, confirme aqui: "ok, colei os dados"
```

**AGUARDAR** confirmação do usuário.

---

### Passo 2: Processar dados do INPI

Executar o script de processamento:

```bash
cd /Users/nicolasamaral/Vialum-Intelligence && \
python3 genesis/squads/laudo-viabilidade/scripts/processar_inpi.py \
  "laudos/{cliente}/{nome_marca}/inpi-raw.txt"
```

O script gera: `laudos/{cliente}/{nome_marca}/inpi-raw-processed.json`

Verificar que o arquivo foi criado:
```bash
head -n 20 "laudos/{cliente}/{nome_marca}/inpi-raw-processed.json"
```

SE arquivo vazio ou erro:
```
⚠️ O processamento retornou dados vazios.
Verifique se o conteúdo do inpi-raw.txt contém dados válidos do INPI.
Cole novamente e confirme.
```

---

### Passo 3: Carregar JSON e executar SKILL analise-inpi

Ler o conteúdo completo de `inpi-raw-processed.json`.

A sinapse `.synapse/analise-inpi` está ativa. Seguir RIGOROSAMENTE todas as regras:

**PROIBIÇÕES ABSOLUTAS (falha grave se descumpridas):**
- ❌ Subcapítulos numerados (### 1., ### 2.)
- ❌ Relatório separado de colidências ao final
- ❌ Conclusão com título próprio (## CONCLUSÃO)
- ❌ Estratégia em tópicos numerados
- ❌ Separadores `---` na Parte 2
- ❌ Bullet points (`* item` ou `- item`)

**Estrutura obrigatória:**
1. Parágrafo 1: Contexto de Saturação (densidade marcária, sem subtítulo)
2. Parágrafos 2-N: Análise de cada anterioridade INLINE (dados citados no próprio parágrafo)
3. Parágrafo Final: Conclusão corrida (veredito + estratégia em texto contínuo)

**Execução em lotes:** Se houver mais de 10 anterioridades, processar em lotes de 5 — anunciar ao usuário e aguardar entre lotes se necessário.

**Título da seção:** `## PARTE 2: ANÁLISE DE COLIDÊNCIAS E ANTERIORIDADES`

---

### Passo 4: Substituir placeholder no PLANO DE ANÁLISE

Localizar no arquivo `plano_md` a linha:
```
⚠️ **AGUARDANDO PROCESSAMENTO DOS DADOS DO INPI**
```

Substituir pelo conteúdo completo da PARTE 2 gerada.

Garantir:
- Nenhum lixo do JSON colou no .md
- Sem bullets na PARTE 2
- Sem `---` na PARTE 2
- Sem tabelas de colidências ao final

---

### Passo 5: CHECKPOINT 2 — Aprovação final

```
✅ Análise de colidências concluída — {nome_marca}

Revise o PLANO DE ANÁLISE completo:
  laudos/{cliente}/{nome_marca}/{nome_marca} - PLANO DE ANÁLISE.md

Verifique:
  → Os vereditos individuais estão adequados?
  → A estratégia mestra faz sentido para o negócio?
  → A conclusão de viabilidade está alinhada com as expectativas?

Se aprovado, digitar "ok" para gerar os documentos finais.
Se precisar de ajustes, descreva o que mudar.
```

**AGUARDAR** aprovação do usuário.

---

### Passo 6: Registrar aprovação

Retornar para o workflow:
```json
{
  "plano_md": "laudos/{cliente}/{nome_marca}/{nome_marca} - PLANO DE ANÁLISE.md",
  "checkpoint_2": "aprovado"
}
```

---

## Veto Conditions

- **`inpi-raw.txt` vazio após 2 tentativas:** VETO — "Não consigo processar dados INPI vazios. Verifique o arquivo e tente novamente."
- **JSON processado sem nenhum processo encontrado:** Informar ao usuário e oferecer continuar sem anterioridades (análise intrínseca apenas).

---

## Success Output

```
✅ PARTE 2 concluída e aprovada — {nome_marca}
   Anterioridades analisadas: {n}
   Veredito: {muito provável / provável / possível com estratégia / pouco provável}
➡️ Prosseguindo com *gerar — documentos finais...
```

---

```yaml
metadata:
  version: 1.0.0
  squad: laudo-viabilidade
  phase: 3
  sinapse_ativa: analise-inpi
  script: squads/laudo-viabilidade/scripts/processar_inpi.py
  next_task: laudo-gerar.md
  tags: [inpi, colidencias, anterioridades, parte2, narrativa, juridica]
  updated_at: 2026-02-27
```
