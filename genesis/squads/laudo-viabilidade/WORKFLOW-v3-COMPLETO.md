# WORKFLOW v3 — Laudo de Viabilidade Marcária (de fora a fora)

> **Versão:** 3.0 — Decisões travadas
> **Data:** 30/03/2026

---

## O QUE É ISSO

Um pipeline automatizado que recebe o nome de uma marca e sua atividade, pesquisa o INPI com profundidade de escritório de PI sênior, e entrega um relatório técnico completo com parecer fundamentado — marca a marca, sem resumos, sem atalhos.

---

## COMO COMEÇA

O cliente (ou a equipe) pede uma análise de viabilidade. Exemplo:

> "Quero registrar a marca **Plenya** para serviços médicos, bem-estar,
> nutrição, saúde, apoio psicológico e esportivo."

A partir daí, o squad assume.

---

## QUEM PARTICIPA

### Humano (Nicolas / equipe)
- Aprova classes NCL sugeridas (Checkpoint 1)
- Revisa relatório técnico (Checkpoint 1.5)
- Revisa narrativa jurídica (Checkpoint 2)

### @laudo (Mira ⚖️) — Orquestradora
- Persona: advogada sênior de PI
- Faz: análise intrínseca, orquestra sub-agentes e scripts, escreve narrativa
- Modelo: Opus

### Sub-agentes especializados
| Agente | Modelo | Função |
|--------|--------|--------|
| @peneira | Haiku | Classifica marcas em 3 níveis (candidata / zona de atenção / descartada) |
| @analista-cadeia | Sonnet | Lê despachos, extrai cadeia de bloqueio |
| @analista-coexistencia | Sonnet | Mapeia convivência de radicais, emite parecer de desgaste |
| @analista-decisoes | Opus | Cruza precedentes, aplica Princípio da Isonomia |
| @cotejador | Opus | Cotejo individual INPI-grade, veredito por marca |
| @relator | Sonnet | Gera relatório técnico completo |

### Scripts Playwright (sem IA)
| Script | Função |
|--------|--------|
| `coletar_lista.py` | Raspa listagem do INPI (paralelo, 4 browsers) |
| `coletar_specs.py` | Abre fichas e expande especificações (6-8 workers) |
| `coletar_precedentes.py` | Busca fichas de indeferidas/mortas com despachos |
| `coletar_bloqueadores.py` | Busca fichas dos bloqueadores com rastreabilidade |
| `validar_integridade.py` | Anti-alucinação: cruza relatório × fonte-bruta.json |
| `gerar_laudo_reportlab.py` | Gera PDF final |
| `gerar_docx_builder.py` | Gera DOCX final |

---

## O PIPELINE PASSO A PASSO

---

### FASE 0 — RECEBER O CASO

**Quem:** @laudo (Mira)
**Como:** Recebe do ClickUp (card "para fazer") ou diretamente do usuário.

**Coleta:**
- Nome da marca: `Plenya`
- Cliente: `Equipe Plenya`
- Atividade: `Serviços médicos, bem-estar, nutrição, saúde, apoio psicológico, esportivo`
- Marcas alternativas (se houver)

**Cria:**
- Pasta `laudos/Equipe Plenya/Plenya/`
- Subpastas: `coleta/`, `peneira/`, `specs/`, `precedentes/`, `coexistencia/`, `analise/`, `vereditos/`, `validacao/`, `output/`

---

### FASE P — ANÁLISE INTRÍNSECA (PARTE 1)

**Quem:** @laudo (Mira) — executa diretamente
**Modelo:** Opus

**O que faz:**

1. Analisa a marca quanto a 3 requisitos legais:
   - **VERACIDADE** — o nome induz o consumidor a erro?
   - **LICEIDADE** — incide em alguma proibição do art. 124 LPI?
   - **DISTINTIVIDADE** — é fantasioso, arbitrário, evocativo ou descritivo?

2. Classifica o tipo da marca (FANTASIOSO / ARBITRÁRIO / EVOCATIVO / DESCRITIVO)
   - Isso impacta toda a análise posterior: fantasiosas têm proteção mais ampla

3. Consulta know-how NCL (`resources/know-how/ncl-classes/NCL-XX.md`) e sugere classes:
   - 1ª e 2ª classe: "muito recomendável"
   - 3ª classe: "recomendável"
   - 4ª+ classe: "possui sinergia"
   - Mínimo 3, máximo 5 classes
   - Especificações extraídas dos arquivos NCL oficiais

4. Gera PARTE 1 do `{marca} - PLANO DE ANÁLISE.md`

**Exemplo de output (Plenya):**
- Tipo: entre FANTASIOSO e EVOCATIVO (palavra inventada mas evoca "plena")
- Classes sugeridas: 44 (saúde), 41 (esporte), 42 (software), 35 (comércio)
- Especificações por classe extraídas dos NCL oficiais

**→ CHECKPOINT 1:** Usuário revisa e aprova as classes.

**Resultado:** Classes aprovadas (ex: 44, 41, 42, 35) + tipo da marca definido.

---

### FASE 1 — COLETA GERAL

**Quem:** Script `coletar_lista.py` (Playwright, sem IA)
**Tempo estimado:** ~1-2 minutos

**O que faz:**

1. **Abre 4 browsers em paralelo** (1 por classe aprovada)
   - Cada browser: login independente, cookies próprios, user-agent diferente
   - Se > 4 classes: excedentes aguardam browser livre

2. **Cada browser faz a busca fuzzy na sua classe:**
   - Acessa Pesquisa Avançada do INPI
   - Ativa "análise por similaridade" (fuzzy)
   - Preenche nome da marca + número da classe
   - Submete e aguarda resultado
   - Navega página por página, extraindo de cada uma:
     - Número do processo
     - Nome da marca
     - Situação processual
     - Titular
     - % de similaridade (que o INPI retorna)
   - **Critério de parada:** última marca da página tem % < 30%, OU atingiu 10 páginas

3. **Busca geral (sem classe):**
   - Após os 4 browsers terminarem, 1 browser faz busca sem filtro de classe
   - Captura marcas em classes adjacentes não pesquisadas
   - Deduplica contra as já encontradas

4. **Separação mecânica em 3 buckets** (string matching na situação):
   - **Bucket A (vivas):** em vigor, pedido, deferido, publicado, sobrestamento, aguardando exame
   - **Bucket B (indeferidas):** indeferido, recurso contra indeferimento, nulidade
   - **Bucket C (mortas):** extinta, arquivada, anulada
   - Bucket C NÃO é descarte — mortas têm valor como precedentes históricos

5. **Grava tudo:**
   - `coleta/classe-{N}-lista.json` por classe
   - `coleta/geral-lista.json`
   - `coleta/coleta-consolidada.json` (deduplicada)
   - `coleta/bucket-a-vivas.json`
   - `coleta/bucket-b-indeferidas.json`
   - `coleta/bucket-c-mortas.json`
   - `fonte-bruta.json` (master, indexado por nº processo)

**Exemplo (Plenya):**
- Classe 44: 26 marcas | Classe 41: 6 | Classe 42: 17 | Classe 35: 48 | Geral: +79 novas
- Total: 161 únicas
- Bucket A: ~89 vivas | Bucket B: ~22 indeferidas | Bucket C: ~50 mortas

**Nenhum julgamento, nenhum filtro subjetivo, nenhuma IA.** Só copia o que o INPI mostra.

---

### FASE 2 — PENEIRA

**Quem:** Sub-agente @peneira
**Modelo:** Haiku (barato, rápido — tarefa de classificação)
**Tempo estimado:** ~2-3 minutos

**Input:**
- Os 3 buckets da Fase 1
- Dados do caso: nome_marca, atividade, classes, tipo_marca

**O que faz:**

Classifica CADA marca em 3 níveis:

| Nível | Nome | Critério | Consequência |
|-------|------|----------|-------------|
| **1** | **Candidata** | Risco evidente: nome muito similar (fonética/gráfica/ideológica) + classe relevante | Busca spec → cotejo completo → seção individual no relatório |
| **2** | **Zona de Atenção** | Risco possível: nome parcialmente similar, ou classe adjacente, ou semântica ambígua | Busca spec → cotejo completo → seção individual no relatório |
| **3** | **Descartada** | Sem risco: nome muito diferente e/ou classe sem afinidade | NÃO busca spec → tabela de descartadas no relatório com justificativa |

**Regras da peneira:**
- Ultra-permissiva: na dúvida entre 2 e 3 → escolhe 2 (Zona de Atenção)
- Na dúvida entre 1 e 2 → escolhe 1 (Candidata)
- Marcas de alto renome com mínimo de proximidade → Nível 1 automaticamente
- Marcas mistas: analisa APENAS o elemento nominativo
- Marcas em classes completamente sem afinidade com a atividade: pode descartar sem análise profunda (ex: "PLENVIT" classe 12 — veículos — para um caso de saúde)
- Cada marca recebe justificativa de 1 frase

**Para Bucket B + C (indeferidas + mortas):**
- Mesma classificação em 3 níveis
- Critério: "pode ser relevante como precedente?"
- Mais permissiva ainda — qualquer indício de padrão é valioso

**Output:** `peneira/peneira-resultado.json`
```json
{
  "nivel_1_candidatas": ["940215020", "936580372", ...],
  "nivel_2_zona_atencao": ["920111222", "915333444", ...],
  "nivel_3_descartadas": ["935777888", "940999000", ...],
  "precedentes_nivel_1": ["910456789", ...],
  "precedentes_nivel_2": ["905111222", ...],
  "precedentes_nivel_3": ["900888777", ...],
  "estatisticas": {
    "bucket_a_total": 89,
    "bucket_b_total": 22,
    "bucket_c_total": 50,
    "nivel_1_vivas": 12,
    "nivel_2_vivas": 23,
    "nivel_3_vivas": 54,
    "nivel_1_precedentes": 8,
    "nivel_2_precedentes": 14,
    "nivel_3_precedentes": 50
  }
}
```

**Enriquece fonte-bruta.json:** cada marca ganha campo `peneira: { nivel, justificativa }`

**Exemplo (Plenya):**
- Nível 1 (candidatas): "PLENNUS SAÚDE", "PLENYA MED", "PLENA VIDA" → 12 marcas
- Nível 2 (atenção): "PLENVIT", "PLAN YA HEALTH" → 23 marcas
- Nível 3 (descartadas): "PLANITUDO", "PLENTY FOOD" → 54 marcas
- **35 marcas vão para busca de spec** (12 + 23) em vez de 89

---

### FASE 3A — COLETA DE ESPECIFICAÇÕES

**Quem:** Script `coletar_specs.py` (Playwright, sem IA)
**Roda em paralelo com:** Fase 3B
**Tempo estimado:** ~1-2 minutos (só as filtradas)

**Input:** Lista de processos nível 1 + nível 2 do peneira (vivas)

**O que faz:**

1. Abre 6-8 browsers paralelos (workers independentes)
2. Para cada processo:
   - Busca por número no INPI
   - Abre ficha de detalhe
   - **Expande especificações ocultas** via JavaScript (o INPI trunca por padrão — o script força `div[id="especificacaoN"].style.display = 'block'`)
   - Extrai: nome, classe, situação, titular, **especificação COMPLETA**, despachos visíveis
3. Salva tudo em `specs/specs-completas.json`
4. Enriquece `fonte-bruta.json` com `especificacao_completa`

**O que NÃO faz:** Nenhum julgamento. Só coleta.

**Exemplo:** 35 fichas × 6s / 8 workers = ~30 segundos

---

### FASE 3B — INTELIGÊNCIA DE PRECEDENTES

**Quem:** Script + sub-agente @analista-cadeia
**Roda em paralelo com:** Fase 3A
**Modelo do sub-agente:** Sonnet
**Tempo estimado:** ~4-5 minutos

**Sub-etapa 3B.1 — Coleta (script, sem IA)**

`coletar_precedentes.py` busca fichas completas das indeferidas + mortas que passaram na peneira (níveis 1 e 2 dos buckets B + C).

Para cada processo:
- Ficha completa com despachos (histórico cronológico de decisões do INPI)
- Especificações expandidas
- Tudo que o INPI mostra

Output: `precedentes/precedentes-fichas.json`

**Sub-etapa 3B.2 — Análise de cadeia (sub-agente @analista-cadeia)**

O @analista-cadeia (Sonnet) lê os despachos de cada ficha e extrai:

1. **Motivo do indeferimento:** art. 124 XIX (imitação)? art. 124 VI (descritivo)? Outro?
2. **Processo bloqueador:** qual marca causou o indeferimento? (número + nome)
3. **Recurso:** houve? Resultado? (mantido / reformado / pendente)
4. **Classificação do resultado:**
   - `indeferido_mantido` → precedente forte (INPI confirmou colidência)
   - `indeferido_reformado` → precedente forte inverso (2ª instância aceitou convivência)
   - `indeferido_pendente` → recurso em andamento
   - `extinto_apos_indeferimento` → titular desistiu após perder
   - `extinto_sem_indeferimento` → morreu por caducidade/não-renovação
   - `arquivado_por_desistencia` → titular desistiu do pedido

5. **Monta fila de bloqueadores** com rastreabilidade:
   ```json
   {
     "processo": "905123456",
     "nome": "PLENUS",
     "buscado_porque": "bloqueou processo 910456789 (PLENUS VIDA) na classe 44",
     "relevancia_para_caso": "se PLENUS bloqueou PLENUS VIDA, pode bloquear PLENYA"
   }
   ```

**Regra:** Se despacho não tem motivo detalhado → registra "motivo_nao_disponivel". NUNCA inventa.

Output:
- `precedentes/precedentes-cadeia.json`
- `precedentes/fila-busca-bloqueadores.json`

**Sub-etapa 3B.3 — Coleta de bloqueadores (script, sem IA)**

`coletar_bloqueadores.py` busca fichas completas de cada bloqueador da fila.
Workers paralelos. Cada ficha salva COM a rastreabilidade original.

Se um bloqueador também foi indeferido por outra marca → segundo nível da cadeia (máximo 2 níveis).

Output: `precedentes/bloqueadores-fichas.json`

**Cadeia completa montada:**
```
PLENUS VIDA (indeferida, mantida)
  └── bloqueada por: PLENUS (em vigor)
       ├── specs: "serviços de clínica médica; assistência médica"
       └── titular: PLENUS SAUDE LTDA

IMPACTO: Se PLENUS bloqueou PLENUS VIDA (radical plen-),
         pode bloquear PLENYA na mesma classe com specs similares.
```

---

### FASE 3C — MAPA DE COEXISTÊNCIA E DESGASTE

**Quem:** Sub-agente @analista-coexistencia
**Modelo:** Sonnet
**Depende de:** 3A e 3B (roda após ambas terminarem)
**Tempo estimado:** ~3-4 minutos

**Input:**
- Bucket A completo (TODAS as vivas, não só filtradas)
- Precedentes com cadeia de bloqueio
- Specs das filtradas (se disponível)

**O que faz:**

1. **Agrupa todas as marcas por radical/elemento comum:**
   - Ex: "plen-" → PLENUS, PLENNUS, PLENYA, PLENA SAÚDE, PLEN VITA, PLENUS VIDA
   - Considera: prefixo, sufixo, radical, campo semântico

2. **Para cada cluster, conta:**
   - Quantas marcas **vivas** de titulares **diferentes**
   - Quantas foram **indeferidas** (e por quem)
   - Quantas **convivem** sem problemas

3. **Emite parecer de desgaste por cluster por classe:**

   | Cenário | Parecer |
   |---------|---------|
   | ≥ 5 titulares distintos com marcas vivas, nenhum indeferimento | **FAVORÁVEL** — termo desgastado, INPI aceita convivência |
   | 3-4 titulares, nenhum indeferimento | **FAVORÁVEL** |
   | Titulares convivem MAS houve indeferimento mantido no cluster | **PARCIAL** — desgaste do radical, mas não da marca idêntica |
   | Poucos titulares + indeferimentos recorrentes | **DESFAVORÁVEL** — INPI protege o termo |
   | Houve indeferimento MAS foi reformado em recurso | **PARCIAL** tendendo a favorável |

4. **Cruza com precedentes:** se no cluster "plen-" da classe 44 houve 2 indeferimentos mantidos, isso é evidência de que o INPI NÃO trata como desgastado nessa classe.

**Output:** `coexistencia/mapa-coexistencia.json`

**Exemplo (Plenya, classe 44):**
```
Cluster "plen-" classe 44:
  Vivas: PLENUS (titular A), PLENNUS SAÚDE (titular B), PLENA VIDA (titular C)
  Indeferidas: PLENUS VIDA (bloqueada por PLENUS, mantida)
  Titulares distintos: 3
  Desgaste: PARCIAL — convivência existe mas com indeferimento pontual
```

**Enriquece fonte-bruta.json:** cada marca ganha `cluster_radical`, `desgaste_no_cluster`, `titulares_distintos_no_cluster`

---

### FASE 4 — ANÁLISE DE DECISÕES E ISONOMIA

**Quem:** Sub-agente @analista-decisoes
**Modelo:** Sonnet
**Tempo estimado:** ~3-5 minutos

**Input:**
- `precedentes/precedentes-cadeia.json`
- `precedentes/bloqueadores-fichas.json`
- `coexistencia/mapa-coexistencia.json`

**O que faz:**

Identifica **padrões de decisão do INPI** e aplica o **Princípio da Isonomia**: "se aconteceu com os outros, conosco pode ocorrer também."

Para cada cluster de decisões, responde:

1. **Quando ocorreu?** Decisões recentes (2023-2026) pesam mais que antigas (2015)
2. **Qual foi a decisão?** Indeferimento? Deferimento? Recurso?
3. **Quem decidiu?** 1ª instância (examinador) ou 2ª instância (recurso)? → 2ª instância pesa mais
4. **Padrão identificável?**
   - "Na classe 44, radical 'plen-' foi barrado 2 vezes por colidência com PLENUS"
   - "Na classe 42, radical 'plen-' convive — 3 marcas ativas de titulares diferentes"
5. **Isonomia aplicável?**
   - Se PLENUS VIDA foi indeferida por PLENUS → PLENYA pode sofrer o mesmo
   - Se PLENUS VIDA foi reformada em recurso → há precedente de convivência
   - Direção: FAVORÁVEL / DESFAVORÁVEL / NEUTRA

**Output:** `analise/precedentes-analise.json`

**Exemplo (Plenya):**
```
Classe 44:
  Padrão: "radical plen- com histórico misto — convivência aceita entre PLENUS,
  PLENNUS e PLENA VIDA, mas PLENUS VIDA foi barrada por PLENUS"
  Isonomia: DESFAVORÁVEL para nomes muito próximos de PLENUS,
            mas FAVORÁVEL para nomes com sufixo diferenciador (como Plenya)
```

**Enriquece fonte-bruta.json:** cada marca ganha `isonomia: { aplicavel, direcao, referencia }`

---

### FASE 5 — VEREDITO INDIVIDUAL

**Quem:** Sub-agente @cotejador
**Modelo:** Opus (o mais crítico — precisa de julgamento jurídico fino)
**Tempo estimado:** ~5-10 minutos (depende do volume)

**Input:**
- `specs/specs-completas.json`
- `analise/precedentes-analise.json`
- `coexistencia/mapa-coexistencia.json`
- Dados do caso: nome_marca, atividade, classes, tipo_marca, specs pretendidas do NCL

**O que faz para CADA marca nível 1 e nível 2:**

**1. Cotejo de sinais (Manual de Marcas INPI, seção 5.11):**

- **Fonética:** sequência de sílabas, entonação, ritmo
  - Ex: "PLEN-ya" vs "PLEN-nus" → alta (mesmo radical, mesma tônica)
- **Gráfica:** sequência de letras, estrutura, número de caracteres
  - Ex: "Plenya" (6 letras) vs "Plennus" (7 letras) → média
- **Ideológica:** campo semântico, significado evocado
  - Ex: ambas evocam "plenitude" → alta

Cada dimensão: ALTA / MÉDIA / BAIXA / NULA + justificativa

**2. Afinidade mercadológica (8 critérios do Manual INPI):**

| Critério | Peso | Pergunta |
|----------|------|----------|
| Natureza | Alto | Mesma categoria essencial de serviço? |
| Finalidade | Alto | Mesmo propósito? Contratados da mesma forma? |
| Complementariedade | Médio | Um é indispensável para o outro? |
| Concorrência | Alto | Podem ser substituídos um pelo outro? |
| Canais | Baixo | Mesmos canais de venda? (INPI: "não é definitivo") |
| Público-alvo | Baixo | Mesmo consumidor? (INPI: "não é determinante" isoladamente) |
| Grau de atenção | Médio | Consumidor compra com atenção alta ou baixa? Saúde = alta |
| Origem habitual | Alto | Comum que mesma empresa forneça ambos? |

Resultado: DIRETA / INDIRETA / SEM AFINIDADE — só detalha critérios que agregam

**3. Especificações vs. atividade do cliente:**

- Spec da marca candidata: **COMPLETA, copiada do JSON, nunca truncada**
- Atividade do nosso cliente
- Sobreposição: DIRETA / INDIRETA / SEM SOBREPOSIÇÃO
- Ex: spec "serviços de clínica médica; serviços de saúde" vs atividade "serviços médicos, bem-estar" → DIRETA

**4. Isonomia (da Fase 4):**

- Há precedente aplicável? Qual?
- Direção: FAVORÁVEL / DESFAVORÁVEL / NEUTRA
- Ex: "PLENUS VIDA indeferida por PLENUS na mesma classe — isonomia DESFAVORÁVEL"

**5. Desgaste (da Fase 3C):**

- Cluster do radical: desgastado / parcial / protegido
- Quantos titulares distintos convivem

**6. Fatores atenuantes e agravantes:**

Atenuantes:
- Elemento em comum desgastado (≥5 titulares)
- Diferença gráfica significativa (sufixo diferente)
- Especificações em nichos distintos dentro da mesma classe
- Marca fantasiosa (proteção ampla, mas difícil confundir com evocativas)

Agravantes:
- Serviço de saúde → "exame especialmente cauteloso" (Manual INPI)
- Reprodução com acréscimo (contém a marca inteira + algo mais)
- Marca notoriamente conhecida no segmento
- Radical com histórico de indeferimento

**7. Veredito:**

| Classificação | Quando |
|--------------|--------|
| **COLIDÊNCIA PROVÁVEL** | Cotejo alto em ≥2 dimensões + afinidade direta + isonomia desfavorável |
| **COLIDÊNCIA POSSÍVEL** | Cotejo médio + afinidade direta, OU cotejo alto + afinidade indireta |
| **COLIDÊNCIA REMOTA** | Cotejo baixo + afinidade indireta, OU similaridade alta + specs sem sobreposição |
| **SEM COLIDÊNCIA** | Cotejo baixo + specs sem sobreposição + isonomia favorável ou neutra |

+ Fundamentação legal (art. 124 XIX, princípio da especialidade, etc.)
+ Estratégia de defesa (como argumentar se houver exigência/oposição)

**Regra de equilíbrio (Princípio da Especialidade — INPI):**
> "Quanto menor a semelhança entre os sinais, maior deverá ser a afinidade
> mercadológica para caracterizar risco de confusão."

**Processamento:** Se > 15 marcas, processa em lotes de 10. Cada lote gera output parcial que é consolidado.

**Output:** `vereditos/vereditos-individuais.json`

**Enriquece fonte-bruta.json:** cada marca ganha `veredito`, `cotejo`, `afinidade`, `estrategia`

---

### VALIDAÇÃO ANTI-ALUCINAÇÃO

**Quem:** Script `validar_integridade.py` (sem IA)
**Roda:** Após Fase 5 e após Fase 6

**O que faz:**
1. Extrai todos os números de processo citados nos vereditos/relatório
2. Para cada número:
   - Existe no `fonte-bruta.json`? → Se não: **ALERTA**
   - Nome citado bate com o do JSON? → Se não: **ALERTA**
   - Spec citada bate com a do JSON? → Se não: **ALERTA**
   - Veredito bate com o de `vereditos-individuais.json`? → Se não: **ALERTA**
3. Output: `validacao/validacao-integridade.json`
   - `status: "OK"` ou `status: "ALERTAS"` + lista de discrepâncias

Se alertas → @laudo corrige antes de prosseguir. Nada vai pro checkpoint com dados inconsistentes.

---

### FASE 6 — RELATÓRIO TÉCNICO

**Quem:** Sub-agente @relator
**Modelo:** Sonnet
**Tempo estimado:** ~5-8 minutos

**Input:** Todos os JSONs das fases 1-5

**Gera:** `{marca} - RELATÓRIO TÉCNICO DE COTEJO.md`

**Estrutura:**

```
1. PANORAMA DE DENSIDADE
   Análise por classe: quantas marcas, distribuição, radicais dominantes

2. MAPA DE COEXISTÊNCIA E DESGASTE
   Por cluster: marcas vivas, titulares distintos, indeferimentos, parecer

3. PRECEDENTES E ISONOMIA
   Cada cadeia: indeferida → bloqueadora → specs de ambas → recurso → resultado
   Padrões identificados. Impacto para nossa marca. Rastreabilidade.

4. COTEJO INDIVIDUAL
   CANDIDATAS (Nível 1):
     Seção completa por marca: dados + cotejo + afinidade + specs + isonomia + veredito

   ZONA DE ATENÇÃO (Nível 2):
     Seção completa por marca (mesmo formato)

   DESCARTADAS NA PENEIRA (Nível 3):
     Tabela completa: processo | nome | classe | situação | nível | justificativa

5. VEREDITO POR CLASSE
   Por classe: veredito + fundamentação + riscos + desgaste + isonomia

6. VEREDITO GLOBAL
   Veredito + parágrafo fundamentado + estratégia mestra
```

**Regras inegociáveis:**
- NADA é resumido — cada marca com seção individual completa
- Especificações INTEGRAIS, copiadas do JSON, nunca truncadas
- Descartadas também listadas (transparência)
- Tom técnico-analítico, acessível para equipe e cliente
- Se processamento em lotes (>20 marcas): concatena partes do .md

**→ Script `validar_integridade.py` roda no relatório gerado**

**→ CHECKPOINT 1.5:** Usuário revisa o relatório técnico completo.
- As classificações estão adequadas?
- Os vereditos fazem sentido?
- Alguma marca descartada deveria ter sido analisada?
- A estratégia mestra está alinhada com as expectativas?

---

### FASE 7 — NARRATIVA JURÍDICA (PARTE 2)

**Quem:** @laudo (Mira ⚖️) — executa diretamente
**Modelo:** Opus
**Tempo estimado:** ~5-8 minutos

**Input:** Relatório técnico aprovado no Checkpoint 1.5

**O que faz:**

Transforma a inteligência do relatório em narrativa jurídica com tom de advogado sênior de PI. Parágrafos contínuos, sem bullets, sem tabelas, sem subcapítulos numerados.

Substitui o placeholder `AGUARDANDO PROCESSAMENTO DOS DADOS DO INPI` no PLANO DE ANÁLISE pela PARTE 2 completa.

**Diferença do v2:** Mira não olha dados brutos. Escreve a partir do relatório técnico já fundamentado — com vereditos, isonomia e estratégia prontos. Qualidade muito superior.

**Regras mantidas:**
- Nunca mencionar "fuzzy", "algoritmo", "score"
- Usar: "análise por similaridade fonética, gráfica e conceitual"
- Specs citadas por extenso
- Precedentes e isonomia citados explicitamente (decisão travada)

**→ CHECKPOINT 2:** Usuário revisa a narrativa jurídica.

---

### FASE 8 — GERAÇÃO E ENTREGA

**Quem:** Scripts existentes
**Tempo estimado:** ~2-3 minutos

1. `gerar_laudo_reportlab.py` → PDF (fontes Sora, logo Genesis, cores #9FEC14)
2. `gerar_docx_builder.py` → DOCX (formatação profissional)
3. `google_drive_service.py` → Upload para Drive (versionamento automático)
4. ClickUp: comentário + mover card para "feito"

---

## TEMPOS ESTIMADOS

| Fase | Quem | Tempo |
|------|------|-------|
| 0 — Receber caso | @laudo | ~1 min |
| P — Análise intrínseca | @laudo (Opus) | ~5 min |
| *CHECKPOINT 1* | Humano | — |
| 1 — Coleta INPI | Script (4 browsers) | ~1-2 min |
| 2 — Peneira | @peneira (Haiku) | ~2-3 min |
| 3A — Specs | Script (6-8 workers) | ~1-2 min |
| 3B — Precedentes | Script + @analista-cadeia (Sonnet) | ~4-5 min |
| 3C — Coexistência | @analista-coexistencia (Sonnet) | ~3-4 min |
| 4 — Decisões | @analista-decisoes (Sonnet) | ~3-5 min |
| 5 — Veredito | @cotejador (Opus) | ~5-10 min |
| Validação | Script | ~10 seg |
| 6 — Relatório | @relator (Sonnet) | ~5-8 min |
| Validação | Script | ~10 seg |
| *CHECKPOINT 1.5* | Humano | — |
| 7 — Narrativa | @laudo (Opus) | ~5-8 min |
| *CHECKPOINT 2* | Humano | — |
| 8 — Geração | Scripts | ~2-3 min |
| **TOTAL (sem checkpoints)** | | **~35-50 min** |

Qualidade acima de velocidade. Nenhum corte.

---

## PRINCÍPIOS DO SQUAD

1. **Qualidade primeiro.** Nunca cortar algo útil para ficar pronto antes.
2. **Nada é resumido.** Trabalho difícil é incluído integralmente.
3. **Zero alucinação.** Se o dado não existe no INPI, não existe no laudo. Validação automática.
4. **Rastreabilidade total.** Qualquer número citado pode ser verificado no fonte-bruta.json.
5. **Separação de responsabilidades.** Scripts coletam. IA analisa. Mira redige.
6. **Dados antes de julgamento.** Coletar tudo primeiro, julgar depois.
7. **Peneira permissiva.** Falso positivo é preferível a falso negativo.
8. **Precedentes são munição.** Mortas e indeferidas não são lixo — são inteligência.

---

```yaml
metadata:
  versao: 3.0
  status: decisoes_travadas
  fases: 9 (0, P, 1, 2, 3A, 3B, 3C, 4, 5, 6, 7, 8)
  checkpoints: 3
  sub_agentes: 6
  scripts: 7
  modelos: {opus: [laudo, cotejador, analista-decisoes], sonnet: [analista-cadeia, analista-coexistencia, relator], haiku: [peneira]}
  principios: [qualidade_primeiro, nada_resumido, zero_alucinacao, rastreabilidade_total]
```
