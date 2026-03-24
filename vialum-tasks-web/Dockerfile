FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN mkdir -p public
ENV NEXT_PUBLIC_API_URL=https://api.luminai.ia.br
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3006
ENV PORT=3006
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
