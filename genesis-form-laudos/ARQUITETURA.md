# Arquitetura do `genesis-form-laudos`

## Visão geral

O `genesis-form-laudos` é um serviço web simples para intake e acompanhamento de pedidos de laudo. Ele publica uma interface em:

- `https://laudos.luminai.ia.br`

O papel dele não é gerar o laudo nem orquestrar um workflow complexo. Ele funciona como uma camada fina entre o usuário e o ClickUp:

- cria novos cards na fila de laudos
- lista os cards existentes
- permite mover cards concluídos para o status `cpf`

## Stack

- Node.js 20
- Express
- `axios` para chamadas HTTP
- `cors`
- frontend estático em HTML/CSS/JS
- Docker + Traefik para deploy

Referências:

- [server.js](/Users/nicolasamaral/Vialum-Intelligence/genesis-form-laudos/server.js)
- [package.json](/Users/nicolasamaral/Vialum-Intelligence/genesis-form-laudos/package.json)
- [Dockerfile](/Users/nicolasamaral/Vialum-Intelligence/genesis-form-laudos/Dockerfile)
- [docker-compose.yml](/Users/nicolasamaral/Vialum-Intelligence/genesis-form-laudos/docker-compose.yml)

## Arquitetura lógica

Em termos práticos, a aplicação tem só duas camadas:

```text
Browser
  -> Express
    -> ClickUp API
```

Não há:

- PostgreSQL
- fila assíncrona
- worker separado
- integração com `claude` CLI
- processamento local de documentos

## Camada web

O Express faz duas coisas:

- serve os arquivos estáticos da pasta `public/`
- expõe endpoints REST para operar sobre o ClickUp

O servidor sobe na porta `3000`.

Referência:

- [server.js](/Users/nicolasamaral/Vialum-Intelligence/genesis-form-laudos/server.js)

## Frontend

O frontend é estático e baseado em duas páginas:

- [index.html](/Users/nicolasamaral/Vialum-Intelligence/genesis-form-laudos/public/index.html): formulário de novo pedido
- [acompanhamento.html](/Users/nicolasamaral/Vialum-Intelligence/genesis-form-laudos/public/acompanhamento.html): listagem e acompanhamento dos laudos

### 1. Novo pedido

A tela principal coleta:

- nome da marca
- nome do cliente
- atividade
- quem indicou

Ao enviar, ela chama `POST /api/laudos`, e o backend cria um card no ClickUp com status inicial `para fazer`.

### 2. Acompanhamento

A segunda tela chama `GET /api/laudos`, mostra os cards existentes e ordena por prioridade de status. Quando um card está em `feito`, a UI exibe o botão `ENTREGUE`, que dispara `PATCH /api/laudos/:id/entregue` para mover o card para `cpf`.

## Backend e endpoints

### `POST /api/laudos`

Cria um novo card na lista do ClickUp.

Payload esperado:

- `nomeMarca`
- `nomeCliente`
- `atividade`
- `indicacao` opcional

O backend transforma isso em:

- `name`: nome da marca
- `description`: texto formatado com cliente, atividade e indicação
- `status`: `para fazer`

### `GET /api/laudos`

Busca os cards da lista no ClickUp com `include_closed=true`, mapeia o payload para um formato simplificado e ordena por prioridade local:

- `feito`
- `para fazer`
- `cpf`
- `em processo`

Se houver empate, usa a data de criação, com os mais recentes primeiro.

### `PATCH /api/laudos/:id/entregue`

Atualiza diretamente o card no ClickUp para o status `cpf`.

## Integração com ClickUp

Toda a lógica de negócio persistida está no ClickUp. O serviço depende de:

- `CLICKUP_API_TOKEN`
- lista fixa `901324787605`

Esse serviço usa o ClickUp como banco operacional de fato. O app apenas traduz ações da UI para chamadas REST.

Pontos importantes da integração:

- autenticação por header `Authorization`
- criação de task via `POST /list/{LIST_ID}/task`
- leitura de tasks via `GET /list/{LIST_ID}/task`
- atualização de status via `PUT /task/{id}`

Referência:

- [server.js](/Users/nicolasamaral/Vialum-Intelligence/genesis-form-laudos/server.js)

## Estado e persistência

O serviço é stateless.

Ele não persiste nada localmente além dos próprios arquivos da aplicação. Isso significa:

- não há banco de dados local
- não há cache de laudos
- cada carregamento consulta o ClickUp de novo
- reinício do container não perde estado funcional, desde que o token do ClickUp esteja presente

## Deploy

### Container

O container é simples:

- imagem base `node:20-alpine`
- `npm install`
- `npm start`

Não há processos auxiliares nem múltiplos serviços no compose.

### Porta

Internamente a aplicação roda em `3000`.

Também existe exposição direta:

- `3010:3000`

Além disso, o serviço é publicado via Traefik.

### Traefik

O `docker-compose.yml` define roteamento por host:

- `Host(laudos.luminai.ia.br)`

Com:

- entrypoint `websecure`
- TLS via `certresolver=le`
- rede `proxy`

Referência:

- [docker-compose.yml](/Users/nicolasamaral/Vialum-Intelligence/genesis-form-laudos/docker-compose.yml)

## Decisões arquiteturais implícitas

As decisões mais claras no código são:

- frontend simples e estático para reduzir complexidade operacional
- backend fino, sem domínio local sofisticado
- ClickUp como sistema central de estado
- deploy em container único
- ausência de banco local para manter o serviço leve

## Limitações atuais

- A aplicação depende totalmente da disponibilidade do ClickUp.
- Não existe autenticação própria no app.
- A lista do ClickUp está hardcoded no backend.
- Não há validação forte de domínio além dos campos obrigatórios.
- Não há auditoria local de ações.
- Não há separação entre camadas de API, serviço e integração; tudo está concentrado em `server.js`.

## Resumo operacional

Esse projeto é melhor entendido como um portal operacional leve:

```text
Usuário abre laudos.luminai.ia.br
  -> preenche formulário ou acompanha pedidos
  -> Express recebe ação
  -> Express chama ClickUp
  -> ClickUp vira a fonte oficial do status
```

## Relação com o `genesis-laudo`

Este projeto é diferente do `genesis-laudo`.

Diferença principal:

- `genesis-form-laudos`: portal de entrada/acompanhamento em `laudos.luminai.ia.br`
- `genesis-laudo`: dashboard HITL e orquestração de workflow em `api.luminai.ia.br/laudo`

Ou seja, o primeiro é uma camada leve sobre o ClickUp; o segundo é uma camada de operação do fluxo interno de análise.
