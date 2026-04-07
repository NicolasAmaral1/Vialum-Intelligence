---
name: Confronto de Especificações
description: Fase 2 — confronta especificações NCL das marcas candidatas com o território máximo pretendido pelo cliente, identificando zonas de sobreposição e território seguro.
---

# SKILL: Confronto de Especificações (Fase 2)

## Propósito

Você é um **especialista em Propriedade Intelectual e Classificação NCL**. Esta SKILL recebe as marcas que passaram pelo Radar (Fase 1) e realiza o **confronto detalhado de especificações**, começando pelo território mais amplo possível para o cliente e afunilando conforme colidências são identificadas.

## Filosofia Central

> **Começar largo, afunilar conforme ameaças aparecem.**

As especificações do cliente NÃO são fixas desde o início. Elas representam o **universo máximo de proteção possível** para aquele negócio. Cada colidência confirmada "consome" um pedaço desse universo. O que sobra é o **território seguro**.

## Input

* `cases/[Cliente]/[Marca]/[Marca] - RADAR.md` — Relatório do radar com candidatas e limítrofes
* `cases/[Cliente]/[Marca]/inpi-raw-processed.json` — JSON completo (para specs detalhadas)
* `[Marca] - PLANO DE ANÁLISE.md` — Parte 1 (classes sugeridas e atividade)
* `know-how/ncl-classes/NCL-XX.md` — Arquivo NCL da(s) classe(s) relevante(s)

## Output

* `cases/[Cliente]/[Marca]/[Marca] - CONFRONTO.md` — Mapa completo de confronto
* Atualização do `[Marca] - PLANO DE ANÁLISE.md` com specs recomendadas finais

---

## Etapa 1: Montar Território Máximo do Cliente

Para cada classe sugerida na Parte 1:

1. **Abra o arquivo NCL correspondente** (`know-how/ncl-classes/NCL-XX.md`)
2. **Selecione TODAS as especificações que se aplicam** à atividade do cliente, mesmo que remotamente
3. Isso forma o **Território Máximo** — o maior escopo de proteção possível

### Exemplo:
> Cliente: hamburgueria artesanal
> Classe 43 — Território Máximo:
> - 430102 | Serviços de restaurantes
> - 430107 | Serviços de restaurantes de autosserviço
> - 430108 | Serviços de lanchonetes
> - 430010 | Serviço de bufê
> - 430024 | Serviços de cafés [bares]
> - 430025 | Serviços de cafeteria
> - 430027 | Serviços de cantinas
> - 430138 | Serviços de bar
> - 430199 | Provimento de informações e conselhos sobre preparação de refeições

**Regra: seja generoso nesta etapa.** Incluir de mais é melhor que incluir de menos — o afunilamento vem depois.

---

## Etapa 2: Mapear Especificações de Cada Candidata

Para cada marca CANDIDATA ou LIMÍTROFE do Radar:

1. **Extraia a especificação completa** do JSON (campo `especificacao` dentro de `classes`)
2. Se a especificação não estiver no JSON, marque como "SPECS NÃO DISPONÍVEIS — necessário consulta manual"
3. **Decomponha** a especificação em itens individuais (cada atividade protegida)

---

## Etapa 3: Confronto Item a Item

Para cada candidata, compare suas especificações com o Território Máximo do cliente:

### Classificação de cada item:

| Status | Significado |
|--------|-------------|
| **SOBREPOSIÇÃO DIRETA** | Mesma especificação ou especificação equivalente (ex: ambos "serviços de restaurantes") |
| **SOBREPOSIÇÃO PARCIAL** | Especificações no mesmo universo mas com diferenciação possível (ex: "restaurantes" vs "lanchonetes") |
| **SEM SOBREPOSIÇÃO** | Atividades distintas dentro da mesma classe (ex: "restaurantes" vs "hotelaria") |

### Regra de Afunilamento

Quando uma SOBREPOSIÇÃO DIRETA é identificada:
1. **Não elimine a especificação automaticamente** — marque como "zona de risco"
2. Avalie se a tese de coexistência é viável (marca fraca, público diferente, etc.)
3. Se a coexistência NÃO for viável → aquela especificação sai do território seguro
4. Se a coexistência FOR viável → a especificação permanece, mas com nota de risco

---

## Etapa 4: Gerar Mapa de Confronto

### Formato do CONFRONTO.md

```markdown
# [MARCA] - CONFRONTO DE ESPECIFICAÇÕES

**Marca Analisada:** [Marca do cliente]
**Data:** [Data atual]
**Classes analisadas:** [Lista]
**Candidatas confrontadas:** [N]

---

## TERRITÓRIO MÁXIMO PRETENDIDO

### Classe [XX]
| Código | Especificação | Status Pós-Confronto |
|--------|--------------|---------------------|
| 430102 | Serviços de restaurantes | ⚠️ ZONA DE RISCO — sobreposição com [N] candidatas |
| 430108 | Serviços de lanchonetes | ✅ SEGURO — sem sobreposição identificada |
| 430010 | Serviço de bufê | ✅ SEGURO — sem sobreposição identificada |
| ... | ... | ... |

[Repetir para cada classe]

---

## CONFRONTOS DETALHADOS

### [MARCA CANDIDATA 1] (Proc. 000000000)
**Titular:** [Nome]
**Status:** [Em vigor / Aguardando exame / etc.]
**Especificação completa:** [Copiar na íntegra]

**Mapa de sobreposição:**
| Spec do Cliente | Spec da Candidata | Tipo | Avaliação |
|----------------|-------------------|------|-----------|
| 430102 - Serviços de restaurantes | Serviços de restaurante e lanchonete | DIRETA | Coexistência viável — marca fraca, público distinto |
| 430108 - Lanchonetes | Serviços de restaurante e lanchonete | DIRETA | Mesmo risco acima |
| 430010 - Bufê | [Não possui] | SEM SOBREPOSIÇÃO | Seguro |

**Risco consolidado:** MÉDIO — sobreposição em 2 specs, mas tese de coexistência é forte por [motivo]

[Repetir para cada candidata]

---

## TERRITÓRIO FINAL RECOMENDADO

### Classe [XX]

**Especificações SEGURAS (sem sobreposição):**
- 430010 | Serviço de bufê
- 430025 | Serviços de cafeteria
- [...]

**Especificações em ZONA DE RISCO (sobreposição com defesa viável):**
- 430102 | Serviços de restaurantes — risco com [MARCA X], defesa: [tese resumida]
- [...]

**Especificações BLOQUEADAS (sobreposição sem defesa viável):**
- [Se houver — explicar por que a defesa não é viável]

### Recomendação de Especificação Final
[Lista final das especificações recomendadas para depósito, combinando seguras + zona de risco com defesa]

---

## RESUMO PARA FASE 3

**Candidatas com risco real (entram na narrativa jurídica):** [N]
**Candidatas neutralizadas por specs (saem da análise):** [N]
**Território preservado:** [X]% do território máximo
```

---

## Execução Passo a Passo

1. **Leia o RADAR.md** — Identifique todas as candidatas e limítrofes
2. **Leia os arquivos NCL** das classes sugeridas na Parte 1
3. **Monte o Território Máximo** — todas as specs aplicáveis ao negócio do cliente
4. **Para cada candidata:**
   a. Extraia especificação completa do JSON
   b. Decomponha em itens individuais
   c. Confronte item a item com o Território Máximo
   d. Classifique cada sobreposição (direta, parcial, nenhuma)
   e. Avalie viabilidade de coexistência para sobreposições diretas
5. **Consolide o Território Final** — seguro, zona de risco, bloqueado
6. **Salve o CONFRONTO.md**
7. **Salve o CONFRONTO.json** — dados estruturados para geração do PDF visual (formato abaixo)
8. **Atualize o PLANO DE ANÁLISE.md** — insira as specs recomendadas finais na seção de classes
9. **Apresente ao usuário** o resumo e aguarde validação

### Formato do CONFRONTO.json
```json
{
  "marca_cliente": "Will's Burger",
  "data_analise": "28/03/2026",
  "colidencias_reais": 3,
  "candidatas_neutralizadas": 2,
  "territorio_preservado_pct": 78,
  "territorio": [
    {
      "classe": 43,
      "especificacoes": [
        {
          "codigo": "430102",
          "descricao": "Serviços de restaurantes",
          "status": "RISCO",
          "conflitos": ["WILLS BURGUER (Proc. 000)"]
        },
        {
          "codigo": "430108",
          "descricao": "Serviços de lanchonetes",
          "status": "SEGURO",
          "conflitos": []
        }
      ]
    }
  ]
}
```

### ⚠️ AUDITABILIDADE
- Toda candidata do Radar DEVE aparecer no confronto — mesmo que sem sobreposição (registrar "sem sobreposição — neutralizada")
- Toda especificação do Território Máximo DEVE ter um status final (seguro, risco, bloqueado)
- O caminho de cada decisão deve ser rastreável: de onde veio a spec, com quem conflitou, por que foi mantida ou removida

---

## Regras de Afunilamento Progressivo

1. **Primeira candidata**: compare com Território Máximo completo
2. **A cada nova candidata**: o território já carrega as marcações das anteriores
3. **Efeito cumulativo**: se 3 candidatas diferentes colidem na mesma spec, o risco daquela spec é ALTO
4. **Território seguro real**: é o que sobra após TODAS as candidatas terem sido confrontadas
5. **Specs que ninguém disputou**: são as mais valiosas — destaque-as como "território livre"
