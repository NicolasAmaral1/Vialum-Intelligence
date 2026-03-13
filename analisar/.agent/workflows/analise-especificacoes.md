
---

## description: Análise de especificações e colidências pré-registro (Estudo de concorrência)

Este workflow guia o processo de refinamento das especificações de uma marca antes do depósito no INPI, analisando o que deve ser incluído ou removido com base nos concorrentes.

### Passo 1: Definição do Escopo da Marca

Solicite ao usuário as seguintes informações:


1. **Nome Base da Marca** (como consta nas pastas de casos).
2. **Nome Final para Registro** (exatamente como deve ser depositado).
3. **Classe Nice (NCL)** pretendida.

### Passo 2: Localização e Análise de Concorrentes


1. Verifique se existe um diretório para a marca em `cases/[Cliente]/[Marca]`.
2. Procure por arquivos JSON ou TXT que contenham colidências e especificações de terceiros (ex: `inpi-raw-processed.json`).
3. **Se os dados não existirem**: Peça ao usuário para fornecer as especificações dos principais concorrentes ou o arquivo de colidências.

### Passo 3: Estudo de Especificações e Veredito

Com base na Classe NCL e nos dados dos concorrentes:


1. **Consulte obrigatoriamente** o arquivo correspondente em `know-how/ncl-classes/NCL-[XX].md` para obter a lista de itens pré-especificados.
2. **Renderize** as especificações pretendidas vs. as especificações dos concorrentes.
3. **Sugira** o que deve ser adicionado para maior proteção, **limitando-se estritamente aos itens presentes na lista pré-especificada da respectiva classe**.
4. **Sugira** o que deve ser removido ou alterado para evitar colidência direta ou indeferimento.
5. **Gere** um relatório/tabela comparativa com a recomendação final de redação.
6. **Veredito**: Informe se, na sua visão jurídica, as funções da categoria estão completas ou se há lacunas perigosas.


