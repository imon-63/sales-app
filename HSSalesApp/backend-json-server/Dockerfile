FROM node:20-alpine

WORKDIR /app

# Install dependencies first (layer-cached unless package.json changes)
COPY package.json package-lock.json* ./
RUN npm install --production

# Copy application code (excluding db.json — it's bind-mounted at runtime)
COPY . .

EXPOSE 3001

CMD ["node", "server.js"]
