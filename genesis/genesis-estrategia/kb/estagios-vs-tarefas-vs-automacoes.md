# Base de Conhecimento: Estágios vs Tarefas vs Automações em CRM

> Fonte: Pesquisa consolidada de Pipedrive, HubSpot, Salesforce, IBM e especialistas em CRM.


---

## 1. As Três Camadas de um Pipeline

Um pipeline de vendas opera com três camadas distintas. Confundir essas camadas é o erro mais comum em CRMs mal configurados.

### Estágio (Stage) — O "ONDE"

O estágio representa a **posição** do deal na jornada. É o marco de comprometimento do prospect. Pense como uma **estação de metrô**: o deal está ali, parado, esperando algo acontecer para se mover.

**Regras de Ouro:**

* Nomeie no **particípio passado** ou como estado: "Reunião Realizada", "Proposta Enviada", "Contato Feito" — nunca como ação.
* Cada estágio precisa de **critério de entrada** (o que trouxe o deal até aqui?) e **critério de saída** (o que o move para o próximo?).
* Estágios devem representar **marcos de comprometimento crescente** do prospect.
* O deal deve "morar" ali por algum tempo. Se a permanência média é zero, provavelmente é uma tarefa, não um estágio.
* Nunca coloque mais de 7-9 estágios por pipeline. Menos é mais.

### Tarefa (Task/Activity) — O "O QUÊ"

A tarefa é a **ação específica** que o vendedor executa dentro de um estágio para mover o deal adiante. É o trabalho braçal.

**Regras de Ouro:**

* Sempre use **verbos no infinitivo**: "Enviar laudo", "Ligar para prospect", "Criar grupo WhatsApp".
* Toda tarefa tem um **responsável** e um **prazo**.
* Cada deal ativo deve ter **pelo menos uma tarefa futura agendada**. Se não tem, está abandonado.
* Tarefas NÃO são estágios. "Criar grupo no WhatsApp" é uma tarefa, não um lugar onde o deal fica.

### Automação (Automation) — O "COMO"

A automação é o **mecanismo tecnológico** que executa ou cria tarefas automaticamente, disparado por gatilhos (triggers).

**Regras de Ouro:**

* Toda automação segue a lógica **SE (trigger) → ENTÃO (ação)**.
* Triggers comuns: deal criado, deal movido de estágio, campo atualizado, tempo decorrido.
* Ações comuns: criar tarefa, enviar email, atualizar campo, mover deal, notificar equipe.
* **Não automatize tudo.** Mantenha o toque humano nas interações de alto valor (reuniões, negociações).
* Comece simples: automatize primeiro tarefas repetitivas e de baixo risco.


---

## 2. Anatomia de um Estágio Bem Projetado

```
┌─────────────────────────────────────────────────┐
│  ESTÁGIO: Reunião Realizada                     │
├─────────────────────────────────────────────────┤
│  Critério de Entrada: Reunião aconteceu         │
│  Critério de Saída: Lead classificado           │
│  Probabilidade: 50%                             │
│  Tempo de Estagnação: 1 dia                     │
├─────────────────────────────────────────────────┤
│  TAREFAS DENTRO DESTE ESTÁGIO:                  │
│  ☐ Classificar lead (imediato)                  │
│  ☐ Criar grupo WhatsApp (até 1h)                │
│  ☐ Enviar material de boas-vindas (até 1h)      │
│  ☐ Seguir Instagram da agência (até 1h)         │
├─────────────────────────────────────────────────┤
│  AUTOMAÇÕES QUE DISPARAM AQUI:                  │
│  ⚡ AUTO-04: Criar tarefas automaticamente      │
│  ⚡ AUTO-05/06: Mover deal baseado em campo     │
└─────────────────────────────────────────────────┘
```


---

## 3. Erros Comuns a Evitar

| Erro | Por que é prejudicial | Como corrigir |
|----|----|----|
| Misturar tarefas com estágios | Pipeline fica poluído, métricas erradas | Se o deal não "mora" ali, é tarefa |
| Probabilidades em 100% | Impossibilita forecast | Definir probabilidades realistas e crescentes |
| Sem tempo de estagnação | Deals apodrecem sem alerta | Configurar "deal rotting" |
| Funil único para jornadas distintas | Métricas embaralhadas | Separar em pipelines com jornadas diferentes |
| Sem critérios de entrada/saída | Deals avançam por "feeling" | Definir critérios objetivos por estágio |
| Automação excessiva | Perde toque humano | Automatizar só o repetitivo |


---

## 4. Princípios Pipedrive Específicos

* **Activity-Based Selling:** O Pipedrive é projetado em torno de "atividades" (ligações, reuniões, e-mails). O foco deve ser nas ações, não nos resultados.
* **Deal Rotting:** Configure para que deals que ficam parados por muito tempo em um estágio sejam sinalizados como "apodrecendo".
* **Múltiplos Pipelines:** Use apenas quando as jornadas são genuinamente diferentes (ex: prospecção presencial vs. inbound).
* **Campos Customizados:** São a espinha dorsal da automação. Sem campos bem definidos, automações não funcionam.
* **Nomeie estágios na perspectiva do vendedor:** O que EU já fiz. "Contato Feito" e não "Fazer Contato".


