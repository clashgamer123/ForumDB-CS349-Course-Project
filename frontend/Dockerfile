FROM node:20-alpine

WORKDIR /app

# Install deps first (cached layer)
COPY package.json package-lock.json* ./
RUN npm install

# Copy source (overridden by bind mount in dev)
COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
