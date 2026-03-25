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

# Create non-root user for Claude CLI (--dangerously-skip-permissions requires non-root)
RUN adduser -D -h /home/vialum vialum

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/mcp-aprovacao/dist ./mcp-aprovacao/dist
COPY --from=builder /app/mcp-aprovacao/node_modules ./mcp-aprovacao/node_modules
COPY hooks ./hooks
COPY mcp-config.json ./

# Make hooks executable
RUN chmod +x hooks/*.cjs

COPY package*.json ./
RUN chown -R vialum:vialum /app

EXPOSE 3005

# Prisma migrate runs as root, then app runs as non-root (required for Claude CLI --dangerously-skip-permissions)
CMD ["sh", "-c", "npx prisma migrate deploy && su -s /bin/sh vialum -c 'HOME=/home/vialum node /app/dist/index.js'"]
