# Win Big: Track and Field — Container image
FROM node:18-alpine

WORKDIR /app

# Install serve globally for static file serving
RUN npm install -g serve

# Copy package files first for layer caching
COPY package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/

# Install all dependencies
RUN npm install --legacy-peer-deps

# Copy all source code and assets
COPY . .

# Remove ALL stale build artifacts and caches
RUN rm -rf packages/client/dist packages/shared/dist packages/server/dist \
    node_modules/.vite node_modules/.cache packages/client/node_modules/.vite \
    /tmp/* /root/.cache

# Build shared package (TypeScript)
RUN cd packages/shared && npx tsc

# Build client (Vite static bundle) — force clean build
RUN cd packages/client && NODE_ENV=production npx vite build 2>&1 && \
    echo "BUILD HASH:" && ls packages/client/dist/assets/index-*.js 2>/dev/null || ls dist/assets/index-*.js

# Data file lives inside the container at /app/data/
# Mount a volume to /app/data/ for persistence
RUN mkdir -p /app/data

# Expose ports: 3001 = API server, 8080 = client static
EXPOSE 3001 8080

# Start both servers. Server reads data from /app/data/data.json
ENV DATA_PATH=/app/data/data.json

CMD ["sh", "-c", "DATA_PATH=/app/data/data.json npx tsx packages/server/src/index.ts & serve packages/client/dist -l 8080 -s --no-clipboard & wait"]
