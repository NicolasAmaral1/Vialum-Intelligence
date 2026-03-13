---
name: Geração de PDF e Word do Laudo
description: Converte PLANO DE ANÁLISE aprovado em documentos profissionais (PDF e DOCX) usando os geradores premium (ReportLab/Builder)
---

# SKILL: Geração de Documentos Premium (PDF e DOCX)

## Propósito

Converter o **PLANO DE ANÁLISE** aprovado em documentos finais de alta qualidade visual para o cliente, utilizando os geradores customizados da Vialum.

## Pré-requisitos

1. ✅ **Análise Completa** (Partes 1 e 2) concluída e revisada no arquivo `.md`.
2. ✅ **Assets visuais** disponíveis em `assets/imagens-fixas/` (logo-genesis.png, fluxograma-inpi.png).
3. ✅ **Fontes** instaladas em `assets/fonts/` (Sora).

## Tecnologia

- **ReportLab (PDF)**: Geração nativa e pixel-perfect de PDFs com controle total de layout, fontes e elementos gráficos.
- **Python-Docx Builder (Word)**: Geração de arquivos .docx preservando estilos, fontes customizadas e metadados.

## Input Esperado

- **Caminho do PLANO**: `cases/[Cliente]/[Marca]/[Marca] - PLANO DE ANÁLISE.md`
- **Nome da Marca**: Extraído automaticamente do arquivo `.md`.
- **Cliente**: Extraído automaticamente do arquivo `.md`.

## Output Gerado

- **PDF Premium**: `cases/[Cliente]/[Marca]/[Marca] - LAUDO FINAL REPORTLAB.pdf`
- **Word Premium**: `cases/[Cliente]/[Marca]/[Marca] - LAUDO FINAL BUILDER.docx`

---

## Processamento e Execução

Para gerar os laudos, você deve utilizar os scripts Python especializados que já possuem toda a lógica de branding embutida:

### 1. Geração de Word (DOCX Builder)
O script `gerar_docx_builder.py` realiza o parse do Markdown e reconstrói o documento no Word aplicando estilos de cabeçalho, rodapé e formatação inline (negrito+sublinhado para requisitos).

### 2. Geração de PDF (ReportLab)
O script `gerar_laudo_reportlab.py` gera o PDF do zero, injetando a logo da Genesis no primeiro cabeçalho e mantendo a consistência visual com a "linha verde grossa" (3.0pt).

---

## Comandos de Execução

Sempre execute ambos para oferecer total flexibilidade ao cliente:

```bash
# Antes de rodar, verifique se os scripts apontam para o arquivo .md correto no main()
python scripts/gerar_docx_builder.py
python scripts/gerar_laudo_reportlab.py
```

---

## Validação de Qualidade Final

Após a geração, o agente deve garantir que:
- ✅ **Capa**: Contém o nome da marca em destaque e não duplicou a logo.
- ✅ **Branding**: A linha verde separadora possui 3.0pt de espessura.
- ✅ **Integridade**: O Plano de Análise Narrativo (V5) foi inteiramente transposto para o documento final.
- ✅ **Layout**: Títulos não ficaram órfãos no final das páginas (lógica KeepWithNext).
