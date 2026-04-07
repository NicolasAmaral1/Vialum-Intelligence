# PLANO GERAL — Laudo de Viabilidade Marcária v3

> **Status:** Em construção — revisão colaborativa
> **Data:** 30/03/2026

---

## 1. VISÃO

Produzir um laudo de viabilidade marcária com qualidade de escritório de PI sênior, fundamentado em dados reais do INPI, com inteligência de precedentes e análise de desgaste — tudo automatizado, mas com checkpoints humanos nos momentos críticos.

**Diferencial:** Não é só "tem marca parecida ou não". É: "o INPI, nesta classe, com este radical, tem histórico de barrar ou aceitar? Quem bloqueou quem? As specs se sobrepõem? Há convivência comprovada?"

---

## 2. PIPELINE — VISÃO DE 8 FASES

```
PRELIMINAR (já existe)
  Fase 0 — Monitorar ClickUp / receber caso
  Fase P — Análise Intrínseca (PARTE 1): VERACIDADE, LICEIDADE, DISTINTIVIDADE
         → Sugere classes NCL + especificações
         → CHECKPOINT 1 (aprovação das classes)

INTELIGÊNCIA (novo — coração do v3)
  Fase 1 — COLETA: Playwright raspa INPI, separa buckets A/B/C
  Fase 2 — PENEIRA: IA filtra relevantes por bucket
  Fase 3 — APROFUNDAMENTO (3 trilhas paralelas):
           3A — Specs das vivas (Playwright)
           3B — Cadeia de precedentes (Playwright + IA)
           3C — Mapa de coexistência e desgaste (IA)
  Fase 4 — DECISÕES: IA cruza precedentes + isonomia
  Fase 5 — VEREDITO: IA emite parecer individual por marca

ENTREGA
  Fase 6 — RELATÓRIO TÉCNICO → CHECKPOINT 1.5
  Fase 7 — NARRATIVA JURÍDICA (PARTE 2) → CHECKPOINT 2
  Fase 8 — GERAÇÃO: PDF + DOCX + Drive + ClickUp
```

---

## 3. ATORES — QUEM FAZ O QUÊ

### 3.1 Scripts Python/Playwright (sem IA)

Responsabilidade: **coletar e salvar dados exatamente como o INPI apresenta.** Não interpretam, não filtram, não julgam.

| Script | Fase | O que faz |
|--------|------|-----------|
| `coletar_lista.py` | 1 | Busca fuzzy paralela (1 browser/classe), extrai lista (nº + nome + situação + titular + %), separa buckets, grava fonte-bruta.json |
| `coletar_specs.py` | 3A | Recebe lista de processos, abre fichas, expande specs via JS, salva specs completas. N workers paralelos. |
| `coletar_precedentes.py` | 3B.1 | Recebe lista de processos (indeferidos+mortas), abre fichas completas com despachos. N workers paralelos. |
| `coletar_bloqueadores.py` | 3B.3 | Recebe fila de bloqueadores (com rastreabilidade), busca fichas + specs. Workers paralelos. |
| `gerar_laudo_reportlab.py` | 8 | Gera PDF (já existe) |
| `gerar_docx_builder.py` | 8 | Gera DOCX (já existe) |
| `google_drive_service.py` | 8 | Upload Drive (já existe) |

**Regra:** Scripts NUNCA inventam dados. Se o INPI não retornou, não existe.

### 3.2 IA Analítica (agente sem persona)

Responsabilidade: **analisar dados estruturados (JSONs) e produzir classificações, pareceres e cruzamentos.** Trabalha com dados já coletados, nunca inventa.

| Tarefa | Fase | Input | Output |
|--------|------|-------|--------|
| Peneira vivas | 2 | bucket-a-vivas.json + dados do caso | peneira-resultado.json (sim/não por marca) |
| Peneira precedentes | 2 | bucket-b + bucket-c + dados do caso | peneira-resultado.json (sim/não por marca) |
| Extrair cadeia de bloqueio | 3B.2 | precedentes-fichas.json (despachos) | precedentes-cadeia.json + fila-busca-bloqueadores.json |
| Mapa de coexistência | 3C | bucket-a completo + precedentes-cadeia | mapa-coexistencia.json |
| Análise de decisões | 4 | precedentes-cadeia + bloqueadores-fichas + mapa-coexistencia | precedentes-analise.json |
| Veredito individual | 5 | specs-completas + precedentes-analise + mapa-coexistencia + dados do caso | vereditos-individuais.json |

**Regra:** Sempre cita número de processo e spec COPIADA do JSON. Nunca parafraseia specs. Se o dado não está no JSON, diz que não está.

### 3.3 Mira ⚖️ (persona — redatora jurídica)

Responsabilidade: **transformar inteligência estruturada em documentos com tom de advogado sênior de PI.**

| Tarefa | Fase | Input | Output |
|--------|------|-------|--------|
| Análise preliminar | P | Dados do caso + know-how NCL | PARTE 1 do PLANO DE ANÁLISE |
| Relatório técnico | 6 | Todos os JSONs das fases 1-5 | RELATÓRIO TÉCNICO DE COTEJO.md |
| Narrativa jurídica | 7 | Relatório técnico aprovado | PARTE 2 do PLANO DE ANÁLISE |

**Regra:** Mira NUNCA acessa o INPI diretamente. Trabalha exclusivamente a partir dos artefatos já produzidos.

### 3.4 Orquestrador

Responsabilidade: **chamar cada fase na ordem certa, passar inputs/outputs entre fases, gerenciar erros.**

Opções de implementação (decisão em aberto):
- **A) Claude Code CLI** com `@laudo *nova-analise` rodando as fases sequencialmente
- **B) genesis-laudo web app** chamando scripts + Claude API em sequência
- **C) Script Python orquestrador** que chama scripts e faz chamadas à API Claude

---

## 4. FLUXO DE DADOS

```
fonte-bruta.json (MASTER — cresce a cada fase)
  │
  ├── Fase 1 adiciona: número, nome, situação, titular, %, bucket, fonte
  ├── Fase 2 adiciona: peneira.resultado, peneira.justificativa, peneira.destino
  ├── Fase 3A adiciona: especificacao_completa (para vivas filtradas)
  ├── Fase 3B adiciona: despachos[], historico_decisoes[], bloqueador{}, resultado_final
  ├── Fase 3C adiciona: cluster_radical, desgaste_grau, titulares_distintos_no_cluster
  ├── Fase 4 adiciona: isonomia{}, padrao_inpi
  └── Fase 5 adiciona: veredito{}, cotejo{}, afinidade{}, estrategia
```

**Princípio:** Cada fase ENRIQUECE o fonte-bruta.json, nunca sobrescreve. No final, cada processo tem o histórico completo de como foi analisado.

**Validação:** Um script de verificação (`validar_integridade.py`) pode cruzar qualquer número de processo citado no relatório com o fonte-bruta.json e confirmar que existe e que os dados batem.

---

## 5. CRÍTICA HONESTA DO DESIGN ATUAL

### O que está bom

1. **Separação coleta × inteligência × redação** — cada camada tem responsabilidade clara
2. **fonte-bruta.json como fonte da verdade** — rastreabilidade total
3. **Peneira antes de coletar specs** — evita buscar fichas de 161 marcas quando 35 bastam
4. **Cadeia de bloqueio com rastreabilidade** — munição jurídica real
5. **Mapa de coexistência** — prova concreta de desgaste fundamentada em dados
6. **Checkpoints humanos** — 3 pontos de revisão antes do documento final

### O que me preocupa

**A) Peneira (Fase 2) pode ser frágil**

A IA julga "traria problema?" com base APENAS em nome + classe + situação. Não tem spec ainda. Para marcas com nome obviamente diferente (ex: "PLANITUDO" vs "PLENYA"), tudo bem. Mas para nomes ambíguos (ex: "PLENA" vs "PLENYA"), a IA pode errar sem ver a spec.

→ **Risco:** Falso negativo na peneira = marca perigosa descartada antes de ver sua spec.
→ **Mitigação possível:** Ser ultra-permissivo na peneira (na dúvida, inclui). Melhor buscar 50 fichas do que perder 1 colidência real.

**B) Contexto da IA pode estourar**

Se Plenya tem 35 vivas relevantes + 28 precedentes + 15 bloqueadores = 78 fichas com specs completas + despachos. Isso pode ser 200K+ tokens. Uma sessão Claude não processa tudo de uma vez.

→ **Risco:** IA perde informação por limitação de contexto.
→ **Mitigação possível:** Processar em lotes por classe. Ou usar agentes separados por fase, cada um com contexto limpo.

**C) Fase 3C (coexistência) depende de 3A e 3B**

3A (specs) e 3B (precedentes) rodam em paralelo, mas 3C precisa de AMBOS. Se 3B demora (cadeia de 2 níveis), 3C fica esperando.

→ **Risco:** Gargalo na fase 3.
→ **Mitigação:** 3C pode começar parcialmente com dados de 3A enquanto 3B termina.

**D) A "busca geral" (sem classe) pode trazer muito ruído**

Na busca do Plenya, a geral trouxe 79 marcas extras em classes que não nos interessam. Essas 79 passam pela peneira e provavelmente 70+ serão descartadas.

→ **Risco:** Tempo gasto na peneira com marcas de classes irrelevantes.
→ **Mitigação:** Na peneira, descartar automaticamente (sem IA) marcas em classes sem afinidade com a atividade. Só passar pra IA as que estão em classes adjacentes.

**E) Dois níveis de cadeia pode virar rabbit hole**

Se o bloqueador do bloqueador também foi indeferido, estamos 3 níveis de distância da nossa marca. A relevância cai exponencialmente.

→ **Risco:** Perder tempo buscando cadeias profundas com pouco valor.
→ **Mitigação:** Manter cap de 2 níveis. Nível 2 só se o nível 1 for "indeferido_mantido" (forte precedente).

**F) Falta definir como lidar com volume alto**

Para "Essenza" (500+ resultados), mesmo com peneira, podemos ter 80+ marcas relevantes. O relatório técnico com 80 seções individuais ficaria imenso.

→ **Risco:** Relatório técnico com 80 marcas vira ilegível.
→ **Mitigação:** Agrupar por tier de risco. Detalhar individualmente só as COLIDÊNCIA PROVÁVEL e POSSÍVEL. As REMOTAS vão em tabela resumo.

---

## 6. PERGUNTAS QUE PRECISO RESPONDER CONTIGO

### Arquitetura

**P1. Orquestração:** Quem roda o pipeline?
- (a) Tu na CLI com `@laudo *nova-analise` e o Claude vai chamando scripts?
- (b) O genesis-laudo web app fazendo tudo em background?
- (c) Um script Python master que orquestra tudo?
- Isso define se a IA analítica é o mesmo Claude da CLI ou chamadas separadas à API.

**P2. Contexto da IA:** Se uma análise tem 80 marcas relevantes com specs + despachos, como gerenciar?
- (a) Uma sessão Claude processa tudo (arrisca perder contexto)
- (b) Processamento em lotes de 10 marcas, salvando JSON incremental
- (c) Um agente por fase, cada um começa do zero lendo os JSONs
- Minha sugestão: (b) — lotes, com cada lote gerando output parcial que é consolidado no final.

**P3. Peneira — qual o threshold de permissividade?**
- Hoje `filtrar_colidencias.py` usa score ≥ 15 (conservador).
- A peneira por IA deveria ser mais ou menos permissiva que o score numérico?
- Minha sugestão: score numérico como primeira camada (descarta < 10), IA como segunda camada (decide os 10-40).

### Negócio

**P4. Quem é o "cliente" do relatório técnico?**
- (a) Só tu (Nicolas) — documento de trabalho interno para revisar antes do laudo
- (b) A equipe (Avelum) — documento que analistas consultam
- (c) O cliente final — vê o relatório junto com o laudo
- Isso define o nível de detalhe e a linguagem.

**P5. O laudo final (PARTE 2) deve citar precedentes explicitamente?**
- Hoje o laudo cita números de processo e specs.
- No v3, temos cadeias de bloqueio e isonomia. O cliente deve ver isso no laudo?
- Ou isso fica só no relatório técnico e o laudo fica mais "parecer geral"?

**P6. Tempo aceitável para gerar um laudo completo?**
- Pipeline v3 completo: ~30-40 minutos.
- É aceitável? Ou precisa ser < 15 minutos?
- Se precisa ser mais rápido, onde cortar?

### Qualidade

**P7. Como validar que a IA não alucionou?**
- (a) Script que cruza automaticamente relatório × fonte-bruta.json
- (b) Tu revisa manualmente no checkpoint
- (c) Ambos
- Minha sugestão: (c) — script automático como primeiro gate, tu como segundo.

**P8. O que fazer quando o INPI não tem despachos detalhados?**
- Muitas fichas antigas não têm motivo de indeferimento explícito.
- Nesses casos, registrar como "motivo não disponível" ou tentar inferir?
- Minha sugestão: registrar "não disponível" — nunca inventar.

**P9. Marcas de alto renome / notoriamente conhecidas:**
- O pipeline busca por similaridade na base do INPI. Mas marcas de alto renome são protegidas em TODAS as classes.
- Precisamos de uma verificação separada? ("Plenya" parece com alguma marca de alto renome?)
- Minha sugestão: sim, uma checagem rápida na lista oficial de marcas de alto renome do INPI.

### Escopo

**P10. Esse pipeline funciona só para marcas nominativas ou também mistas/figurativas?**
- A análise fonética/gráfica/ideológica é focada em nominativas.
- Para mistas, precisaríamos analisar o elemento figurativo também.
- Como estão os clientes? Maioria nominativa?

**P11. O pipeline deve funcionar para qualquer atividade ou tem foco?**
- Hoje a proposta cita "serviços de saúde" com agravante do INPI.
- O design é genérico o suficiente para funcionar com "comércio de roupas" ou "software"?
- Minha sugestão: sim, genérico — o agravante de saúde é um flag, não uma regra hard-coded.

**P12. Precedentes devem ser compartilhados entre laudos?**
- Se analisamos "Plenya" e descobrimos que PLENUS bloqueia tudo na classe 44, essa info serve para um futuro laudo de "Plennus" ou "Plenvita".
- Manter um `precedentes-globais.json` compartilhado?
- Ou cada laudo é independente?

---

## 7. PRÓXIMOS PASSOS (após responder as perguntas)

1. **Aprovar o design** — fechar decisões abertas
2. **Implementar `coletar_lista.py`** — Fase 1 (script Playwright, paralelo)
3. **Implementar peneira** — Fase 2 (decidir se IA pura ou híbrido com score)
4. **Implementar `coletar_specs.py`** — Fase 3A (refatorar do script atual)
5. **Implementar `coletar_precedentes.py`** — Fase 3B (novo)
6. **Criar synapse `cotejo-inpi`** — regras do Manual de Marcas para Fase 5
7. **Criar tasks do squad** — 1 task .md por fase
8. **Atualizar workflow `nova-analise.md`** — pipeline v3
9. **Testar com Plenya** — caso real, dados já coletados
10. **Calibrar thresholds** — ajustar peneira e vereditos com base no caso real

---

```yaml
metadata:
  status: em_construcao
  versao: 3.0-draft
  perguntas_pendentes: 12
  tags: [plano-geral, squad-v3, pipeline, arquitetura]
```
