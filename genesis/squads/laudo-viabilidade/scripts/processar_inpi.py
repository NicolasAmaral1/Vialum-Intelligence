#!/usr/bin/env python3
"""
Processador de dados do INPI - Wrapper para analisador_inpi.py

Este script:
1. Lê arquivo .txt com dados brutos copiados do INPI
2. Pode processar múltiplas marcas no mesmo arquivo (separadas por delimitadores)
3. Executa o analisador para cada marca
4. Salva JSON estruturado

Uso:
    python processar_inpi.py cases/Cliente/Marca/inpi-raw.txt
    python processar_inpi.py --input inpi-raw.txt --output inpi-processed.json
"""

import sys
import json
import re
from pathlib import Path
from typing import List, Dict, Any
import warnings

# Importar o analisador existente
try:
    from analisador_inpi import analisar_dados_inpi
except ImportError:
    print("❌ Erro: analisador_inpi.py não encontrado. Certifique-se de estar na raiz do projeto.")
    sys.exit(1)


def dividir_marcas(texto_bruto: str) -> List[str]:
    """
    Divide o texto bruto em blocos individuais de marcas.
    
    O INPI geralmente separa marcas por uma linha como:
    "Nº do Processo: XXXXXXXXX"
    
    Args:
        texto_bruto: Texto completo com várias marcas
    
    Returns:
        Lista de strings, cada uma contendo dados de uma marca
    """
    # Procurar padrão de início de processo
    # Ex: "Nº do Processo: 123456789" ou similar
    blocos = re.split(r'(?=Nº do Processo:\s*\d+)', texto_bruto)
    
    # Remover blocos vazios ou muito pequenos
    blocos_validos = [b.strip() for b in blocos if len(b.strip()) > 100]
    
    if not blocos_validos:
        # Se não encontrou divisões, trata como um único bloco
        return [texto_bruto]
    
    return blocos_validos


def processar_arquivo(caminho_input: Path, caminho_output: Path) -> bool:
    """
    Processa arquivo de entrada e gera JSON estruturado.
    
    Args:
        caminho_input: Caminho do .txt bruto
        caminho_output: Caminho para salvar .json
    
    Returns:
        True se processado com sucesso
    """
    try:
        # Ler arquivo de entrada
        print(f"📖 Lendo arquivo: {caminho_input}")
        with open(caminho_input, 'r', encoding='utf-8') as f:
            texto_bruto = f.read()
        
        if not texto_bruto.strip():
            print("❌ Erro: Arquivo de entrada está vazio")
            return False
        
        # Dividir em blocos de marcas individuais
        print("🔍 Dividindo em blocos de marcas...")
        blocos = dividir_marcas(texto_bruto)
        print(f"✅ Encontrados {len(blocos)} bloco(s) de marca(s)")
        
        # Processar cada bloco
        resultados = []
        marcas_processadas = []
        
        for i, bloco in enumerate(blocos, 1):
            print(f"\n📊 Processando marca {i}/{len(blocos)}...")
            
            with warnings.catch_warnings(record=True) as w:
                warnings.simplefilter("always")
                dados = analisar_dados_inpi(bloco)
                
                # Mostrar warnings se houver
                if w:
                    print(f"⚠️  {len(w)} aviso(s) durante o processamento:")
                    for warning in w[:3]:  # Mostrar no máximo 3
                        print(f"   - {warning.message}")
            
            # Verificar se extraiu nome da marca
            nome_marca = dados.get('nome_marca', f'Marca_{i}')
            numero_processo = dados.get('numero_processo', 'N/A')
            
            print(f"   ✓ Marca: {nome_marca}")
            print(f"   ✓ Processo: {numero_processo}")
            print(f"   ✓ Classes: {len(dados.get('classes', []))}")
            print(f"   ✓ Titulares: {len(dados.get('titulares', []))}")
            
            resultados.append(dados)
            marcas_processadas.append(nome_marca)
        
        # Salvar JSON
        print(f"\n💾 Salvando JSON em: {caminho_output}")
        with open(caminho_output, 'w', encoding='utf-8') as f:
            json.dump(resultados, f, ensure_ascii=False, indent=2)
        
        # Estatísticas finais
        print(f"\n✅ Processamento concluído com sucesso!")
        print(f"📦 Total de marcas: {len(resultados)}")
        print(f"📋 Marcas processadas:")
        for i, nome in enumerate(marcas_processadas, 1):
            print(f"   {i}. {nome}")
        
        return True
        
    except FileNotFoundError:
        print(f"❌ Erro: Arquivo não encontrado: {caminho_input}")
        return False
    except json.JSONDecodeError as e:
        print(f"❌ Erro ao gerar JSON: {e}")
        return False
    except Exception as e:
        print(f"❌ Erro inesperado: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Função principal CLI."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Processa dados brutos do INPI e gera JSON estruturado",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemplos de uso:
  # Processar arquivo (output automático)
  python processar_inpi.py cases/Cliente/Marca/inpi-raw.txt
  
  # Especificar arquivo de saída
  python processar_inpi.py -i inpi-raw.txt -o resultado.json
  
  # Com caminhos completos
  python processar_inpi.py --input /caminho/completo/inpi-raw.txt --output /caminho/saida.json
        """
    )
    
    parser.add_argument(
        'input_file',
        nargs='?',
        help='Caminho do arquivo .txt de entrada (se não usar -i/--input)'
    )
    parser.add_argument(
        '-i', '--input',
        dest='input_path',
        help='Caminho do arquivo .txt de entrada'
    )
    parser.add_argument(
        '-o', '--output',
        dest='output_path',
        help='Caminho do arquivo .json de saída (padrão: mesma pasta que input, com extensão .json)'
    )
    
    args = parser.parse_args()
    
    # Determinar caminho de entrada
    if args.input_path:
        input_path = Path(args.input_path)
    elif args.input_file:
        input_path = Path(args.input_file)
    else:
        parser.print_help()
        print("\n❌ Erro: Especifique o arquivo de entrada")
        sys.exit(1)
    
    # Determinar caminho de saída
    if args.output_path:
        output_path = Path(args.output_path)
    else:
        # Mesma pasta e nome do input, mas com .json
        output_path = input_path.parent / f"{input_path.stem}-processed.json"
    
    # Verificar se arquivo de entrada existe
    if not input_path.exists():
        print(f"❌ Erro: Arquivo não encontrado: {input_path}")
        sys.exit(1)
    
    # Criar diretório de saída se não existir
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Processar
    print("="*60)
    print("🚀 PROCESSADOR DE DADOS INPI")
    print("="*60)
    
    sucesso = processar_arquivo(input_path, output_path)
    
    if sucesso:
        print(f"\n✅ Arquivo gerado: {output_path}")
        print("\n📌 Próximo passo: Execute a SKILL de Análise INPI para processar esses dados")
        sys.exit(0)
    else:
        print("\n❌ Processamento falhou")
        sys.exit(1)


if __name__ == "__main__":
    main()
