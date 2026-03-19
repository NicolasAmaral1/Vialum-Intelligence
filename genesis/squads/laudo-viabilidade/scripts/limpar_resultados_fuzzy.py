#!/usr/bin/env python3
"""
Limpeza de resultados da busca fuzzy do INPI.

Le o arquivo .md bruto gerado por busca_inpi_fuzzy.py e extrai apenas:
- Nome da marca
- Numero do processo
- Classes NCL
- Status/Situacao
- Titular

Formato real do INPI (tabular, separado por tab):
Numero  Prioridade    Marca    Situacao  Titular  Classe
006823483  17/05/1977    GENESIS    Extinto  A T PASCOAL CONFECCOES LTDA  25 : 99
813998956  12/01/1988    GENESIS    Registro de marca em vigor  GENESIS VIAGENS E TURISMO LTDA  38 : 30

Classes podem vir como:
- "25 : 99" (formato antigo: classe : subclasse)
- "NCL(8) 28" (formato NCL com edicao)
- "NCL(12) 35" (formato NCL com edicao)

Uso:
    python limpar_resultados_fuzzy.py raw-fuzzy.md -o fuzzy-clean.json
"""

import json
import re
import sys
import argparse
from pathlib import Path
from typing import List, Dict, Optional


def extrair_marcas_de_texto(texto: str) -> List[Dict[str, Optional[str]]]:
    """
    Extrai marcas do formato tabular real do INPI.

    Cada linha de resultado segue o padrao (separado por tabs):
    NUMERO  DATA    MARCA    SITUACAO  TITULAR  CLASSE
    """
    marcas = []
    linhas = texto.split("\n")

    for linha in linhas:
        # Pular linhas vazias, cabecalhos, separadores
        stripped = linha.strip()
        if not stripped:
            continue
        if stripped.startswith("#") or stripped.startswith("-") or stripped.startswith("="):
            continue
        if stripped.startswith("BRASIL") or stripped.startswith("Instituto"):
            continue
        if "Consulta" in stripped or "RESULTADO" in stripped:
            continue
        if "Foram encontrados" in stripped or "Mostrando" in stripped:
            continue
        if "Páginas de Resultados" in stripped or "Próxima" in stripped:
            continue
        if stripped.startswith("Número") and "Marca" in stripped:
            continue
        if stripped.startswith("»") or stripped.startswith("["):
            continue
        if "Rua Mayrink" in stripped or "CEP:" in stripped:
            continue
        if "Acesso à informação" in stripped or "Participe" in stripped:
            continue
        if stripped.startswith("Pagina") or "busca:" in stripped.lower():
            continue

        # Tentar parsear como linha tabular do INPI
        # O INPI usa tabs como separador. Formato:
        # NUMERO\tDATA\t\tMARCA\t\tSITUACAO\tTITULAR\tCLASSE
        partes = re.split(r"\t+", stripped)

        # Precisamos de pelo menos 4 partes para ser uma linha valida
        if len(partes) < 4:
            continue

        # Primeira parte deve ser um numero de processo (6-9 digitos)
        numero = partes[0].strip()
        if not re.match(r"^\d{6,9}$", numero):
            continue

        # Extrair campos
        marca = {
            "numero_processo": numero,
            "nome_marca": None,
            "situacao": None,
            "titular": None,
            "classes": [],
            "prioridade": None,
        }

        # Filtrar partes vazias (tabs duplos geram strings vazias)
        partes_limpas = [p.strip() for p in partes if p.strip()]

        # partes_limpas tipicamente:
        # [0] = numero processo
        # [1] = data prioridade (DD/MM/YYYY)
        # [2] = nome da marca
        # [3] = situacao
        # [4] = titular
        # [5] = classe (pode nao existir)

        idx = 1  # pular numero

        # Prioridade (data)
        if idx < len(partes_limpas) and re.match(r"\d{2}/\d{2}/\d{4}", partes_limpas[idx]):
            marca["prioridade"] = partes_limpas[idx]
            idx += 1

        # Nome da marca
        if idx < len(partes_limpas):
            marca["nome_marca"] = partes_limpas[idx]
            idx += 1

        # Situacao
        if idx < len(partes_limpas):
            # Situacao pode ser multi-palavra: "Registro de marca em vigor"
            candidato = partes_limpas[idx]
            if _parece_situacao(candidato):
                marca["situacao"] = candidato
                idx += 1
            else:
                # Pode ter pulado - tentar proximo
                if idx + 1 < len(partes_limpas) and _parece_situacao(partes_limpas[idx + 1]):
                    marca["situacao"] = partes_limpas[idx + 1]
                    marca["titular"] = partes_limpas[idx]  # o atual era titular
                    idx += 2

        # Titular
        if idx < len(partes_limpas) and marca["titular"] is None:
            if not _parece_classe(partes_limpas[idx]):
                marca["titular"] = partes_limpas[idx]
                idx += 1

        # Classe
        if idx < len(partes_limpas):
            classe_str = partes_limpas[idx]
            classes = _extrair_classes(classe_str)
            marca["classes"] = classes

        # Tambem procurar classes em qualquer parte restante
        for p in partes_limpas[idx:]:
            extra_classes = _extrair_classes(p)
            for c in extra_classes:
                if c not in marca["classes"]:
                    marca["classes"].append(c)

        if marca["nome_marca"]:
            marcas.append(marca)

    return marcas


def _parece_situacao(texto: str) -> bool:
    """Verifica se o texto parece ser uma situacao do INPI."""
    situacoes = [
        "extinto", "arquivado", "vigor", "registro", "pedido",
        "indeferid", "publicad", "deferido", "nulidade", "aguardando",
    ]
    texto_lower = texto.lower()
    return any(s in texto_lower for s in situacoes)


def _parece_classe(texto: str) -> bool:
    """Verifica se o texto parece ser uma classe NCL."""
    return bool(re.match(r"^(NCL\(\d+\)\s*\d+|\d{1,2}\s*:\s*\d+)$", texto.strip()))


def _extrair_classes(texto: str) -> List[int]:
    """Extrai numeros de classe NCL de uma string."""
    classes = []

    # Formato NCL: "NCL(12) 35"
    ncl_matches = re.findall(r"NCL\(\d+\)\s*(\d+)", texto)
    for c in ncl_matches:
        val = int(c)
        if 1 <= val <= 45:
            classes.append(val)

    # Formato antigo: "25 : 99" (classe : subclasse) ou "35"
    if not classes:
        old_match = re.match(r"(\d{1,2})\s*:\s*\d+", texto.strip())
        if old_match:
            val = int(old_match.group(1))
            if 1 <= val <= 45:
                classes.append(val)

    return classes


def deduplicar(marcas: List[Dict]) -> List[Dict]:
    """Remove marcas duplicadas por numero de processo."""
    vistos = set()
    resultado = []
    for m in marcas:
        chave = m.get("numero_processo", "")
        if chave and chave not in vistos:
            vistos.add(chave)
            resultado.append(m)
    return resultado


def main():
    parser = argparse.ArgumentParser(
        description="Limpa resultados brutos da busca fuzzy INPI",
    )
    parser.add_argument("input_file", help="Arquivo .md bruto da busca fuzzy")
    parser.add_argument(
        "-o", "--output",
        help="Arquivo .json de saida (default: fuzzy-clean.json na mesma pasta)",
    )

    args = parser.parse_args()
    input_path = Path(args.input_file)

    if not input_path.exists():
        print(f"Erro: arquivo nao encontrado: {input_path}")
        sys.exit(1)

    output_path = Path(args.output) if args.output else input_path.parent / "fuzzy-clean.json"

    print(f"Lendo: {input_path}")
    texto = input_path.read_text(encoding="utf-8")

    print("Extraindo marcas...")
    marcas = extrair_marcas_de_texto(texto)

    print(f"Marcas encontradas (antes de dedup): {len(marcas)}")
    marcas = deduplicar(marcas)
    print(f"Marcas unicas: {len(marcas)}")

    # Salvar JSON
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(marcas, f, ensure_ascii=False, indent=2)

    print(f"JSON salvo em: {output_path}")

    # Resumo
    com_situacao = sum(1 for m in marcas if m.get("situacao"))
    com_classes = sum(1 for m in marcas if m.get("classes"))
    print(f"\nResumo:")
    print(f"  Total: {len(marcas)}")
    print(f"  Com situacao: {com_situacao}")
    print(f"  Com classes: {com_classes}")

    sys.exit(0)


if __name__ == "__main__":
    main()
