import re
import os

def refine_pt(text):
    # Padrão: 410001 | EnglishPortuguese ou English Portuguese
    # Procuramos o ponto onde começa o Português.
    # Heurística: Transição de letra minúscula para capital sem espaço, ou capital após colchete, ou capital que inicia palavra PT comum.
    
    # 1. Caso clássico: bracket English]Portuguese
    match = re.search(r'\]\s*([A-ZÀ-Ú].*)$', text)
    if match:
        return match.group(1).strip()
    
    # 2. Caso: English Portuguese (onde o PT começa com Capital)
    # Procuramos a última sequência que parece ser o início de uma frase em PT.
    # Mas precisamos ignorar o início da string que pode ser o Inglês.
    
    # Se houver apenas uma capital no início (depois do |), e outra no meio.
    # Ex: "Dubbing Dublagem" -> "Dublagem"
    parts = re.split(r'(\s[A-ZÀ-Ú][a-zà-ú]+)', text)
    if len(parts) > 1:
        # O último pedaço que começa com capital costuma ser o PT se houver Inglês antes
        # Mas cuidado com nomes compostos em Inglês.
        # Na NCL, o PT costuma ser a última parte "independente".
        
        # Vamos usar uma lista de iniciadores comuns de PT para confirmar
        PT_STARTERS = ["Preparações", "Substâncias", "Serviços", "Aparelhos", "Produtos", "Sais", "Ácidos", "Educação", "Ensino", "Organização", "Publicação", "Aluguel", "Cursos", "Treinamento"]
        for starter in PT_STARTERS:
            if starter in text:
                pos = text.rfind(starter)
                if pos > 5: # Ignora se for logo no começo
                    return text[pos:].strip()
        
        # Se não achou starter, pega a última palavra com capital que não seja a primeira
        # (Heurística simplificada pois a NCL é bem estruturada)
        matches = list(re.finditer(r'[a-z\]]\s*([A-ZÀ-Ú][a-zà-ú]+)', text))
        if matches:
            last_match = matches[-1]
            return text[last_match.start(1):].strip()

    return text

def process():
    dir_path = 'know-how/ncl-classes'
    for filename in os.listdir(dir_path):
        if filename.endswith('.md'):
            path = os.path.join(dir_path, filename)
            with open(path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            
            new_lines = []
            for line in lines:
                if line.startswith('- '):
                    # Formato: - 410001 | Content
                    match = re.match(r'^- (\d{6}) \| (.*)$', line.strip())
                    if match:
                        code = match.group(1)
                        content = match.group(2)
                        refined = refine_pt(content)
                        new_lines.append(f"- {code} | {refined}\n")
                    else:
                        new_lines.append(line)
                else:
                    new_lines.append(line)
            
            with open(path, 'w', encoding='utf-8') as f:
                f.writelines(new_lines)

if __name__ == "__main__":
    process()
