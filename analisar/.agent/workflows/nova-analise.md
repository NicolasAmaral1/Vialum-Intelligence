---
description: Iniciar nova análise de viabilidade de marca
---

# Workflow: Nova Análise de Viabilidade de Marca

Este workflow orquestra as SKILLs para gerar um laudo completo de viabilidade de registro marcário.

## Arquitetura do Funil

```
BUSCA INPI (todas as marcas)
        │
        ▼
┌─────────────────────┐
│  FASE 1: RADAR      │  ← Triagem fonética/gráfica/ideológica
│  (todas as marcas)  │     Output: candidatas, limítrofes, descartadas
└─────────┬───────────┘
          │ só candidatas + limítrofes
          ▼
┌─────────────────────────┐
│  FASE 2: CONFRONTO      │  ← Specs do cliente vs specs das candidatas
│  (candidatas apenas)    │     Output: território seguro vs zona de risco
└─────────┬───────────────┘
          │ só marcas com sobreposição real
          ▼
┌─────────────────────────┐
│  FASE 3: NARRATIVA      │  ← Parecer jurídico das colidências reais
│  (colidências reais)    │     Output: PARTE 2 do laudo
└─────────────────────────┘
```

## Pré-requisitos

- [ ] Dependências instaladas: `pip install -r requirements.txt`
- [ ] Template DOCX em `templates/laudo-template.docx`
- [ ] Assets em `assets/` (logo, rodapé, imagens)

---

## Etapa 1: Coleta de Informações

**Ação:** Solicitar ao usuário os dados iniciais

**Input necessário:**
- Nome da marca principal
- Marcas alternativas (opcional)
- Descrição detalhada da atividade/produtos/serviços
- Nome do cliente

**Formato esperado:**
```
Marca: NOME DA MARCA
Alternativos: VARIAÇÃO 1, VARIAÇÃO 2
Atividade: Descrição detalhada dos produtos e serviços oferecidos
Cliente: Nome do Cliente (Se não informado, usar 'Equipe [Marca]')
```

---

## Etapa 2: Criar Estrutura de Pastas

**Ação:** Criar diretórios para o caso

```bash
# Se Cliente não informado: Cliente = "Equipe [Marca]"
mkdir -p "cases/[Nome-Cliente]/[Marca]"
```

**Resultado:** Pasta pronta para receber arquivos do caso

---

## Etapa 3: Executar SKILL — Análise Preliminar

**Ação:** Ler `.agent/skills/analise-preliminar/SKILL.md` e executar

**O que a SKILL faz:**
1. Analisa a marca quanto a distintividade, veracidade e licitude
2. Sugere classes NCL pertinentes
3. Gera especificações detalhadas para cada classe
4. Cria primeira parte do `[Marca] - PLANO DE ANÁLISE.md`

**Output:**
- Arquivo `cases/[Cliente]/[Marca]/[Marca] - PLANO DE ANÁLISE.md` com Parte 1 completa

---

## Etapa 4: CHECKPOINT 1 — Revisão de Classes

**Ação:** Solicitar revisão do usuário

**Mensagem ao usuário:**
```markdown
Análise preliminar concluída!

Revise o arquivo:
[Link para PLANO DE ANÁLISE.md]

Especialmente:
- Classes sugeridas estão adequadas?
- Especificações capturam corretamente a atividade?
- Concordância com análise de distintividade?

Após revisar, informe quais classes você deseja buscar no INPI.
```

**Aguardar:** Aprovação do usuário

---

## Etapa 5: Busca Manual no INPI

**Ação:** Instruir usuário a realizar buscas

**Instruções:**
1. Acesse: https://busca.inpi.gov.br/pePI/servlet/MarcasServlet
2. Para cada classe aprovada:
   - Busque pela marca principal
   - Busque por variações/similares se necessário
3. Copie TODOS os resultados (CTRL+A, CTRL+C)
4. Cole em `cases/[Cliente]/[Marca]/inpi-raw.txt`

**Aguardar:** Usuário confirmar que colou os dados

---

## Etapa 6: Processar Dados do INPI

**Ação:** Executar script de processamento

// turbo
```bash
python scripts/processar_inpi.py "cases/[Cliente]/[Marca]/inpi-raw.txt"
```

**Resultado:**
- Arquivo `cases/[Cliente]/[Marca]/inpi-raw-processed.json` criado
- JSON estruturado com todas as marcas encontradas

---

## Etapa 7: FASE 1 — Radar de Similaridade

**Ação:** Ler `.agent/skills/radar-similaridade/SKILL.md` e executar

**O que a SKILL faz:**
1. Varre TODAS as marcas do JSON
2. Avalia similaridade fonética, gráfica e ideológica com a marca do cliente
3. Classifica cada marca como CANDIDATA, LIMÍTROFE ou DESCARTADA
4. Gera relatório completo de triagem

**Output:**
- `cases/[Cliente]/[Marca]/[Marca] - RADAR.md`

**Auditabilidade:** TODAS as marcas aparecem no relatório — nenhuma some.

---

## Etapa 8: CHECKPOINT 2 — Validação do Radar

**Ação:** Apresentar resumo ao usuário

**Mensagem ao usuário:**
```markdown
Radar de similaridade concluído!

Resultado:
- Total de marcas analisadas: [N]
- Candidatas a colidência: [N]
- Limítrofes (incluídas por precaução): [N]
- Descartadas: [N]

Revise o arquivo [RADAR.md] — especialmente:
- Alguma marca descartada deveria ser candidata?
- Alguma candidata deveria ser descartada?

Após validar, prosseguiremos para o confronto de especificações.
```

**Aguardar:** Aprovação do usuário

---

## Etapa 9: FASE 2 — Confronto de Especificações

**Ação:** Ler `.agent/skills/confronto-especificacoes/SKILL.md` e executar

**O que a SKILL faz:**
1. Monta o Território Máximo do cliente (todas as specs NCL aplicáveis)
2. Extrai especificações completas de cada candidata
3. Confronta item a item — identifica sobreposições
4. Afunila progressivamente: cada colidência reduz o território
5. Gera mapa de confronto com território seguro vs zona de risco

**Output:**
- `cases/[Cliente]/[Marca]/[Marca] - CONFRONTO.md`

**Auditabilidade:** Toda spec tem status final (seguro, risco, bloqueado). Todo caminho de decisão é rastreável.

---

## Etapa 10: CHECKPOINT 3 — Validação do Confronto

**Ação:** Apresentar resumo ao usuário

**Mensagem ao usuário:**
```markdown
Confronto de especificações concluído!

Resultado:
- Território máximo: [N] especificações
- Território seguro: [N] especificações (sem sobreposição)
- Zona de risco: [N] especificações (sobreposição com defesa viável)
- Bloqueadas: [N] especificações (sobreposição sem defesa)
- Candidatas com risco real: [N] (entrarão na narrativa jurídica)
- Candidatas neutralizadas: [N] (specs não se sobrepõem)

Revise o arquivo [CONFRONTO.md] — especialmente:
- O território recomendado faz sentido para o negócio?
- As avaliações de coexistência estão corretas?

Após validar, geraremos o parecer jurídico final.
```

**Aguardar:** Aprovação do usuário

---

## Etapa 11: FASE 3 — Narrativa Jurídica

**Ação:** Ler `.agent/skills/analise-inpi/SKILL.md` e executar

**O que a SKILL faz:**
1. Redige parecer jurídico APENAS sobre as colidências reais (filtradas pelas Fases 1 e 2)
2. Incorpora dados do Radar (densidade) e do Confronto (specs sobrepostas) na argumentação
3. Menciona o funil completo (N total → X candidatas → Y colidências reais) para auditabilidade
4. Gera PARTE 2 do PLANO DE ANÁLISE

**Output:**
- PARTE 2 inserida no `[Marca] - PLANO DE ANÁLISE.md`

---

## Etapa 12: CHECKPOINT 4 — Revisão da Análise Completa

**Ação:** Solicitar revisão final do usuário

**Mensagem ao usuário:**
```markdown
Análise de colidências concluída!

Revise o PLANO DE ANÁLISE completo:
[Link para PLANO DE ANÁLISE.md]

Documentos auxiliares para auditoria:
- [RADAR.md] — triagem de todas as marcas
- [CONFRONTO.md] — mapa de sobreposição de especificações

Verifique:
- Vereditos estão adequados?
- Especificações recomendadas cobrem o negócio?
- Estratégias propostas fazem sentido?

Se aprovado, podemos gerar o PDF final.
```

**Aguardar:** Aprovação do usuário

---

## Etapa 13: Gerar Radar Visual (PDF)

**Ação:** Gerar PDF visual do funil de análise

**Comandos:**
// turbo
```bash
# Radar visual (só com dados do Radar)
python scripts/gerar_radar_pdf.py "cases/[Cliente]/[Marca]/[Marca] - RADAR.json"

# Radar visual completo (com dados do Confronto, se CONFRONTO.json existir)
python scripts/gerar_radar_pdf.py "cases/[Cliente]/[Marca]/[Marca] - RADAR.json" --confronto "cases/[Cliente]/[Marca]/[Marca] - CONFRONTO.json"
```

**Resultado:**
- `cases/[Cliente]/[Marca]/[Marca] - RADAR VISUAL.pdf`
- Contém: funil, scores, barras visuais, panorama completo, mapa de território

---

## Etapa 14: Gerar Laudos Finais (DOCX e PDF)

**Ação:** Executar os scripts de geração premium

**Comandos:**
// turbo
```bash
# Gerar Word (Builder V4) — upload automático para Google Drive
python scripts/gerar_docx_builder.py

# Gerar PDF (ReportLab V4) — upload automático para Google Drive
python scripts/gerar_laudo_reportlab.py
```

**Resultado:**
- Word em `cases/[Cliente]/[Marca]/[Marca] - LAUDO DE VIABILIDADE.docx`
- PDF em `cases/[Cliente]/[Marca]/[Marca] - LAUDO DE VIABILIDADE.pdf`
- Upload automático para Google Drive (com versionamento)
- Versões anteriores movidas para pasta "antigos" no Drive

**Versionamento no Google Drive:**
- 1ª versão: `[Marca] - LAUDO DE VIABILIDADE.pdf`
- 2ª versão: `2 - [Marca] - LAUDO DE VIABILIDADE.pdf` (1ª vai para "antigos")
- 3ª versão: `3 - [Marca] - LAUDO DE VIABILIDADE.pdf` (2ª vai para "antigos")

---

## Etapa 15: CHECKPOINT FINAL — Confirmação Visual

**⚠️ OBRIGATÓRIO: O usuário deve abrir o documento no computador antes de publicar no ClickUp.**

**Mensagem ao usuário:**
```markdown
Documentos gerados e enviados para o Google Drive!

Abra o PDF/DOCX no seu computador para conferir:
  cases/[Cliente]/[Marca]/[Marca] - LAUDO DE VIABILIDADE.pdf

Versão no Google Drive:
  Possiveis Clientes/[Marca] - [Cliente]/

Confirma que está tudo certo para publicar no ClickUp?
(sim/não — se não, diga o que precisa ajustar)
```

**Aguardar:** Aprovação EXPLÍCITA.

**Se o usuário pedir ajustes:** volta para a etapa relevante, regera, e a versão anterior vai automaticamente para "antigos" no Drive.

---

## Etapa 16: Publicar no ClickUp (SÓ APÓS APROVAÇÃO)

**Ação:** Comentar no card e mover para "feito"

**Pré-requisito:** Usuário aprovou explicitamente na Etapa 15.

**Comandos:** Conforme definido em `squads/laudo-viabilidade/tasks/laudo-gerar.md`

---

## Etapa 17: Entrega

**Ação:** Notificar usuário sobre conclusão

**Mensagem ao usuário:**
```markdown
Laudo de viabilidade concluído com sucesso!

Arquivo final:
[Link para LAUDO DE VIABILIDADE.pdf]

Todos os arquivos do caso (trilha de auditoria completa):
- `[Marca] - PLANO DE ANÁLISE.md` — Laudo completo (Parte 1 + 2)
- `[Marca] - RADAR.md` — Triagem de TODAS as marcas (Fase 1)
- `[Marca] - RADAR.json` — Dados estruturados do radar (fonte para PDF visual)
- `[Marca] - RADAR VISUAL.pdf` — Funil visual com scores e barras
- `[Marca] - CONFRONTO.md` — Mapa de especificações (Fase 2)
- `inpi-raw.txt` — Dados brutos do INPI
- `inpi-raw-processed.json` — Dados estruturados

Google Drive: versão {N} na pasta principal, anteriores em "antigos"
ClickUp: card movido para "feito"

O laudo está pronto para apresentação ao cliente!
```

---

## Trilha de Auditoria

Cada caso gera os seguintes artefatos, em ordem cronológica:

| Arquivo | Fase | O que comprova |
|---------|------|----------------|
| `inpi-raw.txt` | Busca | Dados brutos copiados do INPI |
| `inpi-raw-processed.json` | Processamento | Extração estruturada dos dados |
| `[Marca] - PLANO DE ANÁLISE.md` (Parte 1) | Análise Preliminar | Distintividade, licitude, veracidade, classes |
| `[Marca] - RADAR.md` | Fase 1 | TODAS as marcas avaliadas + veredito de cada |
| `[Marca] - RADAR.json` | Fase 1 | Dados estruturados com scores (fonte do PDF) |
| `[Marca] - RADAR VISUAL.pdf` | Fase 1 | Funil visual, tabela de scores, barras |
| `[Marca] - CONFRONTO.md` | Fase 2 | Specs confrontadas item a item |
| `[Marca] - PLANO DE ANÁLISE.md` (Parte 2) | Fase 3 | Parecer jurídico das colidências reais |
| `[Marca] - LAUDO FINAL.*` | Entrega | Documento final formatado |

---

## Atalhos para Casos Comuns

### Reprocessar dados do INPI (se adicionar mais resultados)

```bash
python scripts/processar_inpi.py "cases/[Cliente]/[Marca]/inpi-raw.txt"
# Depois execute novamente as Fases 1, 2 e 3
```

### Regerar PDF (após edições manuais no PLANO)

```bash
python scripts/gerar_laudo_reportlab.py "cases/[Cliente]/[Marca]/[Marca] - PLANO DE ANÁLISE.md"
```

### Analisar múltiplas marcas do mesmo cliente

Crie pastas separadas:
```bash
mkdir -p "cases/[Cliente]/Marca1"
mkdir -p "cases/[Cliente]/Marca2"
```

Execute o workflow para cada marca independentemente.

---

## Troubleshooting

### Erro: Template não encontrado

```bash
# Verificar se template existe
ls -la templates/laudo-template.docx
```

Solução: Coloque o arquivo `.docx` na pasta `templates/`

### Erro: Dependências faltando

```bash
pip install -r requirements.txt
```

### Erro: JSON vazio ou incompleto

- Verifique se o arquivo `inpi-raw.txt` contém dados válidos
- Consulte warnings do script `scripts/processar_inpi.py`
- Pode ser necessário ajustar padrões de regex no `analisador_inpi.py`

### PDF não abre / está corrompido

- No macOS: Instale `docx2pdf` (`pip install docx2pdf`)
- No Linux: Instale LibreOffice (`sudo apt-get install libreoffice`)
