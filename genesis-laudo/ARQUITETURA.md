# Arquitetura do `genesis-laudo`

## Visão geral

O `genesis-laudo` é um serviço web standalone que expõe o squad `laudo-viabilidade` por meio de um dashboard HITL. Ele não reimplementa a inteligência do fluxo de laudos; ele orquestra a execução do `claude` CLI, persiste estado operacional em PostgreSQL e oferece uma interface web para acompanhamento, checkpoints humanos e geração final dos documentos.

Na implementação atual, o endpoint público previsto é:

- `https://api.luminai.ia.br/laudo/`

Não encontrei evidência no código local de uso de `laudos.luminai.ia.br`. O roteamento configurado em Compose/Traefik usa `api.luminai.ia.br` com `PathPrefix(/laudo)`.

## Componentes principais

### 1. Camada web

Stack:

- Node.js 20
- Express
- EJS
- SSE para progresso assíncrono de geração

O servidor sobe na porta `3001` e concentra duas áreas principais:

- dashboard: fila ClickUp + análises ativas/concluídas
- detalhe da análise: stepper por fase, checkpoints, submissão de INPI e geração final

Referências:

- [server.js](/Users/nicolasamaral/Vialum-Intelligence/genesis-laudo/app/server.js)
- [dashboard.js](/Users/nicolasamaral/Vialum-Intelligence/genesis-laudo/app/routes/dashboard.js)
- [analise.js](/Users/nicolasamaral/Vialum-Intelligence/genesis-laudo/app/routes/analise.js)

### 2. Orquestração do workflow

O serviço delega a execução do fluxo ao agente `@laudo`, via subprocesso:

```bash
claude -p "@laudo *nova-analise {task_id}" --dangerously-skip-permissions
claude -p "@laudo *inpi {task_id}" --dangerously-skip-permissions
claude -p "@laudo *gerar {task_id}" --dangerously-skip-permissions
```

Esse CLI roda no workspace configurado por `WORKSPACE_PATH`, que precisa conter o repositório `genesis` e acesso ao squad `squads/laudo-viabilidade/`.

Referência:

- [claude.js](/Users/nicolasamaral/Vialum-Intelligence/genesis-laudo/app/services/claude.js)

### 3. Banco de dados

O PostgreSQL é dedicado ao serviço e tem três responsabilidades:

- registrar a análise corrente por `task_id`
- manter trilha de eventos append-only
- rastrear cada execução do CLI

Tabelas:

- `analyses`: estado atual da análise, fase, checkpoints, pasta, outputs e link do Drive
- `analysis_events`: log imutável de eventos operacionais
- `cli_executions`: telemetria de subprocessos `claude`

Referências:

- [001_init.sql](/Users/nicolasamaral/Vialum-Intelligence/genesis-laudo/migrations/001_init.sql)
- [db.js](/Users/nicolasamaral/Vialum-Intelligence/genesis-laudo/app/services/db.js)

### 4. Integrações externas

O sistema conversa com quatro superfícies externas:

- ClickUp REST API v2: fila, leitura de card, comentário e mudança de status
- Claude Code CLI: execução do workflow
- Google Drive: upload dos arquivos finais, executado pelo próprio squad
- Scripts Python do squad: principalmente `processar_inpi.py`, além dos geradores de PDF/DOCX

Referências:

- [clickup.js](/Users/nicolasamaral/Vialum-Intelligence/genesis-laudo/app/services/clickup.js)
- [nova-analise.md](/Users/nicolasamaral/Vialum-Intelligence/genesis/squads/laudo-viabilidade/workflows/nova-analise.md)
- [squad.yaml](/Users/nicolasamaral/Vialum-Intelligence/genesis/squads/laudo-viabilidade/squad.yaml)

## Fluxo funcional

### Entrada

O dashboard consulta o ClickUp na lista configurada e mostra cards em status `para fazer`. Quando o usuário inicia uma análise:

1. o serviço cria ou reaproveita o registro em `analyses`
2. registra evento inicial
3. move o card para `em processo`
4. dispara `@laudo *nova-analise {task_id}` em background
5. redireciona o usuário imediatamente para a tela da análise

### Fase 1 e Fase 2

O workflow `*nova-analise` executa:

1. coleta de dados do card
2. criação da pasta `laudos/{cliente}/{marca}/`
3. geração do plano preliminar em Markdown
4. parada obrigatória no Checkpoint 1

Quando essa etapa termina com sucesso, o backend salva o caminho da pasta no banco.

### Checkpoint 1

O Checkpoint 1 é bloqueante. O backend só permite aprovação se a análise estiver na fase `2`. Ao aprovar:

- `checkpoint_1` vira `aprovado`
- a `fase` vai para `3`
- um evento `checkpoint_approved` é persistido

### Entrada INPI

Na fase `3`, o usuário cola o texto bruto do INPI. O sistema:

1. salva `inpi-raw.txt` dentro da pasta da análise
2. executa `processar_inpi.py`
3. registra evento `inpi_submitted`
4. executa `@laudo *inpi {task_id}`

Essa chamada preenche a parte 2 do plano de análise.

### Checkpoint 2

O Checkpoint 2 também é bloqueante. Só é aceito se a análise estiver na fase `3`. Ao aprovar:

- `checkpoint_2` vira `aprovado`
- a `fase` vai para `4`
- novo evento `checkpoint_approved` é gravado

### Geração final

Na fase `4`, o endpoint de geração:

1. valida que os dois checkpoints foram aprovados
2. evita reprocessamento se `output_pdf` já existir
3. executa `@laudo *gerar {task_id}`
4. acompanha stdout via SSE para atualizar progresso na UI
5. detecta PDF, DOCX e URL do Drive
6. persiste os outputs no banco
7. comenta no card do ClickUp e move o status para `feito`

## Modelo de execução

### Processamento assíncrono

O serviço usa `setImmediate(...)` para disparar execuções longas sem bloquear a resposta HTTP. Isso aparece em três pontos:

- início da análise
- processamento do INPI
- geração final

Não existe fila externa, worker separado ou broker. O processo web faz tudo:

- recebe HTTP
- dispara subprocessos locais
- persiste estado
- emite progresso em memória

Isso simplifica o MVP, mas cria acoplamento forte entre UI, orquestração e execução.

### SSE em memória

O progresso da geração final usa `EventEmitter` em memória, chaveado por `task_id`. Isso significa:

- funciona bem em instância única
- não compartilha eventos entre múltiplas réplicas
- perde listeners/eventos se o processo reiniciar

Para o estágio atual, isso é coerente com o deploy single-instance em VPS.

## Modelo de dados

### `analyses`

Representa a visão corrente da análise.

Campos mais relevantes:

- `task_id`: chave funcional vinda do ClickUp
- `fase`: enum implícito de `0` a `4`
- `checkpoint_1`, `checkpoint_2`: estados dos gates humanos
- `pasta`: diretório físico em `/root/laudos/...`
- `output_pdf`, `output_docx`, `drive_url`: saídas finais

### `analysis_events`

Tabela append-only para auditoria operacional. Eventos observados no código:

- `started`
- `completed`
- `checkpoint_approved`
- `error`
- `cli_called`
- `inpi_submitted`

### `cli_executions`

Permite diagnosticar cada chamada ao `claude`:

- comando
- argumentos
- status
- stdout
- stderr
- exit code
- timestamps

## Deploy e infraestrutura

### Containers

O `genesis-laudo.yml` define dois serviços:

- `genesis-laudo`: aplicação Node.js
- `genesis-laudo-db`: PostgreSQL 16 Alpine

### Redes

Há duas redes:

- `proxy`: externa, para Traefik
- `laudo-internal`: bridge privada entre app e banco

O banco não é exposto externamente.

### Volumes

O container principal monta:

- `/root/genesis:/root/genesis`: workspace aiOS com squads, AGENTS e scripts
- `/root/laudos:/root/laudos`: arquivos gerados
- `/root/.claude:/home/node/.claude:ro`: autenticação do Claude CLI

O banco usa o volume persistente:

- `genesis-laudo-db-data`

### Roteamento HTTP

Traefik publica o serviço com:

- `Host(api.luminai.ia.br)`
- `PathPrefix(/laudo)`
- TLS com `certresolver=le`

A app interna responde na porta `3001`.

Referências:

- [genesis-laudo.yml](/Users/nicolasamaral/Vialum-Intelligence/genesis-laudo/genesis-laudo.yml)
- [Dockerfile](/Users/nicolasamaral/Vialum-Intelligence/genesis-laudo/Dockerfile)

## Dependências do squad

O `genesis-laudo` depende da presença do squad `laudo-viabilidade`, que contém:

- workflow `nova-analise`
- tasks de monitoramento, coleta, preliminar, INPI e geração
- scripts Python de processamento e geração de documentos
- credenciais do Google Drive
- assets e know-how de NCL

Ou seja: a aplicação web é a casca operacional; a lógica de domínio de laudos continua majoritariamente dentro do squad.

Referências:

- [squad.yaml](/Users/nicolasamaral/Vialum-Intelligence/genesis/squads/laudo-viabilidade/squad.yaml)
- [nova-analise.md](/Users/nicolasamaral/Vialum-Intelligence/genesis/squads/laudo-viabilidade/workflows/nova-analise.md)

## Decisões arquiteturais implícitas

Pelo código atual, as decisões mais importantes são:

- CLI-first: o backend orquestra o `claude`, não reimplementa o fluxo
- estado persistido em banco: a análise não depende só do filesystem
- filesystem compartilhado: app e squad operam sobre a mesma pasta de laudos
- HITL obrigatório: o fluxo foi desenhado para parar em checkpoints explícitos
- single instance: SSE em memória e ausência de job queue apontam para uma instância única

## Riscos e limitações atuais

- O servidor web acumula UI, orquestração e execução pesada no mesmo processo.
- `setImmediate` não oferece durabilidade; reinício do processo pode interromper execuções em andamento.
- SSE com `EventEmitter` em memória não escala horizontalmente.
- O timeout do CLI está fixado em 5 minutos, o que pode ser curto para fluxos maiores.
- A detecção de sucesso da geração final depende parcialmente de parsing de stdout e presença de arquivos.
- A consistência entre banco, filesystem, ClickUp e Drive é eventual, não transacional.

## Resumo operacional

Em termos práticos, a arquitetura é esta:

```text
Browser
  -> Express/EJS (genesis-laudo)
    -> PostgreSQL (estado e auditoria)
    -> ClickUp API (fila e status)
    -> Claude CLI (orquestra o squad)
      -> squad laudo-viabilidade
        -> scripts Python
        -> filesystem /root/laudos
        -> Google Drive
```

## Observação sobre a VPS

A inspeção direta da máquina `vps-nova` ficou bloqueada pelo sandbox desta sessão, então este documento foi montado a partir do código local e da documentação de deploy existente no workspace. A estrutura de execução descrita aqui está alinhada com o `docker-compose`, o `Dockerfile`, as rotas e os serviços encontrados localmente.
