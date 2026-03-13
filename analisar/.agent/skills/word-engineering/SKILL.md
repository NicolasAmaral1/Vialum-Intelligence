---
name: Engenharia de Relatórios Word (DocxTemplate)
description: Workflow de excelência para geração de documentos Word com alta fidelidade visual, separando Design (Template) de Lógica (Python).
---

# SKILL: Engenharia de Relatórios Word

## Filosofia: "Design First, Code Second"

Para atingir a "excelência" em documentos Word via Python, não devemos tentar construir o documento linha a linha via código. O Word é um motor de renderização complexo. A melhor abordagem é:

1.  **Template Master:** Um arquivo `.docx` que contém **apenas** o Design System (Estilos, Fontes, Cores, Cabeçalhos, Rodapés) e placeholders Jinja2 (`{{ valor }}`).
2.  **Engine Python:** Um script que coleta dados e os injeta no template.

## Especificação Técnica

### 1. Bibliotecas
A stack de excelência é:
*   `docxtpl`: Para orquestração e injeção de dados (Jinja2 no Word).
*   `python-docx`: Para *criação programática* do Template Master (garantindo que os estilos existam corretamente no XML base).

### 2. Design System (Estilos Word)
O Template Master deve ter os seguintes estilos explicitamente definidos no `styles.xml` interno:

| Estilo Word | Fonte | Tamanho | Cor (Hex) | Uso |
| :--- | :--- | :--- | :--- | :--- |
| **Normal** | Sora | 11pt | `#070707` | Corpo do texto |
| **Title** | Sora | 26pt | `#9FEC14` | Capa / Título Principal |
| **Heading 1** | Sora | 16pt | `#9FEC14` | Títulos de Seção |
| **Heading 2** | Sora | 13pt | `#9FEC14` | Subtítulos |
| **Quote** | Sora | 10pt | `#656565` | Citações / Notas |

### 3. Estrutura do Placeholder
Use a sintaxe Jinja2 diretamente no documento Word:
*   Texto simples: `{{ cliente }}`
*   Texto rico (HTML/Markdown convertido): `{{ r_analise_preliminar }}` (Objeto `RichText` ou subdoc)
*   Imagens: `{{ imagem_fluxograma }}` (InlineImage)
*   Condicionais: `{% if risco == 'alto' %} ... {% endif %}`
*   Loops: `{% for item in lista %} ... {% endfor %}`

## Workflow de Implementação

1.  **Gerar Template Base:** Executar script `gerar_master_template.py` para criar o arquivo `.docx` com os estilos corretos (já que não temos GUI do Word).
2.  **Definir Lógica de Dados:** Script que lê o Markdown/JSON e prepara o contexto.
3.  **Renderizar:** Combinar Template + Dados = Relatório Final.

---
## Snippets Úteis

### Inserção de RichText (para manter negrito/itálico do Markdown)
```python
from docxtpl import RichText

rt = RichText()
rt.add('Texto normal ', style='Normal')
rt.add('Texto negrito', style='Normal', bold=True)
rt.add('Texto verde', style='Normal', color='#9FEC14')
context['meu_texto_rico'] = rt
```
