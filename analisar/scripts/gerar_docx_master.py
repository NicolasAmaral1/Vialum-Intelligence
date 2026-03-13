import sys
import re
from pathlib import Path
from datetime import datetime
from docxtpl import DocxTemplate

def extrair_campo(texto: str, padrao: str, default: str = '') -> str:
    match = re.search(padrao, texto)
    return match.group(1).strip() if match else default

def extrair_secao(texto: str, padrao: str, flags=0, default: str = '') -> str:
    match = re.search(padrao, texto, flags=flags)
    return match.group(1).strip() if match else default

def clean_markdown_and_split(text: str):
    """
    Retorna LISTA de STRINGS limpas para o template iterar.
    Remove marcadores markdown.
    """
    if not text:
        return []
    
    processed_paragraphs = []
    lines = text.split('\n')
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        # Limpar ** e ### e #
        clean_line = re.sub(r'\*\*|###|\#', '', line).strip()
        if clean_line:
            processed_paragraphs.append(clean_line)

    return processed_paragraphs

def parsear_plano(caminho_md):
    with open(caminho_md, 'r', encoding='utf-8') as f:
        conteudo = f.read()

    dados = {}
    dados['cliente'] = extrair_campo(conteudo, r'\*\*Cliente:\*\*\s*(.+)')
    dados['marca_principal'] = extrair_campo(conteudo, r'\*\*Marca Principal:\*\*\s*(.+)')
    dados['data_analise'] = extrair_campo(conteudo, r'\*\*Data:\*\*\s*(.+)', default=datetime.now().strftime('%d/%m/%Y'))

    # Seções
    dados['classes_sugeridas'] = extrair_secao(conteudo, r'## LAUDO DESCRITIVO POR CLASSE\n+(.*?)\n+---', flags=re.DOTALL)
    dados['veracidade'] = extrair_secao(conteudo, r'(Em relação ao requisito da VERACIDADE.*?)(\n\n|\Z)', flags=re.DOTALL)
    dados['licitude'] = extrair_secao(conteudo, r'(Nesta toada, no que se refere ao requisito da LICEIDADE.*?)(\n\n|\Z)', flags=re.DOTALL)
    dados['distintividade'] = extrair_secao(conteudo, r'(Por conseguinte, na análise dos requisitos, no que tange à DISTINTIVIDADE.*?)(\n\n|\Z)', flags=re.DOTALL)
    dados['analises_colidencias'] = extrair_secao(conteudo, r'## ANÁLISE DE COLIDÊNCIAS E ANTERIORIDADES\n+(.*?)\n+## CONCLUSÃO E ESTRATÉGIA', flags=re.DOTALL)
    dados['conclusao_final'] = extrair_secao(conteudo, r'## CONCLUSÃO E ESTRATÉGIA\n+(.*?)(?:\n+---|\Z)', flags=re.DOTALL)

    return dados

def main():
    plano_md = Path("cases/Nicolas Amaral/RED GROW/RED GROW - PLANO DE ANÁLISE.md")
    template_docx = Path("templates/master-template.docx")
    output_docx = Path("cases/Nicolas Amaral/RED GROW/RED GROW - LAUDO FINAL V8.docx")

    print(f"📖 Lendo plano: {plano_md}")
    dados = parsear_plano(plano_md)
    
    print(f"📄 Usando Master Template V8: {template_docx}")
    doc = DocxTemplate(template_docx)
    
    print("✏️ Segmentando texto e renderizando...")
    
    context = {
        'marca_principal': dados.get('marca_principal', ''),
        'cliente': dados.get('cliente', ''),
        'data_analise': dados.get('data_analise', ''),
        'classes_sugeridas': clean_markdown_and_split(dados.get('classes_sugeridas', '')),
        'veracidade': clean_markdown_and_split(dados.get('veracidade', '')),
        'licitude': clean_markdown_and_split(dados.get('licitude', '')),
        'distintividade': clean_markdown_and_split(dados.get('distintividade', '')),
        'analises_colidencias': clean_markdown_and_split(dados.get('analises_colidencias', '')),
        'conclusao_final': clean_markdown_and_split(dados.get('conclusao_final', '')),
    }
    
    doc.render(context)
    doc.save(output_docx)
    print(f"✅ Arquivo salvo com sucesso: {output_docx}")

if __name__ == "__main__":
    main()
