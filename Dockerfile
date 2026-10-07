# Build stage: compile the React app and the API server.
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY . .
RUN npm run build:all

# Runtime stage: production dependencies only.
FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
USER node
# Cloud Run injects PORT (default 8080).
EXPOSE 8080
CMD ["node", "dist-server/index.js"]
