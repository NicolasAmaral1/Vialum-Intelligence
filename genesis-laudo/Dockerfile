FROM node:20-alpine

WORKDIR /app

# Dependências de sistema
RUN apk add --no-cache python3 py3-pip gcc musl-dev python3-dev

# Pacotes Python para os scripts do squad laudo-viabilidade
# (processar_inpi.py usa stdlib; gerar_laudo + gerar_docx + drive precisam desses)
RUN pip3 install --no-cache-dir --break-system-packages \
    reportlab \
    "python-docx" \
    google-auth-oauthlib \
    google-auth-httplib2 \
    google-api-python-client

# Claude Code CLI — instalado globalmente (acessível por todos os usuários)
RUN npm install -g @anthropic-ai/claude-code

COPY app/package.json ./
RUN npm install --omit=dev

COPY app/ ./

# Garantir que o usuário node (uid 1000, já existe na imagem) pode ler os arquivos da app.
# --dangerously-skip-permissions é bloqueado quando o processo roda como root,
# por isso o container deve rodar como usuário não-root.
RUN chown -R node:node /app

USER node

EXPOSE 3001
CMD ["node", "server.js"]
