# Regras de Negócio e Diretrizes de Redação - Vialum

Este arquivo contém regras rígidas que devem ser observadas em todos os atendimentos e gerações de documentos.

## 1. Arquitetura do Funil de Análise (3 Fases)

O sistema de análise de colidências opera em **3 fases progressivas**, cada uma afunilando o universo de marcas:

* **Fase 1 — Radar de Similaridade**: Triagem rápida de TODAS as marcas por fonética, gráfica e ideológica. Separa candidatas de descartadas. Documenta em `RADAR.md`.
* **Fase 2 — Confronto de Especificações**: Só candidatas entram. Compara specs item a item. Começa com território máximo e afunila conforme colidências aparecem. Documenta em `CONFRONTO.md`.
* **Fase 3 — Narrativa Jurídica**: Só colidências reais entram. Gera parecer na PARTE 2 do laudo.

**Regra de auditabilidade**: Toda marca que apareceu na busca DEVE ser rastreável nos artefatos. Nenhuma marca pode sumir entre fases.

## 2. Redação de Planos de Análise e Laudos

* **PROIBIÇÃO DE TABELAS DE DESCRIÇÃO DE COLIDÊNCIAS**: Jamais crie seções denominadas "Detalhamento de Colidências", "Lista de Processos Conflitantes" ou similares que contenham tabelas brutas extraídas do INPI (com colunas de Processo, Marca, Situação e Titular) ao final dos documentos.
* **FOCO NA NARRATIVA JURÍDICA**: Toda a análise de colidências deve ser diluída na narrativa técnica e estratégica da PARTE 2. Os dados de processos específicos devem ser citados apenas dentro do texto, explicando o motivo do conflito e a estratégia de superação, sem redundância em tabelas de resumo ao final.
* **CONCISÃO PREMIUM**: Mantenha os documentos focados na estratégia jurídica e no veredito, evitando seções que apenas repetem dados já mencionados ou analisados no corpo do texto.
* **TABELAS PERMITIDAS APENAS NOS ARTEFATOS DE AUDITORIA**: Os arquivos `RADAR.md` e `CONFRONTO.md` PODEM e DEVEM usar tabelas — eles são documentos de trabalho/auditoria, não o laudo final. A proibição de tabelas se aplica apenas ao `PLANO DE ANÁLISE.md` (o laudo).

## 3. Publicação e Versionamento

* **GOOGLE DRIVE ANTES, CLICKUP DEPOIS**: O Google Drive recebe os documentos imediatamente após a geração (permite revisão visual). O ClickUp só é atualizado APÓS o usuário abrir o documento no computador e aprovar explicitamente. Nunca subir no ClickUp automaticamente.
* **CONFIRMAÇÃO LOCAL OBRIGATÓRIA**: Antes de publicar no ClickUp, SEMPRE pedir ao usuário para abrir o PDF/DOCX no computador e confirmar visualmente. Usar a mensagem: "Abra o PDF no seu computador para conferir. Confirma que está tudo certo para publicar no ClickUp?"
* **VERSIONAMENTO NUMÉRICO**: Primeira versão de um documento não leva número. A partir da segunda: `2 - [Nome].pdf`, `3 - [Nome].pdf`, etc. Versões anteriores são movidas para a pasta "antigos" no Google Drive.
* **PASTA "ANTIGOS"**: Criada automaticamente dentro da pasta do cliente no Drive. Contém todas as versões anteriores dos documentos. Nunca deletar versões anteriores — sempre mover para "antigos".


