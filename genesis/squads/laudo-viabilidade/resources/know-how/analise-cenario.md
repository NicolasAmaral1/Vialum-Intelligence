# Análise de Cenário — Metodologia

> Fase intermediária entre Coleta (Fase 1) e Peneira (Fase 2).
> Objetivo: entender como o INPI trata os elementos da marca ANTES de filtrar.

---

## Princípio

A peneira não deve operar com regras cegas sobre o que é genérico ou distintivo. Ela deve **descobrir** isso analisando os dados reais do INPI para aquele caso específico.

Antes de classificar marcas em 3 níveis, precisamos responder:
1. Quais elementos da nossa marca o INPI trata como GENÉRICOS nessas classes?
2. Quais elementos o INPI trata como DISTINTIVOS?
3. Qual a densidade marcária por elemento por classe?
4. Quais padrões de indeferimento existem?

---

## Peso das Decisões INPI

Nem toda marca no banco do INPI tem o mesmo peso como precedente. Apenas **decisões julgadas** contam.

| Situação | Peso | Conta? | Motivo |
|----------|------|--------|--------|
| Indeferimento mantido em recurso | MÁXIMO | SIM | INPI + Tribunal confirmaram. Jurisprudência firme. |
| Decisão em recurso (qualquer resultado) | ALTO | SIM | Segunda instância analisou — decisão mais robusta |
| Indeferido (sem recurso / arquivado sem recurso) | MÉDIO | SIM | INPI decidiu mas ninguém contestou |
| Em vigor (registro concedido) | NORMAL | SIM | Passou pelo exame de mérito — INPI aceitou |
| Aguardando exame / em análise / sobrestado | ZERO | NÃO | Não foi julgada. Não é precedente. |
| Arquivada por desistência / falta de pagamento | ZERO | NÃO | Morreu por razão administrativa, não por mérito |
| Extinta sem indeferimento prévio | CONTEXTO | PARCIAL | Pode indicar abandono, não decisão de mérito |

### Regra: só decisões de mérito contam como precedente.

---

## Análise de Densidade Marcária

Para cada elemento nominal da marca em análise, calcular por classe.

### Duas camadas obrigatórias

**Camada 1 — Densidade bruta:** quantas marcas com esse elemento existem na classe?

**Camada 2 — Cruzamento com contexto da atividade:** dessas, quantas são do MESMO ramo de atividade do cliente?

A Camada 2 é CRÍTICA. Um elemento pode ter densidade ALTA no geral (ex: BABY com 112 marcas em vigor na cl.41) mas ser PRATICAMENTE INEXISTENTE no segmento específico do cliente (ex: BABY em contexto de corrida adulta = 0 marcas).

### Interpretação

- **Densidade ALTA geral + ALTA no contexto** → Elemento GENÉRICO no segmento. INPI permite coexistência.
- **Densidade ALTA geral + BAIXA no contexto** → Elemento DISTINTIVO no segmento. É genérico em outro universo (ex: produtos infantis), mas raro e diferenciador no universo do cliente.
- **Densidade BAIXA geral** → Elemento DISTINTIVO em qualquer contexto.
- **Indeferimentos mantidos em recurso** → Peso dobrado. Se o Tribunal confirmou que "X BABY" indefere por colidir com "Y BABY", BABY é definitivamente distintivo naquela classe.

---

## Mapa de Elementos (Output)

O output desta fase é o arquivo `coleta/mapa-elementos.json`. Contém:

1. Cada elemento da marca com seu tipo (GENÉRICO / DISTINTIVO NO CONTEXTO)
2. Densidade por classe com cruzamento de contexto
3. Regras derivadas para a peneira

---

## Como o Cenário alimenta a Peneira

1. Peneira lê `coleta/mapa-elementos.json` ANTES de classificar
2. Para cada marca coletada:
   - Se compartilha elemento **DISTINTIVO no contexto** em classe aprovada → nível 2 mínimo
   - Se compartilha elemento **DISTINTIVO no contexto** em classe adjacente + contexto esportivo no nome → nível 2
   - Se compartilha apenas elemento **GENÉRICO** → nível 3 para vivas em vigor, nível 2 para precedentes indeferidos
   - Se compartilha **ambos** → nível 1
3. A peneira não precisa mais adivinhar o que é genérico ou distintivo

---

## Quando a Análise de Cenário é dispensável

- Marca totalmente FANTASIOSA (ex: "XYPLEX") → não tem elementos decomponíveis
- Volume de coleta < 30 marcas → cenário é trivial, peneira analisa todas

---

```yaml
metadata:
  version: 1.0.0
  squad: laudo-viabilidade
  usado_por: [laudo-cenario, laudo-peneira]
  gerado_por: Mira na Fase 1.5
  tags: [cenario, densidade, elementos, distintivo, generico, precedentes, peneira]
```
