# Guia de Adjacência de Classes NCL

> Usado pela @peneira (Fase 2) para descartar automaticamente marcas em classes sem afinidade.
> Gerado pela @laudo (Mira) na Fase P para cada caso específico.


---

## Como funciona

Na Fase P (análise intrínseca), a Mira define 3 grupos de classes para o caso:

### Grupo 1 — Classes APROVADAS (diretas)

As classes que o cliente vai registrar. Definidas no Checkpoint 1.

### Grupo 2 — Classes ADJACENTES

Classes que NÃO serão registradas mas têm **afinidade mercadológica** com a atividade do cliente. Marcas nessas classes podem representar risco de confusão ou são relevantes como precedente.

### Grupo 3 — Classes SEM AFINIDADE

Todo o resto. Marcas nessas classes são descartadas automaticamente na peneira (nível 3), EXCETO se o nome for idêntico ou quase idêntico à marca em análise.


---

## Regras de classificação por grupo

### Grupo 2 (adjacentes) — quando incluir uma classe

Uma classe é adjacente quando, considerando a atividade do cliente:


1. **Natureza similar:** serviços/produtos da mesma categoria essencial
   * Ex: atividade saúde → classe 5 (farmácia) é adjacente
2. **Complementariedade:** um serviço é indispensável para o outro
   * Ex: atividade médica → classe 10 (equipamentos médicos) é adjacente
3. **Concorrência/permutabilidade:** consumidor pode substituir um pelo outro
   * Ex: atividade de nutrição → classe 43 (restaurantes/alimentação) é adjacente
4. **Origem habitual:** comum que a mesma empresa atue em ambas
   * Ex: atividade de software de saúde → classe 9 (apps) é adjacente
5. **Canal de distribuição compartilhado:** vendem/contratam pelo mesmo canal
   * Ex: atividade de bem-estar → classe 3 (cosméticos) é adjacente (mesma clínica)

### Grupo 3 (sem afinidade) — quando descartar

Uma classe é sem afinidade quando:

* Nenhum dos 5 critérios acima se aplica
* Um consumidor médio NUNCA confundiria os serviços/produtos
* Não é habitual que a mesma empresa atue em ambas as classes


---

## Regra de exceção — nome idêntico

Mesmo em classe sem afinidade, se o nome da marca for **idêntico ou quase idêntico** à marca em análise (ex: "PLENYA" registrada na classe 12 — veículos), ela sobe para nível 2 na peneira. Motivo: marcas de alto renome são protegidas em todas as classes, e um nome idêntico em qualquer classe merece investigação.

Critério: similaridade fonética ALTA + gráfica ALTA → nível 2 mesmo em classe sem afinidade.


---

## Exemplos por atividade

### Saúde / Bem-estar / Nutrição / Apoio psicológico / Esportivo

| Grupo | Classes | Justificativa |
|----|----|----|
| **Aprovadas** | 44, 41, 42, 35 | Definidas pelo cliente |
| **Adjacentes** | 5 (farmácia), 3 (cosméticos/beleza), 10 (equipamentos médicos), 9 (apps/eletrônicos), 43 (alimentação), 45 (serviços pessoais), 29 (alimentos dietéticos), 30 (alimentos naturais), 32 (bebidas funcionais) | Afinidade mercadológica com saúde/bem-estar/nutrição |
| **Sem afinidade** | 1, 2, 4, 6, 7, 8, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 31, 33, 34, 36, 37, 38, 39, 40 | Sem relação com a atividade |

### Comércio de roupas / Moda

| Grupo | Classes | Justificativa |
|----|----|----|
| **Aprovadas** | 25 (vestuário), 35 (comércio) | Definidas pelo cliente |
| **Adjacentes** | 18 (couro/bolsas), 14 (joias/bijuterias), 26 (bordados/rendas), 3 (cosméticos), 24 (tecidos), 40 (confecção), 42 (design), 9 (e-commerce/app) | Afinidade com moda |
| **Sem afinidade** | 1-13 (exceto 3,9), 15-17, 19-23, 27-34, 36-39, 41, 43-45 | Sem relação |

### Software / Tecnologia

| Grupo | Classes | Justificativa |
|----|----|----|
| **Aprovadas** | 42 (software), 9 (eletrônicos), 35 (comércio) | Definidas pelo cliente |
| **Adjacentes** | 38 (telecomunicações), 41 (educação online), 36 (fintech), 45 (segurança digital) | Afinidade com tech |
| **Sem afinidade** | A maioria das classes de produtos físicos | Sem relação |


---

## Como a Mira gera o guia para cada caso

Na Fase P, após definir as classes aprovadas e antes do Checkpoint 1, a Mira produz:

```json
{
  "guia_adjacencia": {
    "aprovadas": [44, 41, 42, 35],
    "adjacentes": [5, 3, 10, 9, 43, 45, 29, 30, 32],
    "sem_afinidade": [1, 2, 4, 6, 7, 8, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 31, 33, 34, 36, 37, 38, 39, 40],
    "justificativa_adjacentes": {
      "5": "Farmácia — complementar a serviços médicos",
      "3": "Cosméticos/beleza — mesmo canal (clínicas de estética)",
      "10": "Equipamentos médicos — complementar",
      "9": "Apps/plataformas — canal digital de saúde",
      "43": "Alimentação — nutrição",
      "45": "Serviços pessoais — bem-estar",
      "29": "Alimentos dietéticos — nutrição",
      "30": "Alimentos naturais — nutrição",
      "32": "Bebidas funcionais — nutrição esportiva"
    }
  }
}
```

Este JSON é salvo em `coleta/guia-adjacencia.json` e usado pela @peneira para descarte automático.


---

## Como a @peneira usa o guia

```
Para cada marca coletada:
  1. Se classe está em "aprovadas" → analisar normalmente (IA decide nível)
  2. Se classe está em "adjacentes" → analisar normalmente (IA decide nível)
  3. Se classe está em "sem_afinidade":
     a. Se nome é idêntico/quase idêntico à nossa marca → nível 2
     b. Senão → nível 3 automático (sem gastar IA)
```


---

## Impacto estimado

No caso Plenya, se o guia tivesse sido aplicado:

* 161 marcas coletadas
* \~20 marcas em classes sem afinidade descartadas automaticamente (SPLENDA cl.7, PLENART cl.19, SPLENDA cl.25, etc.)
* \~141 para a IA analisar (em vez de 161)
* Das 56 que passaram na peneira, \~33 delas não teriam passado → \~23 para cotejo


---

```yaml
metadata:
  version: 1.0.0
  squad: laudo-viabilidade
  usado_por: [peneira, laudo-preliminar]
  gerado_por: laudo (Mira) na Fase P
  tags: [adjacencia, classes, ncl, afinidade, peneira, filtro]
```


