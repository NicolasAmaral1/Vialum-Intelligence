FROM node:20-alpine

# Python + pip + dependências PDF/Drive
RUN apk add --no-cache python3 py3-pip gcc musl-dev freetype-dev
RUN pip3 install --break-system-packages reportlab google-api-python-client \
    google-auth-oauthlib google-auth-httplib2

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

RUN mkdir -p /outputs

EXPOSE 3000

CMD ["node", "server.js"]
