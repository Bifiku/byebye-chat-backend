# =========================
# Stage 1: development
# =========================
FROM node:20 AS dev

WORKDIR /app

COPY package*.json ./
COPY tsconfig*.json ./
COPY docs ./docs
RUN npm install

# Не копируем src — будет volume-монтаж из compose
CMD ["npm", "run", "dev"]

# =========================
# Stage 2: production
# =========================
FROM node:20 AS prod

WORKDIR /app

COPY package*.json ./
COPY tsconfig*.json ./
COPY docs ./docs
RUN npm ci --omit=dev

# теперь копируем весь код (src, dist, env и т.д.)
COPY . .

RUN npm run build

CMD ["node", "dist/index.js"]
