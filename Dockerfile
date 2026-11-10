# API de PesoXPeso. Se construye desde la raíz del monorepo:  docker build -t pesoxpeso-api .
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY web/package.json web/
RUN npm ci --workspace backend
COPY backend backend
RUN npm run build -w backend

FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY web/package.json web/
RUN npm ci --workspace backend --omit=dev && npm cache clean --force
COPY --from=build /app/backend/dist backend/dist
COPY backend/migrations backend/migrations
WORKDIR /app/backend
USER node
EXPOSE 3000
# Aplica las migraciones pendientes y arranca la API.
CMD ["sh", "-c", "node dist/migrate.js && node dist/server.js"]
