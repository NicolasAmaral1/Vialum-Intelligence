#!/usr/bin/env python3
"""
Gerador de PDF de Laudos de Viabilidade de Marcas

Converte PLANO DE ANÁLISE.md em PDF profissional usando template DOCX.

Uso:
    python gerar_pdf.py cases/Cliente/Marca/Marca\ -\ PLANO\ DE\ ANÁLISE.md
    python gerar_pdf.py --plano plano.md --template custom.docx --output laudo.pdf
"""

import sys
import re
import subprocess
from pathlib import Path
from typing import Dict, Any, Optional
from datetime import datetime

try:
    from docxtpl import DocxTemplate
    import markdown
except ImportError:
    print("❌ Erro: Dependências faltando. Instale com:")
    print("   pip install python-docx-template markdown")
    sys.exit(1)


def parsear_plano_markdown(caminho_md: Path) -> Dict[str, Any]:
    """
    Parseia o PLANO DE ANÁLISE.md e extrai conteúdo estruturado.
    Args:
        caminho_md: Caminho do arquivo markdown
    Returns:
        Dicionário com todas as seções parseadas
    """
    with open(caminho_md, 'r', encoding='utf-8') as f:
        conteudo = f.read()

    dados = {}

    # Extrair metadados do cabeçalho
    dados['cliente'] = extrair_campo(conteudo, r'\*\*Cliente:\*\*\s*(.+)')
    dados['marca_principal'] = extrair_campo(conteudo, r'\*\*Marca Principal:\*\*\s*(.+)')
    dados['marcas_alternativas'] = extrair_campo(conteudo, r'\*\*Marcas Alternativas:\*\*\s*(.+)', default='N/A')
    dados['atividade'] = extrair_campo(conteudo, r'\*\*Atividade:\*\*\s*(.+)')
    dados['data_analise'] = extrair_campo(conteudo, r'\*\*Data:\*\*\s*(.+)', default=datetime.now().strftime('%d/%m/%Y'))

    # Extrair classes (toda a seção até o próximo cabeçalho ou linha horizontal)
    dados['classes_sugeridas'] = extrair_secao(conteudo, r'## LAUDO DESCRITIVO POR CLASSE\n+(.*?)\n+---', flags=re.DOTALL)

    # Extrair parágrafos específicos de requisitos (sem cabeçalhos próprios)
    dados['veracidade'] = extrair_secao(conteudo, r'(Em relação ao requisito da VERACIDADE.*?)(\n\n|\Z)', flags=re.DOTALL)
    dados['licitude'] = extrair_secao(conteudo, r'(Nesta toada, no que se refere ao requisito da LICEIDADE.*?)(\n\n|\Z)', flags=re.DOTALL)
    dados['distintividade'] = extrair_secao(conteudo, r'(Por conseguinte, na análise dos requisitos, no que tange à DISTINTIVIDADE.*?)(\n\n|\Z)', flags=re.DOTALL)

    # Extrair análise de colidências (até a conclusão)
    dados['analises_colidencias'] = extrair_secao(
        conteudo,
        r'## ANÁLISE DE COLIDÊNCIAS E ANTERIORIDADES\n+(.*?)\n+## CONCLUSÃO E ESTRATÉGIA',
        flags=re.DOTALL
    )

    # Extrair conclusão
    dados['conclusao_final'] = extrair_secao(conteudo, r'## CONCLUSÃO E ESTRATÉGIA\n+(.*?)(?:\n+---|\Z)', flags=re.DOTALL)

    return dados


def extrair_campo(texto: str, padrao: str, default: str = '') -> str:
    """Extrai campo usando regex."""
    match = re.search(padrao, texto)
    return match.group(1).strip() if match else default


def extrair_secao(texto: str, padrao: str, flags=0, default: str = '') -> str:
    """Extrai seção completa usando regex."""
    match = re.search(padrao, texto, flags=flags)
    return match.group(1).strip() if match else default


def converter_markdown_para_texto(md_text: str) -> str:
    """
    Converte markdown básico para texto simples preservando formatação.
    
    Nota: Para preservar formatação no Word, usaremos rich text objects.
    Esta função é um placeholder - implementação completa requer python-docx manipulação.
    """
    # Remover emojis para compatibilidade
    texto = re.sub(r'[\U0001F300-\U0001F9FF]', '', md_text)
    
    # Converter negritos
    texto = re.sub(r'\*\*(.+?)\*\*', r'\1', texto)
    
    return texto.strip()


def gerar_docx_intermediario(
    template_path: Path,
    dados: Dict[str, Any],
    output_docx: Path
) -> bool:
    """
    Gera DOCX a partir do template preenchendo placeholders.
    
    Args:
        template_path: Caminho do template .docx
        dados: Dicionário com dados parseados
        output_docx: Caminho para salvar DOCX intermediário
    
    Returns:
        True se gerado com sucesso
    """
    try:
        print(f"📄 Carregando template: {template_path}")
        doc = DocxTemplate(template_path)
        
        # Preparar contexto para Jinja2
        context = {
            'nome_marca': dados.get('marca_principal', 'MARCA'),
            'cliente': dados.get('cliente', ''),
            'marca_principal': dados.get('marca_principal', ''),
            'marcas_alternativas': dados.get('marcas_alternativas', 'N/A'),
            'atividade': dados.get('atividade', ''),
            'data_analise': dados.get('data_analise', datetime.now().strftime('%d/%m/%Y')),
            
            # Seções de conteúdo
            'classes_sugeridas': dados.get('classes_sugeridas', ''),
            'veracidade': dados.get('veracidade', ''),
            'licitude': dados.get('licitude', ''),
            'distintividade': dados.get('distintividade', ''),
            'resumo_executivo': dados.get('resumo_executivo', ''),
            'analises_colidencias': dados.get('analises_colidencias', ''),
            'conclusao_final': dados.get('conclusao_final', ''),
        }
        
        print("✏️  Preenchendo template com dados...")
        doc.render(context)
        
        print(f"💾 Salvando DOCX intermediário: {output_docx}")
        doc.save(output_docx)
        
        return True
        
    except Exception as e:
        print(f"❌ Erro ao gerar DOCX: {e}")
        import traceback
        traceback.print_exc()
        return False


def converter_docx_para_pdf(docx_path: Path, pdf_path: Path) -> bool:
    """
    Converte DOCX para PDF.
    
    No macOS, usa docx2pdf (que usa Word via AppleScript).
    No Linux, usa LibreOffice headless.
    
    Args:
        docx_path: Caminho do DOCX
        pdf_path: Caminho para salvar PDF
    
    Returns:
        True se convertido com sucesso
    """
    try:
        import platform
        sistema = platform.system()
        
        print(f"📑 Convertendo para PDF (Sistema: {sistema})...")
        
        if sistema == 'Darwin':  # macOS
            # Tentar usar docx2pdf
            try:
                from docx2pdf import convert
                convert(str(docx_path), str(pdf_path))
                return True
            except ImportError:
                print("⚠️  docx2pdf não instalado, tentando LibreOffice...")
        
        # Fallback: LibreOffice (funciona em qualquer OS se instalado)
        cmd = [
            'libreoffice',
            '--headless',
            '--convert-to', 'pdf',
            '--outdir', str(pdf_path.parent),
            str(docx_path)
        ]
        
        resultado = subprocess.run(cmd, capture_output=True, text=True)
        
        if resultado.returncode == 0:
            # LibreOffice salva com mesmo nome do DOCX
            pdf_gerado = pdf_path.parent / f"{docx_path.stem}.pdf"
            if pdf_gerado.exists() and pdf_gerado != pdf_path:
                pdf_gerado.rename(pdf_path)
            return True
        else:
            print(f"❌ Erro na conversão: {resultado.stderr}")
            return False
            
    except FileNotFoundError:
        print("❌ Erro: LibreOffice não encontrado. Instale com:")
        print("   macOS: brew install libreoffice")
        print("   Linux: sudo apt-get install libreoffice")
        return False
    except Exception as e:
        print(f"❌ Erro ao converter PDF: {e}")
        return False


def gerar_pdf_laudo(
    plano_md: Path,
    template_docx: Path,
    output_pdf: Path,
    manter_docx: bool = False
) -> bool:
    """
    Pipeline completo de geração de PDF.
    
    Args:
        plano_md: Caminho do PLANO DE ANÁLISE.md
        template_docx: Caminho do template .docx
        output_pdf: Caminho para salvar PDF final
        manter_docx: Se True, não deleta DOCX intermediário
    
    Returns:
        True se gerado com sucesso
    """
    print("="*60)
    print("📊 GERADOR DE PDF - LAUDO DE VIABILIDADE")
    print("="*60)
    
    # Validações
    if not plano_md.exists():
        print(f"❌ Erro: PLANO DE ANÁLISE não encontrado: {plano_md}")
        return False
    
    if not template_docx.exists():
        print(f"❌ Erro: Template não encontrado: {template_docx}")
        print("💡 Dica: Coloque o template em templates/laudo-template.docx")
        return False
    
    # Parsear markdown
    print(f"\n📖 Parseando PLANO DE ANÁLISE...")
    dados = parsear_plano_markdown(plano_md)
    print(f"   ✓ Marca: {dados.get('marca_principal', 'N/A')}")
    print(f"   ✓ Cliente: {dados.get('cliente', 'N/A')}")
    
    # Gerar DOCX intermediário
    docx_intermediario = output_pdf.parent / f"{output_pdf.stem}_temp.docx"
    
    if not gerar_docx_intermediario(template_docx, dados, docx_intermediario):
        return False
    
    # Converter para PDF
    if not converter_docx_para_pdf(docx_intermediario, output_pdf):
        return False
    
    # Limpar arquivo temporário
    if not manter_docx and docx_intermediario.exists():
        docx_intermediario.unlink()
        print("🗑️  DOCX temporário removido")
    
    print(f"\n✅ PDF gerado com sucesso!")
    print(f"📄 Arquivo: {output_pdf}")
    
    return True


def main():
    """Função principal CLI."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Gera PDF de laudo de viabilidade a partir do PLANO DE ANÁLISE",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=r"""
Exemplos de uso:
  # Usar template padrão
  python gerar_pdf.py cases/Cliente/Marca/Marca\ -\ PLANO\ DE\ ANÁLISE.md
  
  # Especificar template customizado
  python gerar_pdf.py --plano plano.md --template meu-template.docx
  
  # Manter DOCX intermediário (para debug)
  python gerar_pdf.py plano.md --keep-docx
        """
    )
    
    parser.add_argument(
        'plano_file',
        nargs='?',
        help='Caminho do PLANO DE ANÁLISE.md'
    )
    parser.add_argument(
        '-p', '--plano',
        dest='plano_path',
        help='Caminho do PLANO DE ANÁLISE.md'
    )
    parser.add_argument(
        '-t', '--template',
        dest='template_path',
        help='Caminho do template .docx (padrão: templates/laudo-template.docx)'
    )
    parser.add_argument(
        '-o', '--output',
        dest='output_path',
        help='Caminho do PDF de saída (padrão: mesma pasta do plano)'
    )
    parser.add_argument(
        '--keep-docx',
        action='store_true',
        help='Manter arquivo DOCX intermediário'
    )
    
    args = parser.parse_args()
    
    # Determinar caminho do plano
    if args.plano_path:
        plano_path = Path(args.plano_path)
    elif args.plano_file:
        plano_path = Path(args.plano_file)
    else:
        parser.print_help()
        print("\n❌ Erro: Especifique o arquivo do PLANO DE ANÁLISE")
        sys.exit(1)
    
    # Determinar caminho do template
    if args.template_path:
        template_path = Path(args.template_path)
    else:
        template_path = Path('templates/laudo-template.docx')
    
    # Determinar caminho de saída
    if args.output_path:
        output_path = Path(args.output_path)
    else:
        # Mesmo diretório do plano
        marca = plano_path.stem.replace(' - PLANO DE ANÁLISE', '')
        output_path = plano_path.parent / f"{marca} - LAUDO DE VIABILIDADE.pdf"
    
    # Gerar PDF
    sucesso = gerar_pdf_laudo(
        plano_path,
        template_path,
        output_path,
        manter_docx=args.keep_docx
    )
    
    sys.exit(0 if sucesso else 1)


if __name__ == "__main__":
    main()
