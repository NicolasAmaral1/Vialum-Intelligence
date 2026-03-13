FROM node:20-alpine

WORKDIR /app

# Copy package.json and package-lock.json first
COPY package.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY . .

# Expose port
EXPOSE 3000

# Start server
CMD ["npm", "start"]
