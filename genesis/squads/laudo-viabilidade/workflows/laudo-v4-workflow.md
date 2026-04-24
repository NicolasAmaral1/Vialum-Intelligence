# Workflow: Laudo de Viabilidade v4 — Triangulação

> **Agente:** @laudo-v4 (Mira ⚖️)
> **Tipo:** Sequencial com checkpoints humanos
> **Disparo:** `*nova-analise` ou card ClickUp em "para fazer"

---

## Visão Geral

```
ETAPA 1 → ETAPA 2 → ETAPA 3 → ETAPA 4 → ETAPA 5 → ETAPA 6 → ETAPA 7
Disparo   Classes    Coleta    Triagem   Triangul.  Laudo     Entrega
          +Termos    INPI      +Flags    Iterativa  Narrativa PDF/Drive
              ◆CP1                ◆CP2       ◆CP3
```

---

## ETAPA 1 — Formulário de disparo inicial

**Task:** `tasks/laudo-v4-disparo.md`

**Input:** card ClickUp ou comando manual
**Output:** pasta criada, dados do caso registrados

```
1.1  Identificar caso:
     → Se ClickUp: buscar cards "para fazer" na lista 901324787605
       Apresentar lista, usuário escolhe, mover para "em processo"
     → Se manual: receber marca, atividade, cliente

1.2  Criar estrutura:
     laudos/{cliente}/{marca}/
     └── coleta/ triagem/ fichas/ triangulacao/ output/ debug/

1.3  Registrar dados do caso:
     {
       "marca": "TRION PARCEIROS DO CONDOMÍNIO",
       "atividade": "administração de condomínios, gestão predial",
       "cliente": "Fulano",
       "clickup_task_id": "86ag..."
     }
```

**Próxima etapa:** → ETAPA 2

---

## ETAPA 2 — Puxa classes. Separa termos para análise.

**Task:** `tasks/laudo-v4-decomposicao.md`

**Input:** dados do caso
**Output:** termos classificados, 5 classes, guia de adjacência, PARTE 1 do plano

```
2.1  Decompor marca em termos:

     "TRION PARCEIROS DO CONDOMÍNIO"
     ┌──────────┬─────────────┬───────┐
     │ TRION    │ DISTINTIVO  │ alto  │
     │ PARCEIROS│ DESCRITIVO  │ baixo │
     │ DO       │ FILLER      │ ignora│
     │CONDOMÍNIO│ DESCRITIVO  │ baixo │
     └──────────┴─────────────┴───────┘

2.2  Tradução obrigatória:
     Se algum termo é em inglês → traduzir pro português
     Se algum é em português → traduzir pro inglês
     Registrar traduções como termos de busca adicionais

2.3  Consultar know-how NCL para cada classe candidata:
     resources/know-how/ncl-classes/NCL-XX.md

2.4  Selecionar 5 classes:
     - Pelo menos 2 "muito recomendável"
     - Pelo menos 1 "recomendável"
     - Restante "possui sinergia"

2.5  Gerar guia de adjacência:
     coleta/guia-adjacencia.json
     {aprovadas, adjacentes, sem_afinidade}

2.6  Escrever PARTE 1 do PLANO DE ANÁLISE:
     - VERACIDADE, LICEIDADE, DISTINTIVIDADE
     - Laudo descritivo por classe
     - Salvar: {marca} - PLANO DE ANÁLISE.md
```

**◆ CHECKPOINT 1:** Usuário aprova classes, termos e traduções.
**Próxima etapa:** → ETAPA 3

---

## ETAPA 3 — Puxa nomes no INPI nas classes pretendidas (sem specs)

**Task:** `tasks/laudo-v4-coleta.md`
**Script:** `coletar_lista.py`

**Input:** termos de busca + classes aprovadas
**Output:** fonte-bruta.json, listas por classe, buckets

```
3.1  Busca fuzzy por classe (Pesquisa Avançada, precisao=sim):

     Para cada combinação de {termo de busca} × {classe}:
       - Marca completa: "TRION PARCEIROS DO CONDOMÍNIO"
       - Termo distintivo isolado: "TRION"
       - Traduções (se houver)

     python3 coletar_lista.py "{termo}" \
       --classes {aprovadas} --pasta "laudos/{cliente}/{marca}" \
       --workers 5 --tor

     Retry com re-login em falha. Debug screenshot em erro.

3.2  Busca exata cross-class (todas as 45 classes):

     Buscar nome completo exato sem filtro de classe.
     Se encontrar marca idêntica fora do perímetro:
       → salvar coleta/cross-class-alerta.json
       → flag CROSS_CLASS pro review

3.3  Consolidar:
     - Deduplicar por número de processo
     - Classificar buckets (A=vivas, B=indeferidas, C=mortas)
     - Gravar fonte-bruta.json (master)
```

**Próxima etapa:** → ETAPA 4

---

## ETAPA 4 — Joga script ordenando por termos distintivos

**Task:** `tasks/laudo-v4-triagem.md`
**Script:** `filtro_heuristica.py`

**Input:** fonte-bruta.json + termos classificados
**Output:** triagem-resultado.json + .md de review com checkboxes

```
4.1  Filtrar só Bucket A (vivas):
     Mortas e indeferidas são removidas da triagem humana.
     Bucket B (indeferidas) vai pra ETAPA 5 como fonte de precedentes.

4.2  Classificar cada marca em T1-T5:

     T1 — Contém elemento DISTINTIVO exato
     T2 — Elemento foneticamente próximo do DISTINTIVO (forte)
     T3 — Fonética fraca + contexto (descritivo ou mesma classe)
     T4 — Match apenas com elemento DESCRITIVO
     T5 — Nenhum match relevante

     python3 filtro_heuristica.py \
       --marca "{marca}" \
       --elementos "TRION:DISTINTIVO,PARCEIROS:DESCRITIVO,CONDOMINIO:DESCRITIVO" \
       --pasta "laudos/{cliente}/{marca}" --classes {aprovadas}

4.3  Levantar flags automáticos:

     FLAG CAMPO_SATURADO:
       Contar marcas vivas com mesmo radical do DISTINTIVO na classe.
       Se > 5 → flag ativo. Consequência: piso NEUTRA na calibragem.

     FLAG HISTORICO_REJEICAO:
       Contar marcas Bucket B (indeferidas) com mesmo radical,
       mesma classe, mesmo artigo, sem bloqueador citado.
       Se > 3 → flag ativo. Consequência: piso NEUTRA.

     FLAG CROSS_CLASS:
       Se Etapa 3.2 encontrou marca idêntica fora do perímetro.
       Consequência: incluir no review humano.

4.4  Gerar .md de revisão:
     {marca} - TRIAGEM.md

     Formato:
     - [x] = Mira recomenda investigar (T1 + T2 relevantes)
     - [ ] = Mira acha que não precisa (T2 ruído + T3)
     - Flags destacados no topo
     - T4 e T5: só contagem, não listados
     - Ordenado do mais relevante ao menos
```

**◆ CHECKPOINT 2:** Usuário revisa checkboxes, checa/descheca, salva.
**Próxima etapa:** → ETAPA 5

---

## ETAPA 5 — Triangulação

**Task:** `tasks/laudo-v4-triangulacao.md`
**Scripts:** `coletar_precedentes.py`, `coletar_specs.py`

**Input:** marcas aprovadas pelo usuário no CP2 + Bucket B relevantes
**Output:** triângulos confirmados/frustrados, postura calibrada

Esta etapa tem 4 sub-etapas que rodam em sequência:

### 5A — Abrir fichas e identificar candidatos a triângulo

```
Para cada marca aprovada no CP2 (T1-T3 checadas)
+ marcas Bucket B relevantes (indeferidas com mesmo radical):

  5A.1  Abrir processo no INPI (ficha individual)
  5A.2  Ler despachos
  5A.3  Extrair fatos — SOMENTE o que está escrito:
        - Status atual
        - Motivo literal do indeferimento (se houver)
        - Nº do processo bloqueador CITADO (se houver)
        - Oposições recebidas (se houver)
  5A.4  Se despacho não cita bloqueador:
        → registrar "bloqueador: não identificado no despacho"
        → NUNCA deduzir

  5A.5  Classificar por decisão de mérito:

        COM decisão de mérito → candidato a triângulo:
          - Em vigor/deferida → candidato COEXISTÊNCIA
          - Indeferida (com bloqueador citado) → candidato BLOQUEIO
          - Indeferida (sem bloqueador) → OPACO (contribui pro flag, não forma triângulo)
          - Extinta após vigor → candidato COEXISTÊNCIA (histórico)

        SEM decisão de mérito → lista de AMEAÇAS ATIVAS:
          - Aguardando exame, recurso, oposição, etc.
          - Entra no laudo como risco, não como precedente

  5A.6  Ranquear candidatos:
        1º Bloqueio na classe core
        2º Bloqueio em classe adjacente
        3º Coexistência na classe core
        4º Coexistência em classe adjacente

  Output: fichas/candidatos-triangulo.json
```

### 5B — Buscar specs e confirmar/frustrar triângulos (ITERATIVO)

```
Para cada candidato a triângulo, EM ORDEM de relevância:

  ┌─────────────────────────────────────────────────────┐
  │                                                     │
  │  PASSO 1 — Buscar spec do PRECEDENTE (nível 1)      │
  │  Abrir processo, extrair especificação completa.    │
  │                                                     │
  │  PASSO 2 — Spec sobrepõe atividade do cliente?      │
  │  ├─ NÃO → TRIÂNGULO FRUSTRADO                      │
  │  │        Registrar. Próximo candidato.              │
  │  └─ SIM → Continuar                                 │
  │                                                     │
  │  PASSO 3 — Buscar spec do BLOQUEADOR (nível 2)      │
  │  Abrir processo do bloqueador citado.               │
  │  Extrair especificação completa.                    │
  │                                                     │
  │  PASSO 4 — Classificar triângulo:                   │
  │  ├─ Spec bloqueador sobrepõe → CONFIRMADO           │
  │  ├─ Spec bloqueador não sobrepõe → PARCIAL          │
  │  └─ Bloqueador não identificado → OPACO             │
  │                                                     │
  │  PASSO 5 — Registrar triângulo com fato completo:   │
  │  {                                                  │
  │    "nosso": "TRION PARCEIROS DO CONDOMÍNIO",        │
  │    "precedente": {                                  │
  │      "marca": "TRIOM GESTÃO",                       │
  │      "processo": "912345678",                       │
  │      "status": "Indeferida",                        │
  │      "spec": "administração de condomínios...",     │
  │      "motivo_literal": "art. 124, XIX"              │
  │    },                                               │
  │    "bloqueador": {                                  │
  │      "marca": "TRITON",                             │
  │      "processo": "827456123",                        │
  │      "status": "Em vigor",                          │
  │      "spec": "gestão predial e condominial..."      │
  │    },                                               │
  │    "tipo": "CONFIRMADO",                            │
  │    "fato": "TRIOM GESTÃO foi indeferida citando      │
  │            TRITON. Ambas com spec sobrepondo         │
  │            atividade do cliente."                    │
  │  }                                                  │
  │                                                     │
  │  PASSO 6 — Já tenho padrão claro?                   │
  │  ├─ 3+ confirmados negativos → PARAR, padrão claro  │
  │  ├─ 5+ frustrados consecutivos → campo livre?       │
  │  │   → continuar com indiretas (5C)                 │
  │  └─ Mistura → próximo candidato                     │
  │                                                     │
  └─────────────────────────────────────────────────────┘

  Profundidade máxima: 2 saltos.
  Se bloqueador se revela ameaça direta → reclassificar.
  NUNCA abrir processo do "bloqueador do bloqueador".

  Output:
    triangulacao/triangulos-confirmados.json
    triangulacao/triangulos-frustrados.json
    triangulacao/triangulos-opacos.json
    triangulacao/specs-coletadas/{processo}-spec.json
```

### 5C — Calibrar postura

```
Inputs para calibragem:
  - Triângulos confirmados/frustrados
  - Flags da Etapa 4 (CAMPO_SATURADO, HISTORICO_REJEICAO, CROSS_CLASS)

Regras:

  SE 1+ triângulo de bloqueio confirmado na classe core:
    → RESTRITIVA
    → Ameaças diretas bastam. Poucas specs adicionais.

  SE flag CAMPO_SATURADO ou HISTORICO_REJEICAO:
    → Piso NEUTRA (nunca ABERTA mesmo sem triângulos)

  SE mistura de confirmados e frustrados:
    → NEUTRA
    → Investigar T1-T2 completos + T3 seletivos.

  SE todos frustrados + nenhum flag:
    → ABERTA
    → MAS: obrigatório expandir pra indiretas (5D)

  Output: triangulacao/postura.json
```

### 5D — Expansão por postura (se ABERTA)

```
  Postura ABERTA não significa parar. Significa EXPANDIR:

  5D.1  Pegar marcas T3-T4 das classes adjacentes
  5D.2  Repetir 5A-5B pra essas (fichas → specs → triângulos)
  5D.3  Se indiretas revelam risco:
        → Recalibrar pra NEUTRA
        → Voltar pra 5B com novos candidatos
  5D.4  Se indiretas também limpas:
        → Viabilidade confirmada com cobertura
        → Postura ABERTA sustentada

  A viabilidade só se confirma quando diretas E indiretas
  foram verificadas. Ausência de ameaça direta NÃO é
  suficiente — precisa confirmar que indiretas também estão limpas.
```

**◆ CHECKPOINT 3:** Usuário revisa triângulos confirmados + postura.

Formato do review:
```markdown
## Postura: RESTRITIVA
Base: 2 triângulos de bloqueio na cl.36 com spec sobrepondo atividade.

## Triângulos confirmados
- [x] BLOQUEIO: TRIOM (proc. 912345678) indeferida citando TRITON (proc. 827456123)
      Spec TRIOM: "administração de condomínios..."
      Spec TRITON: "gestão predial e condominial..."
      Fato: ambas com spec sobrepondo atividade do cliente.

## Triângulos frustrados
- TRIONEX (proc. 111222333) — spec: "desenvolvimento de software" — sem sobreposição

## Ameaças ativas (sem decisão de mérito)
- TRION TECH (proc. 444555666) — aguardando exame — cl.42
```

**Próxima etapa:** → ETAPA 6

---

## ETAPA 6 — Laudo narrativo

**Task:** `tasks/laudo-v4-laudo.md`

**Input:** triângulos aprovados no CP3 + postura
**Output:** PARTE 2 do PLANO DE ANÁLISE

```
6.1  Escrever PARTE 2 baseada nos triângulos confirmados:

     - Tom de advogado sênior, parágrafos contínuos
     - Triângulos apresentados como FATOS OBSERVADOS
     - Precedentes e motivos citados literalmente
     - Specs por extenso onde relevante
     - Ameaças ativas listadas como risco (não precedente)

6.2  Veredito baseado na postura:

     RESTRITIVA → "Recomenda-se não prosseguir" + chance ~10-30%
     NEUTRA → "Risco moderado, apresenta-se cenário" + chance ~40-60%
     ABERTA → "Viabilidade confirmada" + chance ~70-90%

6.3  Recomendações ao cliente:
     - Se negativo: sugerir alternativas (novo nome, ajuste)
     - Se positivo: classes recomendadas + ressalvas

6.4  Disclaimer obrigatório:
     "Esta análise abrange exclusivamente colidências nominativas.
      Para marcas mistas e figurativas, recomenda-se análise
      complementar de trade dress."

6.5  NUNCA usar:
     - "Provavelmente será indeferido/deferido"
     - "Deduz-se", "infere-se", "conclui-se que o INPI vai..."
     - Bullets ou tabelas na narrativa
```

**Próxima etapa:** → ETAPA 7

---

## ETAPA 7 — Entrega

**Task:** `tasks/laudo-v4-gerar.md`

**Input:** PLANO DE ANÁLISE completo (Parte 1 + Parte 2)
**Output:** PDF, upload Drive, card ClickUp atualizado

```
7.1  Gerar PDF:
     python3 gerar_laudo_reportlab.py "{plano}.md"

7.2  Gerar DOCX (se necessário):
     python3 gerar_docx_builder.py "{plano}.md"

7.3  Upload Google Drive

7.4  Anexar PDF no card ClickUp

7.5  Mover card para "feito"

7.6  Gerar metadados:
     {marca} - Sobre o laudo.md
```

---

## Regras do Workflow

### Regras de execução
1. Cada etapa só inicia após a anterior concluir
2. Checkpoints são BLOQUEANTES — o workflow para até o usuário aprovar
3. Se o usuário rejeitar no checkpoint → voltar pra etapa anterior, ajustar
4. Se INPI falhar → retry com re-login (max 3 tentativas por busca)

### Regras de dados
5. Nunca deduzir — só relatar fatos lidos no processo
6. Bucket A na triagem humana, Bucket B nas fichas/precedentes
7. Triangulação só com decisão de mérito
8. Spec só dentro de triângulo candidato (economia)
9. Profundidade máx 2 saltos na cadeia de specs
10. Tradução obrigatória de termos estrangeiros

### Regras de calibragem
11. Flag CAMPO_SATURADO (>5 radicais vivos) → piso NEUTRA
12. Flag HISTORICO_REJEICAO (>3 indeferimentos opacos) → piso NEUTRA
13. Postura ABERTA = expandir pra indiretas, não parar
14. Parar quando padrão claro, não quando lista esgotada

---

```yaml
metadata:
  version: 4.0.0
  squad: laudo-viabilidade
  workflow_type: sequential_with_checkpoints
  agent: laudo-v4
  etapas: 7
  checkpoints: 3
  tasks:
    - laudo-v4-disparo.md
    - laudo-v4-decomposicao.md
    - laudo-v4-coleta.md
    - laudo-v4-triagem.md
    - laudo-v4-triangulacao.md
    - laudo-v4-laudo.md
    - laudo-v4-gerar.md
  scripts:
    - coletar_lista.py
    - filtro_heuristica.py
    - coletar_precedentes.py
    - coletar_specs.py
    - gerar_laudo_reportlab.py
    - gerar_docx_builder.py
  tags: [workflow, laudo, v4, triangulacao, viabilidade]
  updated_at: 2026-04-22
```
