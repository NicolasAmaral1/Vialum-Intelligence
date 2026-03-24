FROM node:20-alpine AS builder

# Build main app
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc

# Build MCP server
WORKDIR /app/mcp-aprovacao
COPY mcp-aprovacao/package*.json ./
RUN npm install
COPY mcp-aprovacao/tsconfig.json ./
COPY mcp-aprovacao/src ./src
RUN npx tsc

# Runtime
FROM node:20-alpine
RUN apk add --no-cache python3 py3-pip bash git
RUN npm install -g @anthropic-ai/claude-code
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/mcp-aprovacao/dist ./mcp-aprovacao/dist
COPY --from=builder /app/mcp-aprovacao/node_modules ./mcp-aprovacao/node_modules
COPY hooks ./hooks
COPY mcp-config.json ./
COPY package*.json ./
EXPOSE 3005
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
