#!/usr/bin/env python3
"""
grafo_marcas.py — Análise de Cenário por Grafo (Fase 1.5)

Constrói um grafo de relações entre marcas coletadas e a marca-alvo.
Substitui análise tabelar por traversal de grafo.

Nós: marcas, elementos nominativos, classes NCL, titulares
Arestas: contém_elemento, registrada_em, pertence_a, similar_a

Métricas derivadas:
  - Desgaste: degree do nó elemento na classe = quantas marcas usam aquele termo
  - Colidência: vizinhos compartilhados entre marca-alvo e candidata
  - Relevância: distância no grafo (1 hop = alto risco, 2 hops = médio)

Output:
  - coleta/grafo-marcas.json (serializado)
  - coleta/grafo-cenario.html (visualização interativa)
  - coleta/mapa-elementos.json (atualizado com métricas do grafo)
  - peneira/peneira-resultado.json (classificação por traversal)

Uso:
    python grafo_marcas.py \\
        --marca "RUN BABY RUN" \\
        --atividade "Eventos e comunidade wellness, vestuário esportivo, assessoria esportiva, suplementação" \\
        --pasta "laudos/Reinaldo Neto/RUN BABY RUN" \\
        --classes 41,25,5,35,28 \\
        --adjacentes 44,3,9,10,29,30,32,43
"""

import argparse
import json
import re
import sys
import time
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

import networkx as nx


def log(msg: str):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def agora_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def has_word(text: str, word: str) -> bool:
    return bool(re.search(r'\b' + re.escape(word) + r'\b', text, re.IGNORECASE))


# ─────────────────────────────────────────────
# CLASSIFICAÇÃO DE DECISÃO INPI
# ─────────────────────────────────────────────

def classificar_decisao(situacao: str) -> Tuple[str, bool, int]:
    """
    Classifica situação processual.
    Returns: (categoria, conta_como_precedente, peso)
    """
    if not situacao:
        return "desconhecido", False, 0
    s = situacao.lower()

    if "recurso" in s and ("indeferid" in s or "mantid" in s or "negado" in s):
        return "indeferido_recurso_mantido", True, 4
    if "indeferid" in s and "recurso" not in s:
        return "indeferido_simples", True, 2
    if "recurso" in s and "aguardando" not in s and "apresentação" not in s:
        return "decisao_recurso", True, 3
    if "vigor" in s:
        return "em_vigor", True, 1
    if "deferid" in s and "indeferid" not in s:
        return "em_vigor", True, 1
    if any(kw in s for kw in ["aguardando", "exame", "sobrest", "oposição",
                               "publicad", "prazo", "manifestação", "liberar"]):
        return "em_analise", False, 0
    if "arquivad" in s and "indeferid" not in s:
        return "arquivada", False, 0
    if "extint" in s:
        return "extinta", False, 0
    if "recurso" in s:
        return "recurso_pendente", False, 0
    return "outro", False, 0


# ─────────────────────────────────────────────
# EXTRAÇÃO DE ELEMENTOS NOMINATIVOS
# ─────────────────────────────────────────────

STOPWORDS = {
    "de", "do", "da", "dos", "das", "e", "em", "na", "no", "nas", "nos",
    "por", "para", "com", "sem", "a", "o", "as", "os", "um", "uma",
    "the", "of", "and", "for", "in", "at", "by", "to", "or", "is",
    "&", "-", "+", "/", ".", ",", "!", "?", "#", "@",
    "ltda", "me", "epp", "eireli", "sa", "s.a", "ltd", "inc",
    "marca", "marcas", "registro", "brasil", "brazil",
}


def extrair_elementos(nome: str) -> List[str]:
    """Extrai elementos nominativos significativos de um nome de marca."""
    if not nome:
        return []
    # Tokenizar
    tokens = re.findall(r"[A-Za-zÀ-ÿ']+", nome)
    elementos = []
    for t in tokens:
        t_lower = t.lower()
        if t_lower not in STOPWORDS and len(t) >= 2:
            elementos.append(t.upper())
    return elementos


# ─────────────────────────────────────────────
# SIMILARIDADE FONÉTICA SIMPLES
# ─────────────────────────────────────────────

def similaridade_fonetica(a: str, b: str) -> float:
    """Score de similaridade fonética simplificado (0-1)."""
    a, b = a.upper(), b.upper()
    if a == b:
        return 1.0

    # Prefixo comum
    prefix_len = 0
    for ca, cb in zip(a, b):
        if ca == cb:
            prefix_len += 1
        else:
            break
    max_len = max(len(a), len(b))
    if max_len == 0:
        return 0.0

    prefix_score = prefix_len / max_len

    # Levenshtein normalizado (simplificado)
    if abs(len(a) - len(b)) > max_len * 0.5:
        return prefix_score * 0.5

    # Caracteres compartilhados
    set_a, set_b = set(a), set(b)
    jaccard = len(set_a & set_b) / len(set_a | set_b) if set_a | set_b else 0

    return (prefix_score * 0.6 + jaccard * 0.4)


# ─────────────────────────────────────────────
# CONSTRUÇÃO DO GRAFO
# ─────────────────────────────────────────────

def construir_grafo(
    marca_alvo: str,
    elementos_alvo: List[str],
    marcas: List[Dict],
    classes_aprovadas: Set[int],
    classes_adjacentes: Set[int],
) -> nx.DiGraph:
    """
    Constrói grafo direcionado com marcas, elementos, classes e relações.
    """
    G = nx.DiGraph()

    # Nó da marca alvo
    G.add_node(marca_alvo, tipo="marca_alvo", label=marca_alvo)

    # Nós dos elementos da marca alvo
    for elem in elementos_alvo:
        elem_id = f"elem:{elem}"
        G.add_node(elem_id, tipo="elemento", label=elem)
        G.add_edge(marca_alvo, elem_id, tipo="contém_elemento")

    # Nós de classes
    for cls in classes_aprovadas | classes_adjacentes:
        cls_id = f"cls:{cls}"
        grupo = "aprovada" if cls in classes_aprovadas else "adjacente"
        G.add_node(cls_id, tipo="classe", label=f"Classe {cls}", grupo=grupo)

    # Conectar marca alvo às classes aprovadas
    for cls in classes_aprovadas:
        G.add_edge(marca_alvo, f"cls:{cls}", tipo="registra_em")

    # Processar cada marca coletada
    for m in marcas:
        numero = m.get("numero_processo", "")
        nome = (m.get("nome_marca") or "").strip()
        classe = m.get("classe")
        situacao = m.get("situacao") or ""

        if not nome or not numero:
            continue

        categoria, conta, peso = classificar_decisao(situacao)

        # Nó da marca
        marca_id = f"m:{numero}"
        G.add_node(marca_id,
            tipo="marca",
            label=nome,
            numero=numero,
            classe=classe,
            situacao=situacao,
            categoria=categoria,
            conta_precedente=conta,
            peso_decisao=peso,
        )

        # Classe
        if classe:
            cls_id = f"cls:{classe}"
            if not G.has_node(cls_id):
                grupo = "aprovada" if classe in classes_aprovadas else (
                    "adjacente" if classe in classes_adjacentes else "sem_afinidade"
                )
                G.add_node(cls_id, tipo="classe", label=f"Classe {classe}", grupo=grupo)
            G.add_edge(marca_id, cls_id, tipo="registrada_em")

        # Elementos
        elementos_marca = extrair_elementos(nome)
        for elem in elementos_marca:
            elem_id = f"elem:{elem}"
            if not G.has_node(elem_id):
                G.add_node(elem_id, tipo="elemento", label=elem)
            G.add_edge(marca_id, elem_id, tipo="contém_elemento")

        # Similaridade com elementos da marca alvo
        for elem_alvo in elementos_alvo:
            for elem_marca in elementos_marca:
                sim = similaridade_fonetica(elem_alvo, elem_marca)
                if sim >= 0.6 and elem_alvo != elem_marca:
                    G.add_edge(
                        f"elem:{elem_marca}", f"elem:{elem_alvo}",
                        tipo="similar_fonetica", score=round(sim, 2)
                    )

    return G


# ─────────────────────────────────────────────
# MÉTRICAS DO GRAFO
# ─────────────────────────────────────────────

def calcular_metricas(
    G: nx.DiGraph,
    marca_alvo: str,
    elementos_alvo: List[str],
    classes_aprovadas: Set[int],
) -> Dict:
    """Calcula desgaste, densidade e outras métricas por elemento."""
    metricas = {}

    for elem in elementos_alvo:
        elem_id = f"elem:{elem}"
        if not G.has_node(elem_id):
            continue

        # Marcas que contêm esse elemento (predecessores no grafo)
        marcas_com_elem = [
            n for n in G.predecessors(elem_id)
            if G.nodes[n].get("tipo") == "marca"
        ]

        por_classe = {}
        for cls in classes_aprovadas:
            marcas_cls = [
                n for n in marcas_com_elem
                if G.nodes[n].get("classe") == cls
            ]

            em_vigor = [n for n in marcas_cls if G.nodes[n].get("categoria") == "em_vigor"]
            indeferidas = [n for n in marcas_cls if G.nodes[n].get("categoria") in
                          ("indeferido_simples", "indeferido_recurso_mantido", "decisao_recurso")]
            recurso_mantido = [n for n in marcas_cls if G.nodes[n].get("categoria") == "indeferido_recurso_mantido"]
            total_julgadas = len(em_vigor) + len(indeferidas)

            taxa_indef = len(indeferidas) / total_julgadas if total_julgadas > 0 else 0
            desgaste = len(em_vigor) / max(total_julgadas, 1)

            if len(em_vigor) > 20:
                densidade = "ALTA"
            elif len(em_vigor) >= 5:
                densidade = "MÉDIA"
            else:
                densidade = "BAIXA"

            # Desgaste score
            if desgaste > 0.5 and len(em_vigor) > 20:
                desgaste_nivel = "ALTO"
            elif desgaste < 0.1 or len(em_vigor) < 5:
                desgaste_nivel = "ZERO"
            else:
                desgaste_nivel = "MÉDIO"

            por_classe[cls] = {
                "em_vigor": len(em_vigor),
                "indeferidas": len(indeferidas),
                "recurso_mantido": len(recurso_mantido),
                "total_julgadas": total_julgadas,
                "taxa_indeferimento": round(taxa_indef, 2),
                "densidade": densidade,
                "desgaste_score": round(desgaste, 2),
                "desgaste_nivel": desgaste_nivel,
            }

        # Grau total do nó elemento
        grau = G.in_degree(elem_id)

        metricas[elem] = {
            "grau_total": grau,
            "por_classe": por_classe,
        }

    return metricas


# ─────────────────────────────────────────────
# PENEIRA POR TRAVERSAL
# ─────────────────────────────────────────────

def peneira_por_grafo(
    G: nx.DiGraph,
    marca_alvo: str,
    elementos_alvo: List[str],
    metricas: Dict,
    classes_aprovadas: Set[int],
    classes_adjacentes: Set[int],
) -> Dict:
    """
    Classifica marcas em nível 1/2/3 por distância no grafo.

    Lógica:
    - Vizinhos compartilhados com marca-alvo determinam a relevância
    - Desgaste modula: elemento desgastado pesa menos
    - Decisões de mérito pesam mais
    """
    # Elementos da marca alvo e seus IDs
    alvo_elem_ids = {f"elem:{e}" for e in elementos_alvo}

    # Classificar desgaste dos elementos
    desgaste_map = {}
    for elem in elementos_alvo:
        # Pegar o pior desgaste entre as classes aprovadas
        niveis = []
        for cls, data in metricas.get(elem, {}).get("por_classe", {}).items():
            niveis.append(data.get("desgaste_nivel", "MÉDIO"))
        if "ALTO" in niveis:
            desgaste_map[elem] = "ALTO"
        elif "ZERO" in niveis:
            desgaste_map[elem] = "ZERO"
        else:
            desgaste_map[elem] = "MÉDIO"

    vivas_n1, vivas_n2, vivas_n3 = [], [], []
    prec_n1, prec_n2, prec_n3 = [], [], []

    # Para cada marca no grafo
    for node, attrs in G.nodes(data=True):
        if attrs.get("tipo") != "marca":
            continue

        numero = attrs.get("numero", "")
        nome = attrs.get("label", "")
        classe = attrs.get("classe")
        situacao = attrs.get("situacao", "")
        categoria = attrs.get("categoria", "")
        conta = attrs.get("conta_precedente", False)
        peso = attrs.get("peso_decisao", 0)

        # Elementos desta marca
        elem_ids_marca = {
            n for n in G.successors(node)
            if G.nodes[n].get("tipo") == "elemento"
        }

        # Elementos compartilhados com a marca alvo
        compartilhados = alvo_elem_ids & elem_ids_marca
        nomes_compartilhados = [G.nodes[e]["label"] for e in compartilhados]

        # Elementos compartilhados via similaridade fonética (2 hops)
        similares_indiretos = set()
        for eid in elem_ids_marca:
            for vizinho in G.successors(eid):
                if vizinho in alvo_elem_ids:
                    edge_data = G.edges[eid, vizinho]
                    if edge_data.get("tipo") == "similar_fonetica":
                        similares_indiretos.add(
                            (G.nodes[eid]["label"], G.nodes[vizinho]["label"],
                             edge_data.get("score", 0))
                        )

        # Classe relevante?
        classe_relevante = classe in classes_aprovadas
        classe_adjacente = classe in classes_adjacentes

        # --- SCORING ---
        score = 0
        razoes = []

        # Elementos compartilhados diretos
        for elem_nome in nomes_compartilhados:
            desg = desgaste_map.get(elem_nome, "MÉDIO")
            if desg == "ZERO":
                score += 3
                razoes.append(f"{elem_nome} (distintivo, desgaste zero)")
            elif desg == "MÉDIO":
                score += 2
                razoes.append(f"{elem_nome} (desgaste médio)")
            else:  # ALTO
                score += 1
                razoes.append(f"{elem_nome} (genérico, desgaste alto)")

        # Similaridade fonética indireta
        for elem_m, elem_a, sim_score in similares_indiretos:
            if sim_score >= 0.8:
                score += 2
                razoes.append(f"{elem_m}~{elem_a} (fonética {sim_score})")
            elif sim_score >= 0.6:
                score += 1
                razoes.append(f"{elem_m}~{elem_a} (fonética {sim_score})")

        # Classe
        if classe_relevante:
            score += 1
            razoes.append(f"classe {classe} (aprovada)")
        elif classe_adjacente:
            score += 0.5
            razoes.append(f"classe {classe} (adjacente)")

        # Peso da decisão para precedentes
        if peso >= 3:
            score += 1
            razoes.append(f"decisão peso {peso} ({categoria})")

        # --- CLASSIFICAR ---
        if score >= 4:
            nivel = 1
        elif score >= 2:
            nivel = 2
        elif score >= 1:
            # Se tem pelo menos 1 ponto mas < 2, depende do contexto
            if conta and categoria in ("indeferido_simples", "indeferido_recurso_mantido", "decisao_recurso"):
                nivel = 2  # precedentes indeferidos sempre passam
            else:
                nivel = 3
        else:
            nivel = 3

        justificativa = "; ".join(razoes) if razoes else "Sem relação no grafo."

        entry = {
            "numero_processo": numero,
            "nome_marca": nome,
            "classe": classe,
            "situacao": situacao,
            "categoria_decisao": categoria,
            "conta_como_precedente": conta,
            "peso_decisao": peso,
            "score_grafo": round(score, 1),
            "nivel": nivel,
            "justificativa": justificativa,
        }

        # Bucket
        if categoria in ("em_vigor", "em_analise"):
            bucket = "vivas"
        elif conta:
            bucket = "precedentes"
        else:
            # Sem mérito (arquivadas, extintas)
            entry["nivel"] = 3
            entry["justificativa"] += " Sem decisão de mérito."
            prec_n3.append(entry)
            continue

        if bucket == "vivas":
            [vivas_n1, vivas_n2, vivas_n3][nivel - 1].append(entry)
        else:
            [prec_n1, prec_n2, prec_n3][nivel - 1].append(entry)

    return {
        "vivas": {
            "nivel_1_candidatas": sorted(vivas_n1, key=lambda x: -x["score_grafo"]),
            "nivel_2_zona_atencao": sorted(vivas_n2, key=lambda x: -x["score_grafo"]),
            "nivel_3_descartadas": vivas_n3,
        },
        "precedentes": {
            "nivel_1_candidatas": sorted(prec_n1, key=lambda x: -x["score_grafo"]),
            "nivel_2_zona_atencao": sorted(prec_n2, key=lambda x: -x["score_grafo"]),
            "nivel_3_descartadas": prec_n3,
        },
    }


# ─────────────────────────────────────────────
# VISUALIZAÇÃO
# ─────────────────────────────────────────────

def gerar_visualizacao(
    G: nx.DiGraph,
    marca_alvo: str,
    output_path: Path,
    max_nodes: int = 300,
):
    """Gera HTML interativo com pyvis (só nós relevantes)."""
    try:
        from pyvis.network import Network
    except ImportError:
        log("pyvis não instalado, pulando visualização")
        return

    # Subgrafo: marca alvo + vizinhos até 2 hops
    nodes_to_show = set()
    nodes_to_show.add(marca_alvo)

    # 1 hop
    for n in list(G.successors(marca_alvo)) + list(G.predecessors(marca_alvo)):
        nodes_to_show.add(n)
        # 2 hops
        for n2 in list(G.successors(n)) + list(G.predecessors(n)):
            nodes_to_show.add(n2)
            if len(nodes_to_show) > max_nodes:
                break
        if len(nodes_to_show) > max_nodes:
            break

    sub = G.subgraph(nodes_to_show)

    net = Network(height="800px", width="100%", directed=True, bgcolor="#1a1a2e")
    net.barnes_hut(gravity=-3000, central_gravity=0.3, spring_length=150)

    colors = {
        "marca_alvo": "#ff6b6b",
        "marca": "#4ecdc4",
        "elemento": "#ffe66d",
        "classe": "#a8e6cf",
    }

    sizes = {
        "marca_alvo": 40,
        "marca": 12,
        "elemento": 25,
        "classe": 20,
    }

    for node, attrs in sub.nodes(data=True):
        tipo = attrs.get("tipo", "marca")
        label = attrs.get("label", node)
        color = colors.get(tipo, "#888")
        size = sizes.get(tipo, 10)

        # Marcas com score alto = maiores
        if tipo == "marca":
            score = attrs.get("peso_decisao", 0)
            if score >= 3:
                size = 20
                color = "#ff9f43"

        net.add_node(str(node), label=str(label), color=color, size=size)

    for u, v, attrs in sub.edges(data=True):
        tipo = attrs.get("tipo", "")
        color = "#555"
        width = 1
        if tipo == "contém_elemento":
            color = "#ffe66d55"
        elif tipo == "similar_fonetica":
            color = "#ff6b6b"
            width = 2
        elif tipo == "registrada_em":
            color = "#a8e6cf55"

        net.add_edge(str(u), str(v), color=color, width=width)

    net.save_graph(str(output_path))
    log(f"Visualização salva: {output_path}")


# ─────────────────────────────────────────────
# PIPELINE PRINCIPAL
# ─────────────────────────────────────────────

def executar(
    marca_alvo: str,
    atividade: str,
    pasta: Path,
    classes_aprovadas: List[int],
    classes_adjacentes: List[int],
):
    pasta = Path(pasta)
    inicio = time.time()

    log(f"{'=' * 60}")
    log(f"ANÁLISE DE CENÁRIO POR GRAFO — {marca_alvo}")
    log(f"{'=' * 60}\n")

    # Carregar marcas coletadas
    consolidada_path = pasta / "coleta" / "coleta-consolidada.json"
    with open(consolidada_path, "r", encoding="utf-8") as f:
        marcas = json.load(f)
    log(f"Marcas carregadas: {len(marcas)}")

    # Extrair elementos da marca alvo
    elementos_alvo = extrair_elementos(marca_alvo)
    log(f"Elementos da marca alvo: {elementos_alvo}")

    classes_apr = set(classes_aprovadas)
    classes_adj = set(classes_adjacentes)

    # Construir grafo
    log("Construindo grafo...")
    G = construir_grafo(marca_alvo, elementos_alvo, marcas, classes_apr, classes_adj)
    log(f"Grafo: {G.number_of_nodes()} nós, {G.number_of_edges()} arestas")

    # Métricas
    log("Calculando métricas...")
    metricas = calcular_metricas(G, marca_alvo, elementos_alvo, classes_apr)

    for elem, data in metricas.items():
        log(f"\n  {elem}: grau total = {data['grau_total']}")
        for cls, cls_data in data["por_classe"].items():
            log(f"    Classe {cls}: vigor={cls_data['em_vigor']} indef={cls_data['indeferidas']} "
                f"desgaste={cls_data['desgaste_nivel']} ({cls_data['desgaste_score']})")

    # Peneira por traversal
    log("\nExecutando peneira por grafo...")
    resultado_peneira = peneira_por_grafo(
        G, marca_alvo, elementos_alvo, metricas, classes_apr, classes_adj
    )

    # Stats
    v1 = len(resultado_peneira["vivas"]["nivel_1_candidatas"])
    v2 = len(resultado_peneira["vivas"]["nivel_2_zona_atencao"])
    v3 = len(resultado_peneira["vivas"]["nivel_3_descartadas"])
    p1 = len(resultado_peneira["precedentes"]["nivel_1_candidatas"])
    p2 = len(resultado_peneira["precedentes"]["nivel_2_zona_atencao"])
    p3 = len(resultado_peneira["precedentes"]["nivel_3_descartadas"])

    all_specs = [m["numero_processo"] for m in
                 resultado_peneira["vivas"]["nivel_1_candidatas"] +
                 resultado_peneira["vivas"]["nivel_2_zona_atencao"]]
    all_prec = [m["numero_processo"] for m in
                resultado_peneira["precedentes"]["nivel_1_candidatas"] +
                resultado_peneira["precedentes"]["nivel_2_zona_atencao"]]

    # Salvar peneira
    peneira_output = {
        "marca_analisada": marca_alvo,
        "atividade": atividade,
        "classes_aprovadas": classes_aprovadas,
        "metodologia": "Grafo de relações + traversal + desgaste + peso de decisão",
        "data_peneira": agora_iso(),
        **resultado_peneira,
        "listas_para_proximas_fases": {
            "processos_para_specs": all_specs,
            "processos_para_precedentes": all_prec,
        },
        "estatisticas": {
            "total_analisadas": len(marcas),
            "grafo_nos": G.number_of_nodes(),
            "grafo_arestas": G.number_of_edges(),
            "vivas_nivel_1": v1, "vivas_nivel_2": v2, "vivas_nivel_3": v3,
            "precedentes_nivel_1": p1, "precedentes_nivel_2": p2, "precedentes_nivel_3": p3,
            "total_para_specs": len(all_specs),
            "total_para_precedentes": len(all_prec),
        },
        "metricas_elementos": metricas,
    }

    peneira_dir = pasta / "peneira"
    peneira_dir.mkdir(parents=True, exist_ok=True)

    with open(peneira_dir / "peneira-resultado.json", "w", encoding="utf-8") as f:
        json.dump(peneira_output, f, ensure_ascii=False, indent=2)

    with open(peneira_dir / "lista-specs.json", "w", encoding="utf-8") as f:
        json.dump({"processos": all_specs}, f, indent=2)

    with open(peneira_dir / "lista-precedentes.json", "w", encoding="utf-8") as f:
        json.dump({"processos": all_prec}, f, indent=2)

    # Visualização
    log("\nGerando visualização...")
    gerar_visualizacao(G, marca_alvo, pasta / "coleta" / "grafo-cenario.html")

    # Resumo
    fim = time.time()
    log(f"\n{'=' * 60}")
    log(f"RESULTADO — {marca_alvo}")
    log(f"{'=' * 60}")
    log(f"Grafo: {G.number_of_nodes()} nós, {G.number_of_edges()} arestas")
    log(f"Vivas:      {v1} candidatas | {v2} zona de atenção | {v3} descartadas")
    log(f"Precedentes: {p1} candidatas | {p2} zona de atenção | {p3} descartadas")
    log(f"→ {len(all_specs)} para specs | {len(all_prec)} para precedentes")
    log(f"Duração: {round(fim - inicio, 1)}s")

    return peneira_output


# ─────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Análise de cenário por grafo")
    parser.add_argument("--marca", required=True, help="Nome da marca alvo")
    parser.add_argument("--atividade", required=True, help="Atividade do cliente")
    parser.add_argument("--pasta", required=True, help="Pasta do caso")
    parser.add_argument("--classes", required=True, help="Classes aprovadas (vírgula)")
    parser.add_argument("--adjacentes", default="", help="Classes adjacentes (vírgula)")

    args = parser.parse_args()
    classes = [int(c.strip()) for c in args.classes.split(",")]
    adjacentes = [int(c.strip()) for c in args.adjacentes.split(",") if c.strip()]

    executar(args.marca, args.atividade, Path(args.pasta), classes, adjacentes)


if __name__ == "__main__":
    main()
