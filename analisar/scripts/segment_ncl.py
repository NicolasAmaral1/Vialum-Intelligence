import re
import os

# Lista de palavras comuns que iniciam descrições em português na NCL
PT_KEYWORDS = [
    "Preparações", "Substâncias", "Sal ", "Fluidos", "Aceleradores", "Soluções", "Acetatos", 
    "Acetato", "Anidrido", "Acetona", "Acetileno", "Ácidos", "Composições", "Actínio", 
    "Aditivos", "Água", "Goma", "Carvão", "Gases", "Agentes", "Ágar-ágar", "Aglutinantes",
    "Albumina", "Álcalis", "Álcali", "Metais", "Álcool", "Aldeídos", "Algas", "Alumina",
    "Alume", "Hidrato", "Silicato", "Cloreto", "Iodeto", "Alúmen", "Amerício", "Amido",
    "Sal ", "Espírito", "Sais", "Amoníaco", "Anidridos", "Antidetonantes", "Anticongelante",
    "Anti-incrustantes", "Antimônio", "Óxido", "Sulfeto", "Mástique", "Argônio", "Arseniato",
    "Arsênico", "Astatino", "Combustíveis", "Papel", "Nitrogênio", "Bactericidas", "Banhos",
    "Soda", "Bário", "Barita", "Bauxita", "Bentonita", "Derivados", "Sacarina", "Berquélio",
    "Bicloreto", "Bicromato", "Catalisadores", "Dioxalato", "Dióxido", "Bismuto", "Galato",
    "Madeira", "Polpa", "Vinagre", "Bórax", "Lamas", "Cainite", "Cianamida", "Califórnio",
    "Plastificantes", "Preservativos", "Carbonatos", "Carbono", "Dissulfeto", "Carbonetos",
    "Cassiopeio", "Lutécio", "Celulose", "Pasta", "Viscose", "Cimento", "Férmio", "Esmalte",
    "Cério", "Césio", "Cetonas", "Massas", "Lixívia", "Células", "Cultura", "Proteínas",
    "Vitaminas", "Antioxidantes", "Ingredientes", "Bioestimulantes", "Resinas", "Adesivos"
]

def clean_portuguese(text):
    # Heurística: Tentar encontrar onde começa a parte em português.
    # Geralmente a parte em português é a última metade da string ou começa com uma palavra chave.
    
    # Se houver colchetes, o português muitas vezes segue o último colchete de nota inglesa.
    # Ex: "Combusting preparations [chemical additives to motor fuel]Comburentes [aditivos químicos para combustível]"
    
    # Tenta achar o ponto de transição baseado nas palavras-chave brasileiras
    best_pos = -1
    for kw in PT_KEYWORDS:
        # Procura a palavra chave com limite de contexto para evitar falsos positivos no meio da frase inglesa
        # (mas geralmente as descrições são curtas)
        pos = text.rfind(kw)
        if pos != -1:
            # Se achamos, assumimos que do kw em diante é português
            # (Pega a posição mais à direita que seja uma palavra chave conhecida)
            if pos > best_pos:
                best_pos = pos
    
    if best_pos != -1:
        return text[best_pos:].strip()
    
    # Fallback: Se não achou palavra chave, tenta ver se tem um padrão de repetir termos técnicos ou 
    # caracteres especiais do PT
    if any(c in text for c in "çãõéáíóúêô"):
        # Se tem caracteres PT, tenta achar a primeira capital depois de um espaço na segunda metade
        mid = len(text) // 2
        match = re.search(r'[a-z] ([A-Z][a-z])', text[mid:])
        if match:
            return text[mid + match.start() + 2:].strip()

    return text # Fallback total: retorna tudo se não tiver certeza

def process():
    input_path = 'arquivos-raw/Lista_Nice_NCL_13_extraida.txt'
    output_dir = 'know-how/ncl-classes'
    
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    classes = {}
    
    with open(input_path, 'r', encoding='utf-8') as f:
        for line in f:
            match = re.match(r'^(\d{6})\s+(\d{1,2})\s+(.*)$', line.strip())
            if match:
                base_num = match.group(1)
                class_num = int(match.group(2))
                raw_content = match.group(3)
                
                pt_content = clean_portuguese(raw_content)
                
                if class_num not in classes:
                    classes[class_num] = []
                
                classes[class_num].append(f"{base_num} | {pt_content}")

    for cn in range(1, 46):
        if cn in classes:
            with open(os.path.join(output_dir, f'NCL-{cn:02d}.md'), 'w', encoding='utf-8') as f:
                f.write(f'# Classe NCL {cn:02d}\n\n')
                f.write('Especificações pré-especificadas (Português):\n\n')
                for entry in classes[cn]:
                    f.write(f'- {entry}\n')
        else:
            print(f"Aviso: Classe {cn} não encontrada no arquivo.")

if __name__ == "__main__":
    process()
