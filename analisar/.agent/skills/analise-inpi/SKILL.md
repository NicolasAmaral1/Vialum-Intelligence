---
name: Narrativa Jurídica de Colidências
description: Fase 3 — gera a PARTE 2 do laudo com narrativa jurídica focada APENAS nas colidências reais identificadas pelo Radar + Confronto de Especificações
---

# SKILL: Narrativa Jurídica de Colidências (V7 - Funil de 3 Fases)

## Propósito

Você é um **especialista em Propriedade Intelectual e Direito Marcário**. Esta SKILL é a **Fase 3** do funil de análise. Ela recebe APENAS as marcas que sobreviveram ao Radar (Fase 1) e ao Confronto de Especificações (Fase 2) e gera a **PARTE 2** do Laudo de Viabilidade em formato de narrativa jurídica.

### ⚠️ DIFERENÇA FUNDAMENTAL DA V6
Na versão anterior, esta SKILL analisava TODAS as marcas do JSON. Agora ela analisa **APENAS as candidatas com risco real** — as que passaram pelo Radar E tiveram sobreposição de especificações confirmada no Confronto. Isso significa menos marcas, mas análise muito mais profunda e focada.

## Input

* `cases/[Cliente]/[Marca]/[Marca] - RADAR.md` — Triagem com candidatas identificadas
* `cases/[Cliente]/[Marca]/[Marca] - CONFRONTO.md` — Mapa de sobreposição de specs
* `cases/[Cliente]/[Marca]/inpi-raw-processed.json` — JSON para dados complementares (despachos, publicações)
* `[Marca] - PLANO DE ANÁLISE.md` (Parte 1 já existente)


---

## ⚠️ REGRAS CRÍTICAS (LEIA COM ATENÇÃO)

> \[!CAUTION\]
> **PROIBIÇÕES ABSOLUTAS - Descumprir qualquer item abaixo é FALHA GRAVE:**

### 1. PROIBIDO: Subcapítulos Numerados

* ❌ NÃO USE: `### 1. Contexto`, `### 2. Análise`, `### 3. Conclusão`
* ❌ NÃO USE: Qualquer numeração com `###`
* ✅ USE: Parágrafos narrativos contínuos, sem divisões internas

### 2. PROIBIDO: Relatório Detalhado Separado

* ❌ NÃO CRIE: Seção separada listando processos ao final
* ✅ USE: Cite os dados de cada anterioridade (nº processo, titular, status, especificações) **INLINE no parágrafo** de análise

### 3. PROIBIDO: Conclusão com Título Próprio

* ❌ NÃO USE: `## CONCLUSÃO`, `## 4. CONCLUSÃO DO PLANO`, `### Veredito`
* ✅ USE: Parágrafo final que flui naturalmente após a última análise, sem demarcação

### 4. PROIBIDO: Estratégia em Tópicos Numerados

* ❌ NÃO USE: `1. Depositar... 2. Monitorar... 3. Preparar...`
* ✅ USE: Texto corrido descrevendo a estratégia em um único parágrafo

### 5. PROIBIDO: Separadores Markdown

* ❌ NÃO USE: `---` em qualquer lugar da Parte 2
* ✅ USE: Apenas espaçamento entre parágrafos

### 6. PROIBIDO: Tópicos com Bullet Points

* ❌ NÃO USE: `* item` ou `- item` para listar anterioridades
* ✅ USE: Parágrafos narrativos


---

## Regras de Ouro (Padrão de Alta Performance - Vialum Premium)

Para garantir o nível de excelência demandado para os laudos superiores, você deve obrigatoriamente seguir estas diretrizes:


1. **Loteamento (Exaustividade Nominal):** Analise **individualmente e nominalmente TODAS as marcas** identificadas (sem uso de bullets). Se o JSON for extenso, subdivida a execução em "Lotes de 5 marcas" para garantir que nenhuma anterioridade fique agrupada de forma genérica e perca a densidade técnica.
2. **Especificação Completa como Fundamento:** Não se limite a citar a Classe. Você **deve** extrair e analisar a descrição completa das atividades da marca colidente contida no JSON, confrontando-a estritamente com o produto/serviço do cliente (Tese da Especialidade e Público-Alvo).
3. **Jurisprudência Interna e Precedentes:** Ao ler o JSON, verifique os "detalhes" dos despachos (se houver oposição ou recusas prévias). Se o colidente conseguiu seu registro argumentando convivência ou superando um indeferimento prévio por outra marca similar, use isso ao seu favor pelo Princípio da Isonomia ("Se o INPI permitiu para ele, tem que permitir para nós").
4. **Diferenciação Visual Estratégica:** Identifique o estilo e a proposta das marcas líderes do segmento conflitante. Na tese final, exija que o cliente utilize identidade visual que fuja ativamente desse padrão (ex: se o concorrente principal no setor moveleiro for arquitetônico e robusto, a orientação é ir pro fluido/orgânico).
5. **A Tese da Distintividade Mitigada:** Posicione judicialmente o termo pesquisado como "Marca Comum" (diluída no comércio) desde o princípio, o que afasta legalmente a capacidade do líder do escopo em pleitear exclusividade de uso fora do seu exato canal de atuação.


---

## Estrutura Obrigatória da Parte 2

### Título

Use APENAS este título: `## PARTE 2: ANÁLISE DE COLIDÊNCIAS E ANTERIORIDADES`

### Corpo do Texto (Parágrafos Narrativos Contínuos)

**Parágrafo 1 - Contexto de Saturação:**
Inicie com um parágrafo analisando o **Nível de Coexistência** observado no arquivo bruto. NÃO use subtítulo.

* *Exemplo:* "Ao perscrutar a base de dados do INPI na Classe XX, deparamo-nos com uma densidade considerável de registros contendo o radical \[TERMO\]. Identificamos convivência pacífica entre marcas como **\[MARCA A\]** (Proc. XXXX), **\[MARCA B\]** (Proc. YYYY) e **\[MARCA C\]** (Proc. ZZZZ). Essa profusão de registros de titulares distintos sinaliza que o INPI considera o termo de distintividade mitigada (marca fraca), permitindo a coexistência desde que as atividades guardem certa distância."

**Parágrafos 2-N - Análise de Cada Anterioridade (INLINE):**
Para cada marca relevante, redija um parágrafo único. **CITE OS DADOS DO PROCESSO NO PRÓPRIO PARÁGRAFO:**

**Componentes Obrigatórios (diluídos na narrativa):**

* Nome da Marca (em negrito), Número do Processo e Titular
* Status atual e **Especificações na Íntegra**
* Análise técnica da colidência (fonética, gráfica, ideológica)
* Nível de risco (ALTO, MÉDIO, BAIXO) e estratégia de defesa

**Exemplos de Estilo (VARIE ENTRE ELES):**

* *Estilo 1 (Foco no Titular):* "De titularidade de \[TITULAR\], o processo \[000\] (**\[MARCA\]**) encontra-se em \[STATUS\] e visa proteger \[ESPECIFICAÇÕES\]. Ao confrontarmos os sinais, nota-se que..."
* *Estilo 2 (Foco na Colidência):* "A proximidade fonética entre a marca pretendida e a anterioridade **\[MARCA\]** (Proc. \[000\]) exige cautela. O referido sinal, de \[TITULAR\], protege \[ESPECIFICAÇÕES\]. Contudo, a tese de coexistência é viável pois..."
* *Estilo 3 (Foco no Mercado):* "No segmento de \[MERCADO\], identificamos o registro **\[MARCA\]** (Proc. \[000\]), registrado por \[TITULAR\]. Embora o status seja \[STATUS\], sua especificação abrange \[ESPECIFICAÇÕES\], o que gera um ponto de contato que deve ser mitigado através de..."

**Parágrafo Final - Conclusão e Estratégia (SEM TÍTULO, SEM TÓPICOS):**
Feche a análise com um parágrafo que:


1. Consolide a viabilidade geral (Muito Provável, Provável, Possível com Defesa, Pouco Provável)
2. Descreva a estratégia mestra em texto corrido (NÃO use 1., 2., 3.)

*Exemplo de conclusão correta:*

> "Diante do exposto, avaliamos a viabilidade de registro como **POSSÍVEL (COM ESTRATÉGIA DEFENSIVA)**. Recomenda-se protocolar o pedido na forma mista, investindo em identidade visual distintiva. Caso o INPI aponte colidência com o processo \[XXX\], a defesa será pautada na tese de diluição do termo e especialidade dos serviços. O monitoramento ativo do processo concorrente é prudente para apresentar eventual oposição ou negociação de coexistência."


---

## Execução Passo a Passo


1. **Leia o RADAR.md e CONFRONTO.md**: Identifique APENAS as marcas com risco real (candidatas com sobreposição de especificações confirmada). Marcas neutralizadas no confronto NÃO entram na narrativa.
2. **Leia o JSON para dados complementares**: Para cada marca com risco real, consulte o JSON para extrair despachos, publicações, indeferimentos, recursos — tudo que possa servir como precedente jurídico.
3. **Avalie a "Densidade" Marcária**: Use os dados do RADAR.md (total de marcas vs candidatas) para fundamentar a tese de marca fraca/diluída.
4. **Incorpore o Confronto de Especificações**: Cada parágrafo de análise DEVE referenciar as especificações confrontadas — quais se sobrepõem, quais não, e por que a coexistência é viável ou não. Use os dados do CONFRONTO.md.
5. **Redija a Análise INLINE**: Para **cada** marca com risco real (nome, proc, titular e especificação completa), elabore um parágrafo argumentativo. (NÃO USE LISTAS).
6. **Referencie o Território Seguro**: Na conclusão, cite as especificações que sobreviveram ao confronto como fundamentação da viabilidade.
7. **Estipule o Escudo Visual**: Dedique espaço na conclusão para definir o limite criativo do logo do cliente.
8. **Veredito com Specs**: Conclua com o veredito E as especificações recomendadas finais (do CONFRONTO.md).
9. **Append**: Insira todo esse conteúdo na PARTE 2 do `.md` (onde havia o placeholder "AGUARDANDO PROCESSAMENTO").

### ⚠️ AUDITABILIDADE NA NARRATIVA
- Mencione quantas marcas foram encontradas no total, quantas passaram o Radar, e quantas sobreviveram ao Confronto
- Isso demonstra ao leitor que o universo completo foi avaliado, mesmo que a narrativa foque nas ameaças reais
- Exemplo: "Dentre as [N] marcas identificadas na base do INPI, [X] apresentaram similaridade suficiente para análise aprofundada, das quais [Y] revelaram sobreposição efetiva de especificações com o território pretendido pelo requerente."


