# PLANO GERAL — Laudo de Viabilidade Marcária v3

> **Status:** Decisões travadas — pronto para implementação
> **Data:** 30/03/2026

---

## 1. VISÃO

Produzir um laudo de viabilidade marcária com qualidade de escritório de PI sênior, fundamentado em dados reais do INPI, com inteligência de precedentes e análise de desgaste — tudo automatizado, mas com checkpoints humanos nos momentos críticos.

**Diferencial:** Não é só "tem marca parecida ou não". É: "o INPI, nesta classe, com este radical, tem histórico de barrar ou aceitar? Quem bloqueou quem? As specs se sobrepõem? Há convivência comprovada?"

**Princípios inegociáveis:**
- **Qualidade acima de velocidade.** Nunca cortar algo que pode ser útil para ficar pronto antes.
- **Nada é resumido.** Trabalho difícil é incluído integralmente.
- **Zero alucinação.** Se o dado não existe no INPI, não existe no laudo.
- **Rastreabilidade total.** Qualquer número citado pode ser verificado no fonte-bruta.json.

---

## 2. DECISÕES TRAVADAS

| # | Decisão | Resposta |
|---|---------|----------|
| 1 | Quem orquestra | O squad, com sub-agentes especializados |
| 2 | Contexto da IA | Sub-agentes por tarefa, cada um com contexto limpo |
| 3 | Peneira | IA dedicada (sub-agente específico) |
| 4 | Relatório técnico | Para equipe E para enviar ao cliente |
| 5 | Precedentes no laudo | Sim, explicitamente citados |
| 6 | Tempo | Qualidade primeiro. Sem cortes. |
| 7 | Anti-alucinação | Script automático + revisão humana |
| 8 | Despacho indisponível | Registrar "não disponível", nunca inferir |
| 9 | Alto renome | Não checar separado, mas repulsa alta se tiver proximidade |
| 10 | Mistas + nominativas | Analisar apenas o elemento nominativo |
| 11 | Pipeline genérico | Sim, funciona para qualquer atividade |
| 12 | Precedentes entre laudos | Teoria aceita, não é foco agora |

---

## 3. ARQUITETURA DO SQUAD

### 3.1 Conceito

O squad opera como um **time de especialistas**, cada um com função definida. O agente principal (`@laudo` / Mira) orquestra o trabalho, mas delega tarefas pesadas para **sub-agentes** que rodam com contexto isolado e retornam resultados estruturados.

```
@laudo (Mira ⚖️) — ORQUESTRADORA
  │
  ├── Fase P:  Mira executa diretamente (análise intrínseca)
  │
  ├── Fase 1:  Chama script ─── coletar_lista.py (Playwright)
  │
  ├── Fase 2:  Delega sub-agente ─── @peneira
  │
  ├── Fase 3A: Chama script ─── coletar_specs.py (Playwright)
  │
  ├── Fase 3B: Chama script ─── coletar_precedentes.py (Playwright)
  │            Delega sub-agente ─── @analista-cadeia (lê despachos, extrai bloqueadores)
  │            Chama script ─── coletar_bloqueadores.py (Playwright)
  │
  ├── Fase 3C: Delega sub-agente ─── @analista-coexistencia
  │
  ├── Fase 4:  Delega sub-agente ─── @analista-decisoes
  │
  ├── Fase 5:  Delega sub-agente ─── @cotejador (1 chamada por lote de marcas)
  │
  ├── Fase 6:  Delega sub-agente ─── @relator
  │            → CHECKPOINT 1.5 (revisão humana)
  │
  ├── Fase 7:  Mira executa diretamente (narrativa jurídica)
  │            → CHECKPOINT 2 (revisão humana)
  │
  └── Fase 8:  Chama scripts ─── gerar_laudo_reportlab.py + gerar_docx_builder.py
```

### 3.2 Sub-Agentes

Cada sub-agente é invocado via Agent tool do Claude Code. Recebe prompt com:
- Definição clara da tarefa
- Caminho dos JSONs de input
- Formato esperado do output
- Regras que DEVE seguir

Retorna: resultado estruturado que Mira salva no JSON correspondente + enriquece fonte-bruta.json.

---

#### @peneira — Agente de Triagem

**Função:** Decidir quais marcas merecem aprofundamento.

**Input:**
- `coleta/bucket-a-vivas.json`
- `coleta/bucket-b-indeferidas.json`
- `coleta/bucket-c-mortas.json`
- Dados do caso: nome_marca, atividade, classes_aprovadas, tipo_marca

**Processo:**

Para cada marca do Bucket A (vivas):
> "Se essa marca — '{nome}' na classe {classe} — tivesse exatamente a mesma
> atividade e especificações do nosso cliente ({atividade}), traria problemas?"
> Avaliar: similaridade fonética, gráfica, ideológica + classe comum.
> Resposta: SIM / NÃO + justificativa de 1 frase.

Para cada marca do Bucket B + C (indeferidas + mortas):
> "Essa marca pode ser relevante como precedente para entender como o INPI
> trata termos similares a '{nossa_marca}' nesta classe?"
> Critério permissivo: na dúvida, inclui.
> Resposta: SIM / NÃO + justificativa.

**Regras:**
- Ser ultra-permissivo. Falso positivo é preferível a falso negativo.
- Marcas em classes sem nenhuma afinidade com a atividade do cliente podem ser descartadas sem IA (pré-filtro por classe).
- Marcas de alto renome: se tiver o mínimo de proximidade de nome → SIM automaticamente, com flag "alto_renome_proximidade".
- Marcas mistas: analisar apenas o elemento nominativo.

**Output:** `peneira/peneira-resultado.json`

---

#### @analista-cadeia — Agente de Precedentes

**Função:** Ler despachos de marcas indeferidas/mortas e extrair a cadeia de bloqueio.

**Input:**
- `precedentes/precedentes-fichas.json` (fichas completas com despachos)
- Dados do caso

**Processo:**

Para cada ficha com despachos:
1. Ler cronologia de despachos
2. Identificar: motivo do indeferimento, artigo da LPI, processo bloqueador citado
3. Classificar resultado: indeferido_mantido / indeferido_reformado / indeferido_pendente / extinto_apos_indeferimento / extinto_sem_indeferimento / arquivado_por_desistencia
4. Se houve recurso: resultado do recurso
5. Montar fila de bloqueadores para busca (com rastreabilidade)

**Regras:**
- Se despacho não tem motivo detalhado → registrar "motivo_nao_disponivel", NUNCA inferir
- Rastreabilidade obrigatória: cada bloqueador na fila deve ter `buscado_porque` e `relevancia_para_caso`
- Cadeia máxima: 2 níveis. Nível 2 só se nível 1 for "indeferido_mantido"

**Output:**
- `precedentes/precedentes-cadeia.json`
- `precedentes/fila-busca-bloqueadores.json`

---

#### @analista-coexistencia — Agente de Desgaste

**Função:** Mapear coexistência de termos similares e determinar se o INPI trata como desgastado.

**Input:**
- `coleta/bucket-a-vivas.json` (TODAS as vivas, não só filtradas)
- `precedentes/precedentes-cadeia.json`
- `specs/specs-completas.json` (se já disponível)
- Dados do caso

**Processo:**

1. Agrupar todas as marcas (vivas + indeferidas + mortas) por radical/elemento comum
2. Para cada cluster:
   - Contar titulares distintos com marcas vivas
   - Listar indeferimentos no cluster
   - Cruzar: convivência × indeferimento
   - Emitir parecer de desgaste: FAVORÁVEL / PARCIAL / DESFAVORÁVEL

**Regras:**
- ≥ 5 titulares distintos com marcas vivas no mesmo radical → desgaste FAVORÁVEL
- 3-4 titulares + nenhum indeferimento → desgaste FAVORÁVEL
- Titulares convivem MAS houve indeferimento mantido → PARCIAL
- Poucos titulares + indeferimentos recorrentes → DESFAVORÁVEL
- Sempre citar os processos e nomes concretos que sustentam o parecer

**Output:** `coexistencia/mapa-coexistencia.json`

---

#### @analista-decisoes — Agente de Isonomia

**Função:** Cruzar precedentes com mapa de coexistência e identificar padrões de decisão do INPI.

**Input:**
- `precedentes/precedentes-cadeia.json`
- `precedentes/bloqueadores-fichas.json`
- `coexistencia/mapa-coexistencia.json`
- Dados do caso

**Processo:**

Para cada cluster de decisões:
1. Quando ocorreu? (decisões recentes pesam mais)
2. Qual foi a decisão? (indeferimento, deferimento, recurso)
3. Quem decidiu? (1ª instância vs 2ª instância)
4. Padrão identificável? (ex: "radical plen- sistematicamente barrado na classe 44")
5. Isonomia aplicável? Direção favorável ou desfavorável?

**Regras:**
- Princípio da Isonomia: "se aconteceu com outros, conosco pode ocorrer também"
- Ponderar por recência: decisão de 2025 pesa mais que de 2018
- Ponderar por instância: 2ª instância (recurso) pesa mais que 1ª
- Sempre citar o processo e a data que sustenta cada conclusão

**Output:** `analise/precedentes-analise.json`

---

#### @cotejador — Agente de Cotejo Individual

**Função:** Para cada marca viva relevante, emitir cotejo completo seguindo o Manual de Marcas INPI (seção 5.11).

**Input:**
- `specs/specs-completas.json` (marca por marca, com spec expandida)
- `analise/precedentes-analise.json`
- `coexistencia/mapa-coexistencia.json`
- Dados do caso: nome_marca, atividade, classes, tipo_marca, specs pretendidas

**Processo por marca:**

1. **Cotejo de sinais:**
   - Fonética: sequência de sílabas, entonação, ritmo
   - Gráfica: sequência de letras, estrutura
   - Ideológica: campo semântico, significado

2. **Afinidade mercadológica (8 critérios INPI):**
   - Natureza, finalidade, complementariedade, concorrência, canais, público-alvo, grau de atenção, origem habitual
   - Só detalhar critérios relevantes, omitir os que não agregam

3. **Especificações vs. atividade:**
   - Spec da marca candidata (COMPLETA, copiada do JSON)
   - Atividade do cliente
   - Sobreposição: direta / indireta / sem sobreposição

4. **Isonomia:**
   - Buscar no precedentes-analise.json: há precedente aplicável?
   - Direção: favorável / desfavorável / neutra

5. **Desgaste:**
   - Buscar no mapa-coexistencia.json: cluster do radical
   - Status: desgastado / parcial / protegido

6. **Veredito:**
   - COLIDÊNCIA PROVÁVEL / POSSÍVEL / REMOTA / SEM COLIDÊNCIA
   - Fundamentação legal
   - Estratégia de defesa

**Processamento em lotes:**
- Se > 15 marcas: processar em lotes de 10
- Cada lote gera output parcial
- Ao final, consolidar em vereditos-individuais.json

**Regras:**
- NUNCA parafrasear especificações. Copiar do JSON.
- NUNCA inventar número de processo.
- Se o dado não está no JSON, dizer "dado não disponível".
- Marcas mistas: analisar APENAS o elemento nominativo.
- Serviços de saúde: considerar que o INPI aplica "exame especialmente cauteloso".

**Output:** `vereditos/vereditos-individuais.json`

---

#### @relator — Agente de Relatório Técnico

**Função:** Consolidar TODA a inteligência das fases 1-5 num documento legível, completo, marca a marca.

**Input:**
- `fonte-bruta.json` (master)
- `peneira/peneira-resultado.json`
- `specs/specs-completas.json`
- `precedentes/precedentes-cadeia.json`
- `precedentes/bloqueadores-fichas.json`
- `coexistencia/mapa-coexistencia.json`
- `analise/precedentes-analise.json`
- `vereditos/vereditos-individuais.json`

**Output:** `{marca} - RELATÓRIO TÉCNICO DE COTEJO.md`

**Estrutura do relatório:**

```markdown
# {MARCA} - RELATÓRIO TÉCNICO DE COTEJO

**Marca:** {marca} | **Tipo:** {tipo} | **Atividade:** {atividade}
**Classes:** {lista} | **Data:** {data}
**Total INPI:** {n} | **Vivas:** {n} | **Indeferidas:** {n} | **Mortas:** {n}
**Após peneira:** {n} vivas + {n} precedentes | **Com veredito:** {n}

---

## 1. PANORAMA DE DENSIDADE

{Análise por classe: quantas marcas, distribuição por status, concentração de radicais}

## 2. MAPA DE COEXISTÊNCIA E DESGASTE

{Para cada cluster de radical:
 - Marcas vivas de titulares distintos (com processo e nome)
 - Indeferimentos no cluster
 - Parecer de desgaste: FAVORÁVEL / PARCIAL / DESFAVORÁVEL
 - Fundamentação com dados concretos}

## 3. PRECEDENTES E ISONOMIA

{Para cada cadeia de bloqueio:
 - Marca indeferida → marca bloqueadora → specs de ambas
 - Recurso? Resultado?
 - Padrão identificável
 - Impacto para a nossa marca
 - Rastreabilidade: por que essa busca foi feita}

## 4. COTEJO INDIVIDUAL

### [1] {MARCA} — Processo {n} — Classe {n}

| Campo | Valor |
|-------|-------|
| Situação | {status} |
| Titular | {nome} |
| Especificação completa | {TEXTO INTEGRAL — nunca truncado} |

**Fonética:** {grau} — {justificativa}
**Gráfica:** {grau} — {justificativa}
**Ideológica:** {grau} — {justificativa}
**Afinidade mercadológica:** {grau} — {critérios relevantes}
**Specs vs. atividade:** {sobreposição}
**Isonomia:** {aplicável? direção? processo de referência?}
**Desgaste:** {status do cluster}
**Atenuantes:** {lista}
**Agravantes:** {lista}

**PARECER:** {COLIDÊNCIA PROVÁVEL / POSSÍVEL / REMOTA / SEM COLIDÊNCIA}
**Fundamentação:** {base legal + isonomia + desgaste}
**Estratégia:** {como defender se houver exigência/oposição}

---

### [2] {PRÓXIMA MARCA} ...

{TODAS as marcas que passaram na peneira. Sem exceção. Sem resumo.}

## 5. MARCAS DESCARTADAS NA PENEIRA

{Tabela completa: processo | nome | classe | situação | motivo do descarte}
{TODAS listadas — para transparência e rastreabilidade}

## 6. VEREDITO POR CLASSE

**Classe {N}:**
- Vivas relevantes: {n} | Colidências prováveis: {n} | Possíveis: {n}
- Densidade: {alta/média/baixa}
- Desgaste do radical: {FAVORÁVEL/PARCIAL/DESFAVORÁVEL}
- Precedentes: {resumo}
- **VEREDITO:** {MUITO PROVÁVEL / PROVÁVEL / POSSÍVEL COM ESTRATÉGIA / IMPROVÁVEL}
- **Fundamentação:** {parágrafo}

{Repete por classe}

## 7. VEREDITO GLOBAL

**{VEREDITO GLOBAL}**

{Parágrafo fundamentado: síntese do cenário cruzando todas as classes,
 principais riscos, desgaste, isonomia, estratégia mestra recomendada}
```

**Regras do relatório:**
- **NADA é resumido.** Cada marca que passou na peneira tem seção individual completa.
- **Especificações INTEGRAIS.** Copiadas do JSON, nunca truncadas com "...".
- **Tom técnico-analítico.** Frases diretas, dados explícitos. Não é narrativa jurídica (isso é Fase 7).
- **Linguagem acessível para equipe e cliente.** Sem jargão interno do sistema.
- **Marcas descartadas também listadas.** Para transparência.
- **Processamento em lotes** se > 20 marcas: o sub-agente gera partes do .md que são concatenadas.

---

## 4. SCRIPTS PLAYWRIGHT

### `coletar_lista.py` — Fase 1

**O que faz:**
1. Abre 4 browsers em paralelo (1 por classe)
2. Cada browser: login → formulário avançado → fuzzy → página por página
3. Corte: % similaridade < 30% ou 10 páginas (cap)
4. Extrai: número, nome, situação, titular, % similaridade
5. Busca geral (sem classe) após as por-classe
6. Deduplicação por número de processo
7. Separação mecânica em Bucket A/B/C por string matching na situação
8. Grava: listas por classe + consolidada + buckets + fonte-bruta.json

**Não faz:** Abrir fichas, buscar specs, julgar.

### `coletar_specs.py` — Fase 3A

**O que faz:**
1. Recebe lista de processos (do peneira-resultado.json → vivas_para_specs)
2. Abre 6-8 workers paralelos
3. Cada worker: busca por número → abre ficha → expande specs via JS → extrai tudo
4. Salva specs-completas.json
5. Enriquece fonte-bruta.json com campo `especificacao_completa`

**Não faz:** Julgar, classificar, opinar.

### `coletar_precedentes.py` — Fase 3B.1

**O que faz:**
1. Recebe lista de processos (do peneira-resultado.json → precedentes_para_analise)
2. Abre 6-8 workers paralelos
3. Cada worker: busca por número → abre ficha → extrai TUDO (specs + despachos + histórico)
4. Salva precedentes-fichas.json
5. Enriquece fonte-bruta.json

**Não faz:** Interpretar despachos (isso é do @analista-cadeia).

### `coletar_bloqueadores.py` — Fase 3B.3

**O que faz:**
1. Recebe fila-busca-bloqueadores.json (gerada pelo @analista-cadeia)
2. Cada item da fila tem: processo, buscado_porque, relevancia_para_caso
3. Abre workers paralelos
4. Busca ficha completa (specs + despachos) de cada bloqueador
5. Salva bloqueadores-fichas.json COM a rastreabilidade original
6. Enriquece fonte-bruta.json

**Não faz:** Julgar. Só coleta e preserva rastreabilidade.

### `validar_integridade.py` — Anti-alucinação

**O que faz:**
1. Recebe o relatório técnico (.md) + fonte-bruta.json
2. Extrai todos os números de processo citados no relatório
3. Para cada número:
   - Existe no fonte-bruta.json? Se não → ALERTA
   - O nome citado bate com o do JSON? Se não → ALERTA
   - A spec citada bate com a do JSON? Se não → ALERTA
   - O veredito bate com o do vereditos-individuais.json? Se não → ALERTA
4. Output: relatório de validação (OK ou lista de discrepâncias)

**Roda automaticamente** antes do CHECKPOINT 1.5.

---

## 5. FLUXO DE DADOS — ENRIQUECIMENTO DO FONTE-BRUTA.JSON

```
fonte-bruta.json começa com:
{
  "940215020": {
    "nome_marca": "PLENYA SAÚDE",
    "classe": 44,
    "situacao": "Registro de marca em vigor",
    "titular": "PLENYA LTDA",
    "similaridade_pct": 85,
    "bucket": "A",
    "fonte": "classe-44-pagina-1",
    "coletado_em": "2026-03-30T11:22:33"
  }
}

Fase 2 adiciona:
    "peneira": {
      "resultado": "SIM",
      "justificativa": "similaridade fonética alta",
      "destino": "fase-3a-specs"
    }

Fase 3A adiciona:
    "especificacao_completa": "serviços de clínica médica; serviços de saúde; ...",
    "despachos_ficha": [...]

Fase 3B adiciona (para indeferidas/mortas):
    "historico_decisoes": [...],
    "resultado_final": "indeferido_mantido",
    "bloqueador": {
      "processo": "905123456",
      "nome": "PLENUS",
      "specs": "...",
      "rastreabilidade": "bloqueou este processo"
    }

Fase 3C adiciona:
    "cluster_radical": "plen-",
    "desgaste_no_cluster": "PARCIAL",
    "titulares_distintos_no_cluster": 4

Fase 4 adiciona:
    "isonomia": {
      "aplicavel": true,
      "direcao": "DESFAVORÁVEL",
      "referencia": "PLENUS VIDA (910456789) indeferida por colidência com PLENUS"
    }

Fase 5 adiciona:
    "veredito": {
      "classificacao": "COLIDÊNCIA PROVÁVEL",
      "risco": "alto",
      "fundamentacao": "art. 124 XIX ...",
      "estrategia": "..."
    },
    "cotejo": {
      "fonetica": {"grau": "alta", "justificativa": "..."},
      "grafica": {"grau": "média", "justificativa": "..."},
      "ideologica": {"grau": "alta", "justificativa": "..."},
      "afinidade": {"grau": "direta", "criterios": {...}}
    }

Fase 6 (validação):
    "validacao_integridade": "OK"
```

---

## 6. PIPELINE COMPLETO — EXECUÇÃO PASSO A PASSO

### BLOCO PRELIMINAR (já existe, sem mudanças)

```
@laudo *monitorar
  → Lista cards ClickUp "para fazer"
  → Usuário escolhe qual executar

@laudo *coletar
  → Lê card: nome_marca, cliente, atividade
  → Cria pasta laudos/{cliente}/{marca}/

@laudo *preliminar
  → Análise VERACIDADE, LICEIDADE, DISTINTIVIDADE
  → Consulta know-how NCL
  → Gera PARTE 1 do PLANO DE ANÁLISE
  → CHECKPOINT 1: usuário aprova classes
```

### BLOCO INTELIGÊNCIA (novo — v3)

```
FASE 1 — COLETA
  @laudo chama: coletar_lista.py "{marca}" --classes {aprovadas} --pasta {pasta}
  Script roda ~1 min
  Output: coleta/*.json + fonte-bruta.json
  @laudo reporta: "Coleta concluída. {n} marcas. Bucket A: {n}, B: {n}, C: {n}"

FASE 2 — PENEIRA
  @laudo delega sub-agente: @peneira
  Input: buckets A, B, C + dados do caso
  @peneira analisa ~160 marcas, retorna resultado
  @laudo salva: peneira/peneira-resultado.json + enriquece fonte-bruta.json
  @laudo reporta: "{n} vivas para specs, {n} precedentes para análise, {n} descartadas"

FASE 3A — SPECS (paralelo com 3B)
  @laudo chama: coletar_specs.py --input peneira/vivas_para_specs --pasta {pasta}
  Script roda ~1-2 min (só as filtradas, 6-8 workers)
  Output: specs/specs-completas.json + enriquece fonte-bruta.json

FASE 3B — PRECEDENTES (paralelo com 3A)
  @laudo chama: coletar_precedentes.py --input peneira/precedentes_para_analise --pasta {pasta}
  Script roda ~1 min (fichas completas com despachos)
  Output: precedentes/precedentes-fichas.json

  @laudo delega sub-agente: @analista-cadeia
  Input: precedentes-fichas.json
  @analista-cadeia lê despachos, extrai cadeias de bloqueio, monta fila de bloqueadores
  Output: precedentes/precedentes-cadeia.json + fila-busca-bloqueadores.json

  @laudo chama: coletar_bloqueadores.py --input fila-busca-bloqueadores.json --pasta {pasta}
  Script roda ~30s-1min
  Output: precedentes/bloqueadores-fichas.json + enriquece fonte-bruta.json

FASE 3C — COEXISTÊNCIA E DESGASTE (após 3A e 3B)
  @laudo delega sub-agente: @analista-coexistencia
  Input: bucket-a completo + precedentes-cadeia + specs (se disponível)
  Output: coexistencia/mapa-coexistencia.json + enriquece fonte-bruta.json

FASE 4 — DECISÕES E ISONOMIA
  @laudo delega sub-agente: @analista-decisoes
  Input: precedentes-cadeia + bloqueadores-fichas + mapa-coexistencia
  Output: analise/precedentes-analise.json + enriquece fonte-bruta.json

FASE 5 — VEREDITO INDIVIDUAL
  @laudo delega sub-agente: @cotejador
  Input: specs-completas + precedentes-analise + mapa-coexistencia + dados do caso
  Processamento em lotes de 10 marcas se necessário
  Output: vereditos/vereditos-individuais.json + enriquece fonte-bruta.json

  @laudo chama: validar_integridade.py (anti-alucinação)
  Cruza vereditos × fonte-bruta.json
  Se discrepância → @laudo corrige antes de prosseguir
```

### BLOCO ENTREGA

```
FASE 6 — RELATÓRIO TÉCNICO
  @laudo delega sub-agente: @relator
  Input: TODOS os JSONs das fases 1-5
  Output: {marca} - RELATÓRIO TÉCNICO DE COTEJO.md
  Relatório completo, sem resumos, marca a marca

  @laudo chama: validar_integridade.py no relatório
  Se OK → apresenta ao usuário
  → CHECKPOINT 1.5: usuário revisa relatório técnico

FASE 7 — NARRATIVA JURÍDICA (quando for o momento)
  @laudo (Mira) escreve PARTE 2 baseada no relatório técnico aprovado
  → CHECKPOINT 2: usuário revisa narrativa

FASE 8 — GERAÇÃO
  @laudo chama: gerar_laudo_reportlab.py + gerar_docx_builder.py
  Upload Drive + ClickUp
```

---

## 7. ARTEFATOS POR CASO

```
laudos/{cliente}/{marca}/
│
├── fonte-bruta.json                              # MASTER — tudo, enriquecido fase a fase
│
├── coleta/
│   ├── classe-{N}-lista.json                     # lista bruta por classe
│   ├── geral-lista.json                          # busca sem classe
│   ├── coleta-consolidada.json                   # deduplicada + metadados
│   ├── bucket-a-vivas.json
│   ├── bucket-b-indeferidas.json
│   └── bucket-c-mortas.json
│
├── peneira/
│   └── peneira-resultado.json                    # sim/não por marca + estatísticas
│
├── specs/
│   └── specs-completas.json                      # fichas expandidas das vivas filtradas
│
├── precedentes/
│   ├── precedentes-fichas.json                   # fichas completas B+C com despachos
│   ├── precedentes-cadeia.json                   # indeferido → bloqueador → resultado
│   ├── bloqueadores-fichas.json                  # fichas dos bloqueadores (com rastreabilidade)
│   └── fila-busca-bloqueadores.json              # fila gerada pelo @analista-cadeia
│
├── coexistencia/
│   └── mapa-coexistencia.json                    # clusters + desgaste por classe
│
├── analise/
│   └── precedentes-analise.json                  # padrões de decisão + isonomia
│
├── vereditos/
│   └── vereditos-individuais.json                # cotejo + parecer por marca
│
├── validacao/
│   └── validacao-integridade.json                # resultado do anti-alucinação
│
├── {marca} - PLANO DE ANÁLISE.md                 # Parte 1 + Parte 2 (cliente)
├── {marca} - RELATÓRIO TÉCNICO DE COTEJO.md      # Documento completo (equipe + cliente)
│
└── output/
    ├── {marca} - LAUDO DE VIABILIDADE.pdf
    └── {marca} - LAUDO DE VIABILIDADE.docx
```

---

## 8. IMPLEMENTAÇÃO — ORDEM DE PRIORIDADE

O foco agora é **relatórios confiáveis**. Narrativa e geração de documentos ficam para depois.

### Sprint 1 — Coleta + Peneira (Fases 1-2)
1. Implementar `coletar_lista.py` (paralelo, buckets, fonte-bruta.json)
2. Definir prompt do @peneira
3. Testar com dados da Plenya (já temos os resultados da busca anterior)

### Sprint 2 — Aprofundamento (Fases 3A, 3B, 3C)
4. Implementar `coletar_specs.py` (refatorar do script atual)
5. Implementar `coletar_precedentes.py`
6. Definir prompt do @analista-cadeia
7. Implementar `coletar_bloqueadores.py`
8. Definir prompt do @analista-coexistencia

### Sprint 3 — Inteligência (Fases 4-5)
9. Definir prompt do @analista-decisoes
10. Criar synapse `cotejo-inpi` (regras do Manual de Marcas)
11. Definir prompt do @cotejador

### Sprint 4 — Relatório + Validação (Fase 6)
12. Definir prompt do @relator
13. Implementar `validar_integridade.py`
14. Testar pipeline completo com Plenya

### Sprint 5 — Narrative + Geração (Fases 7-8)
15. Atualizar synapse da Mira para usar relatório como input
16. Integrar com scripts de geração existentes

---

```yaml
metadata:
  status: decisoes_travadas
  versao: 3.0
  sub_agentes: [peneira, analista-cadeia, analista-coexistencia, analista-decisoes, cotejador, relator]
  scripts_novos: [coletar_lista.py, coletar_specs.py, coletar_precedentes.py, coletar_bloqueadores.py, validar_integridade.py]
  scripts_existentes: [gerar_laudo_reportlab.py, gerar_docx_builder.py, google_drive_service.py]
  fases: 8
  checkpoints: 3 (CP1, CP1.5, CP2)
  principios: [qualidade_primeiro, nada_resumido, zero_alucinacao, rastreabilidade_total]
  tags: [plano-geral, squad-v3, sub-agentes, pipeline, implementacao]
```
