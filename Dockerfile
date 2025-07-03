FROM node:20-slim
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

RUN npm install -g nodemon
COPY . .

ENV NODE_ENV=development
CMD ["npm","run","dev"]