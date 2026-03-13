"""
Analisador de dados do INPI (Instituto Nacional da Propriedade Industrial).

Este módulo extrai informações estruturadas de texto bruto copiado do 
banco de dados do INPI. O parser é 100% tolerante a falhas - nunca levanta
exceções, apenas emite warnings quando há problemas na análise.
"""

import re
import warnings
from typing import Optional, Dict, List, Any


def extrair_campo_seguro(texto: str, padrao: str, valor_padrao: Optional[str] = None) -> Optional[str]:
    """
    Extrai um campo usando regex com fallback automático.
    
    Args:
        texto: Texto fonte para busca
        padrao: Padrão regex com grupo de captura
        valor_padrao: Valor retornado se não encontrar match
    
    Returns:
        Valor extraído ou valor_padrao
    """
    try:
        resultado = re.search(padrao, texto, re.DOTALL | re.MULTILINE)
        if resultado:
            valor = resultado.group(1).strip()
            return valor if valor else valor_padrao
        return valor_padrao
    except Exception as e:
        warnings.warn(f"Erro ao extrair campo com padrão '{padrao[:50]}...': {e}")
        return valor_padrao


def analisar_secao_segura(texto: str, nome_secao: str, func_parser) -> Any:
    """
    Executa parser de seção com proteção total contra exceções.
    
    Args:
        texto: Texto a ser analisado
        nome_secao: Nome da seção (para warnings)
        func_parser: Função de parsing a ser executada
    
    Returns:
        Resultado do parser ou None em caso de erro
    """
    try:
        return func_parser(texto)
    except Exception as e:
        warnings.warn(f"Erro ao processar seção '{nome_secao}': {e}")
        return None


def extrair_dados_basicos(texto: str) -> Dict[str, Optional[str]]:
    """Extrai campos básicos do cabeçalho."""
    try:
        dados = {}
        
        # Número do processo
        # Tenta padrão explícito primeiro
        numero = extrair_campo_seguro(texto, r'Nº do Processo:\s*(\d+)')
        if not numero:
            # Tenta encontrar um número de 9 dígitos isolado no início ou após quebra de linha
            # que é comum quando o prefixo "Nº do Processo:" é cortado
            match = re.search(r'(?:^|\n)\s*(\d{9})(?:\s|\n|$)', texto)
            if match:
                numero = match.group(1).strip()
        dados['numero_processo'] = numero
        
        # Nome da marca
        dados['nome_marca'] = extrair_campo_seguro(
            texto, r'Marca:\s*([^\n]+)'
        )
        
        # Situação
        dados['situacao'] = extrair_campo_seguro(
            texto, r'Situação:\s*([^\n]+)'
        )
        
        # Apresentação
        dados['apresentacao'] = extrair_campo_seguro(
            texto, r'Apresentação:\s*([^\n]+)'
        )
        
        # Natureza
        dados['natureza'] = extrair_campo_seguro(
            texto, r'Natureza:\s*([^\n]+)'
        )
        
        return dados
    except Exception as e:
        warnings.warn(f"Erro ao extrair dados básicos: {e}")
        return {
            'numero_processo': None,
            'nome_marca': None,
            'situacao': None,
            'apresentacao': None,
            'natureza': None
        }


def extrair_classes(texto: str) -> List[Dict[str, Optional[str]]]:
    """Extrai informações de classes de produtos/serviços."""
    try:
        classes = []
        
        # Procurar pela seção de classificação
        secao_match = re.search(
            r'Classificação de Produtos / Serviços(.*?)(?:Classificação Internacional|Titulares|Representante Legal|Datas|$)',
            texto,
            re.DOTALL
        )
        
        if not secao_match:
            return []
        
        secao_texto = secao_match.group(1)
        
        # Extrair classe e situação da tabela
        # Regex melhorado para capturar a linha da classe e o que vem depois
        classe_match = re.search(
            r'(NCL\(\d+\)\s*\d+)\s+(.*?)(?:\n|$)',
            secao_texto
        )
        
        if classe_match:
            numero_classe = classe_match.group(1).strip()
            resto_linha = classe_match.group(2).strip()
            
            # Se houver tab, o que vem depois é a especificação inline
            if '\t' in resto_linha:
                parts = resto_linha.split('\t')
                situacao_classe = parts[0].strip()
                especificacao_inline = ' '.join(parts[1:]).strip()
            else:
                situacao_classe = resto_linha
                especificacao_inline = None
            
            # Extrair especificação completa (seção dedicada "Especificação")
            spec_match = re.search(
                r'Especificação\s+(.*?)(?:\n\n|Classificação Internacional|Titulares|Datas|$)',
                secao_texto,
                re.DOTALL
            )
            
            especificacao_vinda_de_secao = None
            if spec_match:
                # Limpar especificação: remover cabeçalhos e tabs
                raw_spec = spec_match.group(1).strip()
                linhas = raw_spec.split('\n')
                especificacao_limpa = []
                for linha in linhas:
                    linha_stripped = linha.strip()
                    # Pular linhas que parecem ser cabeçalhos de tabela ou vazias
                    if linha_stripped and not re.match(r'^(Classe de Nice|NCL\(\d+\)|Situação|Vide|Especificação)', linha_stripped):
                        especificacao_limpa.append(linha_stripped)
                especificacao_vinda_de_secao = ' '.join(especificacao_limpa).strip()
            
            # Combinar especificações (prioriza a da seção, mas aceita a inline)
            especificacao = especificacao_vinda_de_secao if especificacao_vinda_de_secao else especificacao_inline
            
            classes.append({
                'numero_classe': numero_classe,
                'situacao_classe': situacao_classe,
                'especificacao': especificacao
            })
        
        return classes
    except Exception as e:
        warnings.warn(f"Erro ao extrair classes: {e}")
        return []


def extrair_classificacao_viena(texto: str) -> List[Dict[str, Optional[str]]]:
    """Extrai classificação internacional de Viena."""
    try:
        classificacoes = []
        
        # Procurar seção de Viena
        secao_match = re.search(
            r'Classificação Internacional de Viena(.*?)(?:Titulares|Representante Legal|Datas|$)',
            texto,
            re.DOTALL
        )
        
        if not secao_match:
            return []
        
        secao_texto = secao_match.group(1)
        
        # Encontrar todas as linhas de classificação
        linhas = re.findall(
            r'(\d+)\s+([\d.]+)\s+(.+?)(?:\n|$)',
            secao_texto
        )
        
        for edicao, codigo, descricao in linhas:
            classificacoes.append({
                'edicao': edicao.strip(),
                'codigo': codigo.strip(),
                'descricao': descricao.strip()
            })
        
        return classificacoes
    except Exception as e:
        warnings.warn(f"Erro ao extrair classificação de Viena: {e}")
        return []


def extrair_titulares(texto: str) -> List[Dict[str, str]]:
    """Extrai informações dos titulares."""
    try:
        titulares = []
        
        # Extrair todos os titulares (Titular(1), Titular(2), etc.)
        matches = re.finditer(
            r'Titular\(\d+\):\s+([^\n]+)',
            texto
        )
        
        for match in matches:
            titulares.append({'nome': match.group(1).strip()})
        
        return titulares
    except Exception as e:
        warnings.warn(f"Erro ao extrair titulares: {e}")
        return []


def extrair_representante_legal(texto: str) -> Optional[Dict[str, str]]:
    """Extrai representante legal/procurador."""
    try:
        match = re.search(
            r'Procurador:\s+([^\n]+)',
            texto
        )
        
        if match:
            return {'nome': match.group(1).strip()}
        return None
    except Exception as e:
        warnings.warn(f"Erro ao extrair representante legal: {e}")
        return None


def extrair_datas(texto: str) -> Dict[str, Optional[str]]:
    """Extrai datas importantes do processo."""
    try:
        datas = {
            'deposito': None,
            'concessao': None,
            'vigencia': None
        }
        
        # Procurar tabela de datas
        secao_match = re.search(
            r'Data de Depósito\s+Data de Concessão\s+Data de Vigência\s+(\d{2}/\d{2}/\d{4})\s+(\d{2}/\d{2}/\d{4})?\s+(\d{2}/\d{2}/\d{4})?',
            texto
        )
        
        if secao_match:
            datas['deposito'] = secao_match.group(1).strip() if secao_match.group(1) else None
            datas['concessao'] = secao_match.group(2).strip() if secao_match.group(2) else None
            datas['vigencia'] = secao_match.group(3).strip() if secao_match.group(3) else None
        
        return datas
    except Exception as e:
        warnings.warn(f"Erro ao extrair datas: {e}")
        return {'deposito': None, 'concessao': None, 'vigencia': None}


def extrair_prazos_prorrogacao(texto: str) -> Optional[Dict[str, Optional[str]]]:
    """Extrai prazos de prorrogação (apenas para registros em vigor)."""
    try:
        # Verificar se há seção de prazos
        if 'Prazos para prorrogação' not in texto:
            return None
        
        prazos = {}
        
        # Extrair prazos ordinários
        ord_inicio = extrair_campo_seguro(texto, r'Prazo Ordinário\s+.*?Início\s+(\d{2}/\d{2}/\d{4})')
        ord_fim = extrair_campo_seguro(texto, r'Prazo Ordinário\s+.*?Fim\s+(\d{2}/\d{2}/\d{4})')
        
        # Extrair prazos extraordinários
        ext_inicio = extrair_campo_seguro(texto, r'Prazo Extraordinário\s+.*?Início\s+(\d{2}/\d{2}/\d{4})')
        ext_fim = extrair_campo_seguro(texto, r'Prazo Extraordinário\s+.*?Fim\s+(\d{2}/\d{2}/\d{4})')
        
        # Tentar padrão alternativo
        if not ord_inicio:
            match = re.search(
                r'Início\s+(\d{2}/\d{2}/\d{4})\s+(\d{2}/\d{2}/\d{4})',
                texto
            )
            if match:
                ord_inicio = match.group(1)
                ext_inicio = match.group(2)
        
        if not ord_fim:
            match = re.search(
                r'Fim\s+(\d{2}/\d{2}/\d{4})\s+(\d{2}/\d{2}/\d{4})',
                texto
            )
            if match:
                ord_fim = match.group(1)
                ext_fim = match.group(2)
        
        return {
            'ordinario_inicio': ord_inicio,
            'ordinario_fim': ord_fim,
            'extraordinario_inicio': ext_inicio,
            'extraordinario_fim': ext_fim
        }
    except Exception as e:
        warnings.warn(f"Erro ao extrair prazos de prorrogação: {e}")
        return None


def extrair_publicacoes(texto: str) -> List[Dict[str, Optional[str]]]:
    """Extrai publicações do INPI."""
    try:
        publicacoes = []
        
        # Procurar seção de publicações
        secao_match = re.search(
            r'Publicações\s+(.*?)(?:Dados atualizados|$)',
            texto,
            re.DOTALL
        )
        
        if not secao_match:
            return []
        
        secao_texto = secao_match.group(1)
        
        # Encontrar todas as linhas de publicação (RPI, Data, Despacho)
        linhas = re.findall(
            r'(\d+)\s+(\d{2}/\d{2}/\d{4})\s+([^\t\n]+?)(?:\t|-\t|-\s+|Protocolo:|Detalhes do despacho:|$)',
            secao_texto
        )
        
        for rpi, data, despacho in linhas:
            pub = {
                'rpi': rpi.strip(),
                'data_rpi': data.strip(),
                'despacho': despacho.strip(),
                'detalhes': ''
            }
            
            # Tentar extrair detalhes/complemento do despacho
            detalhes_pattern = fr'{rpi}.*?{data}.*?{re.escape(despacho)}.*?(?:Protocolo:|Detalhes do despacho:|Complemento do Despacho:)(.*?)(?:\n\d{{4}}|\n\s*\n|Dados atualizados|$)'
            detalhes_match = re.search(detalhes_pattern, secao_texto, re.DOTALL)
            
            if detalhes_match:
                pub['detalhes'] = detalhes_match.group(1).strip()
            
            publicacoes.append(pub)
        
        return publicacoes
    except Exception as e:
        warnings.warn(f"Erro ao extrair publicações: {e}")
        return []


def extrair_detalhes_indeferimento(texto: str, publicacoes: List[Dict], numero_processo_atual: str) -> Optional[Dict[str, str]]:
    """
    Extrai detalhes de indeferimento quando aplicável.
    
    Args:
        texto: Texto completo
        publicacoes: Lista de publicações já extraídas
        numero_processo_atual: Número do processo atual (para não confundir com protocolo)
    
    Returns:
        Dict com motivo e lista de protocolos conflitantes, ou None
    """
    try:
        # Verificar se há indeferimento nas publicações
        for pub in publicacoes:
            despacho = pub.get('despacho', '').lower()
            if 'indeferimento' in despacho or 'indeferido' in despacho:
                detalhes_texto = pub.get('detalhes', '')
                
                # Extrair protocolo(s) dos detalhes da publicação
                protocolos = []
                
                # Primeiro: protocolo explícito nos detalhes
                protocolo_match = re.search(r'Protocolo:\s*(\d+)', detalhes_texto)
                if protocolo_match:
                    prot = protocolo_match.group(1).strip()
                    if prot != numero_processo_atual:
                        protocolos.append(prot)
                
                # Buscar por registros citados no motivo (ex: "REGS. 790285746 E 827354738")
                regs_matches = re.findall(r'REGS?\.?\s*([\d\s]+(?:E|,)?\s*[\d\s]*)', detalhes_texto, re.IGNORECASE)
                for match in regs_matches:
                    # Extrair números individuais
                    numeros = re.findall(r'\d+', match)
                    for num in numeros:
                        if num != numero_processo_atual and num not in protocolos:
                            protocolos.append(num)
                
                # Se não encontrou protocolos nos detalhes, buscar na seção de Petições
                # MAS APENAS se for o protocolo da petição que originou o indeferimento
                if not protocolos:
                    # Procurar seção de petições
                    peticoes_match = re.search(
                        r'Petições\s+(.*?)(?:Publicações|Dados atualizados|$)',
                        texto,
                        re.DOTALL
                    )
                    if peticoes_match:
                        peticoes_texto = peticoes_match.group(1)
                        # Pegar protocolos de 12 dígitos, excluindo o processo atual
                        todos_protocolos = re.findall(r'(\d{12})', peticoes_texto)
                        for prot in todos_protocolos:
                            if prot != numero_processo_atual and prot not in protocolos:
                                protocolos.append(prot)
                                break  # Apenas o primeiro diferente do processo atual
                
                # Extrair motivo (texto depois de "Detalhes do despacho:")
                motivo = None
                motivo_match = re.search(
                    r'(?:Detalhes do despacho:|despacho:)(.*?)$',
                    detalhes_texto,
                    re.DOTALL
                )
                if motivo_match:
                    motivo = motivo_match.group(1).strip()
                elif detalhes_texto:
                    # Se não encontrou o padrão, usa o texto completo
                    motivo = detalhes_texto.strip()
                
                if motivo or protocolos:
                    return {
                        'motivo': motivo,
                        'protocolos_conflitantes': protocolos if protocolos else None
                    }
        
        return None
    except Exception as e:
        warnings.warn(f"Erro ao extrair detalhes de indeferimento: {e}")
        return None



def analisar_dados_inpi(texto_bruto: str) -> Dict[str, Any]:
    """
    Analisa texto bruto do INPI e retorna JSON estruturado.
    
    Esta função é 100% tolerante a falhas - nunca levanta exceções,
    apenas emite warnings quando há problemas na análise.
    
    Args:
        texto_bruto: Texto HTML/texto copiado do site do INPI
    
    Returns:
        Dicionário com dados estruturados da marca
    """
    try:
        # Inicializar estrutura de retorno com valores padrão seguros
        resultado = {
            'numero_processo': None,
            'nome_marca': None,
            'situacao': None,
            'apresentacao': None,
            'natureza': None,
            'classes': [],
            'classificacao_viena': [],
            'titulares': [],
            'representante_legal': None,
            'datas': {
                'deposito': None,
                'concessao': None,
                'vigencia': None
            },
            'prazos_prorrogacao': None,
            'publicacoes': [],
            'detalhes_indeferimento': None
        }
        
        # Extrair cada seção de forma segura
        dados_basicos = analisar_secao_segura(texto_bruto, 'Dados Básicos', extrair_dados_basicos)
        if dados_basicos:
            resultado.update(dados_basicos)
        
        resultado['classes'] = analisar_secao_segura(texto_bruto, 'Classes', extrair_classes) or []
        
        resultado['classificacao_viena'] = analisar_secao_segura(
            texto_bruto, 'Classificação de Viena', extrair_classificacao_viena
        ) or []
        
        resultado['titulares'] = analisar_secao_segura(texto_bruto, 'Titulares', extrair_titulares) or []
        
        resultado['representante_legal'] = analisar_secao_segura(
            texto_bruto, 'Representante Legal', extrair_representante_legal
        )
        
        datas = analisar_secao_segura(texto_bruto, 'Datas', extrair_datas)
        if datas:
            resultado['datas'] = datas
        
        resultado['prazos_prorrogacao'] = analisar_secao_segura(
            texto_bruto, 'Prazos de Prorrogação', extrair_prazos_prorrogacao
        )
        
        publicacoes = analisar_secao_segura(texto_bruto, 'Publicações', extrair_publicacoes) or []
        resultado['publicacoes'] = publicacoes
        
        # Extrair detalhes de indeferimento se aplicável
        numero_processo = resultado.get('numero_processo')
        resultado['detalhes_indeferimento'] = analisar_secao_segura(
            texto_bruto,
            'Detalhes de Indeferimento',
            lambda t: extrair_detalhes_indeferimento(t, publicacoes, numero_processo)
        )
        
        return resultado
        
    except Exception as e:
        warnings.warn(f"Erro crítico ao analisar dados do INPI: {e}")
        # Retornar estrutura vazia mesmo em caso de erro crítico
        return {
            'numero_processo': None,
            'nome_marca': None,
            'situacao': None,
            'apresentacao': None,
            'natureza': None,
            'classes': [],
            'classificacao_viena': [],
            'titulares': [],
            'representante_legal': None,
            'datas': {'deposito': None, 'concessao': None, 'vigencia': None},
            'prazos_prorrogacao': None,
            'publicacoes': [],
            'detalhes_indeferimento': None
        }
