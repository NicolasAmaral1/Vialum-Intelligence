---
name: Engenharia de Relatórios PDF (ReportLab)
description: Workflow definitivo para geração de laudos profissionais em PDF com controle visual absoluto (pixel-perfect), substituindo a engine de Word.
---

# SKILL: ReportLab Engineering

## Filosofia: "Code is Layout"

Diferente do Word, onde tentamos "empurrar" conteúdo para um template instável, no ReportLab nós **desenhamos** o documento. Isso garante:
1.  **Imutabilidade:** O layout não quebra em computadores diferentes.
2.  **Precisão:** Margens, recuos e cores são definidos matematicamente.
3.  **Performance:** Geração instantânea sem depender de LibreOffice/Word instalado.

## Especificação Técnica (Vialum Design System)

### 1. Layout Base (A4)
*   **Margens:** 2.5cm (Superior, Inferior, Esquerda, Direita).
*   **Grid:** Coluna única.

### 2. Tipografia
*   **Fonte Principal:** Sora (com fallback para Helvetica/Arial).
*   **Tamanhos:**
    *   Título Principal: 26pt (Bold).
    *   Títulos Seção (H1): 16pt (Bold, Caixa Alta, Verde Neon).
    *   Subtítulos (H2): 14pt (Bold, Caixa Alta, Verde Neon).
    *   Corpo: 12pt (Regular, Cor #595959).
    *   Rodapé: 9pt (Cinza Claro).

### 3. Elementos Visuais
*   **Logo:** Inserida no cabeçalho (Flowable ou Drawing).
*   **Divisores:** Linha verde neon (#9FEC14) separando parágrafos.
*   **Espaçamento:** 1.5 entre linhas (Leading).

## Estrutura do Código (Python)

Uso da biblioteca `reportlab.platypus`:
*   `SimpleDocTemplate`: Gerenciador de páginas e margens.
*   `Paragraph`: Bloco de texto com estilo.
*   `Spacer`: Espaçamento vertical.
*   `PageTemplate/Frame`: Para Cabeçalhos e Rodapés fixos.

### Snippet: Estilo Condicional
```python
if 'Sora' in registered_fonts:
    font_body = 'Sora-Regular'
else:
    font_body = 'Helvetica'
```
