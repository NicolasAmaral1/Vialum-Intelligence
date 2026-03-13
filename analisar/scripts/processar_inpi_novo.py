import re
import json
import os

# Caminhos
BASE_DIR = "cases/Nicolas Amaral/Intuity Web"
INPUT_FILE = os.path.join(BASE_DIR, "inpi-raw.txt")
OUTPUT_FILE = os.path.join(BASE_DIR, "inpi-raw-processed.json")

def parse_inpi_text(text):
    processes = []
    # Regex para capturar blocos de processos
    # O padrão do INPI geralmente começa com "Nº do Processo:"
    # Vamos dividir o texto pelos marcadores de início de processo
    
    # Normalizar quebras de linha
    text = text.replace('\r\n', '\n')
    
    # Split por "Nº do Processo:"
    chunks = re.split(r'Nº do Processo:\s*', text)
    
    for chunk in chunks[1:]: # O primeiro chunk é lixo antes do primeiro processo
        try:
            process = {}
            
            # Número do Processo (está no início do chunk)
            lines = chunk.strip().split('\n')
            process['numero_processo'] = lines[0].strip()
            
            # Marca
            marca_match = re.search(r'Marca:\s*(.+)', chunk)
            if marca_match:
                process['marca'] = marca_match.group(1).strip()
            
            # Situação
            situacao_match = re.search(r'Situação:\s*(.+)', chunk)
            if situacao_match:
                process['situacao'] = situacao_match.group(1).strip()
                
            # Titular
            # Pode haver múltiplos titulares ou formatos diferentes, vamos tentar pegar o primeiro
            titular_match = re.search(r'Titular\(1\):\s*(.+)', chunk)
            if titular_match:
                process['titulares'] = [titular_match.group(1).strip()]
            else:
                 process['titulares'] = ["Não identificado"]

            # Classe e Especificação
            # A classe pode ser NCL(X) ou Nacional
            classe_match = re.search(r'(NCL\(\d+\)|Classe Nacional)\s*(\d+)', chunk)
            if classe_match:
                process['classe'] = classe_match.group(2).strip()
            
            # Especificação (geralmente vem depois de "Especificação")
            # Vamos tentar pegar o bloco de texto após a palavra "Especificação" e antes de "Titulares" ou "Classificação Internacional"
            spec_match = re.search(r'Especificação\s*\n(.*?)\n\n', chunk, re.DOTALL)
            if not spec_match:
                 # Tentativa alternativa: pegar até a próxima seção grande
                 spec_match = re.search(r'Especificação\s*\n(.*?)(?:Titulares|Classificação Internacional|Representante Legal)', chunk, re.DOTALL)
            
            if spec_match:
                specs = spec_match.group(1).strip()
                # Limpar quebras de linha excessivas e espaços
                specs = re.sub(r'\s+', ' ', specs)
                process['especificacao'] = specs
            else:
                process['especificacao'] = "Não identificada"
            
            # Data de Depósito
            data_match = re.search(r'Data de Depósito\s*Data de Concessão\s*Data de Vigência\s*\n(\d{2}/\d{2}/\d{4})', chunk)
            if not data_match:
                 data_match = re.search(r'Data de Depósito\s*Data de Concessão\s*Data de Vigência\s*(\d{2}/\d{2}/\d{4})', chunk)

            # Tentar pegar apenas a primeira data que aparecer solta, se o formato acima falhar
            # O layout do INPI varia muito.
            if data_match:
                 process['data_deposito'] = data_match.group(1)
            else:
                 # Fallback: procurar padrão de data perto de "Data de Depósito"
                 data_fallback = re.search(r'Data de Depósito.*?(\d{2}/\d{2}/\d{4})', chunk, re.DOTALL)
                 if data_fallback:
                     process['data_deposito'] = data_fallback.group(1)
                 else:
                     process['data_deposito'] = ""

            processes.append(process)
            
        except Exception as e:
            print(f"Erro ao processar chunk: {e}")
            continue
            
    return processes

def main():
    if not os.path.exists(INPUT_FILE):
        print(f"Arquivo não encontrado: {INPUT_FILE}")
        return

    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        content = f.read()

    data = parse_inpi_text(content)
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)
    
    print(f"Processamento concluído. {len(data)} processos encontrados.")
    print(f"Salvo em: {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
