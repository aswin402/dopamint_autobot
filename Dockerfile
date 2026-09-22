# Production Dockerfile for Render (Playwright + Chromium Worker & Hono API)
FROM node:20-bookworm-slim

# Install system dependencies required for headless/virtual-display Playwright Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    gnupg \
    ca-certificates \
    procps \
    xvfb \
    dbus-x11 \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    fonts-liberation \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package specifications
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm install

# Install Chromium browser binary for Playwright
RUN npx playwright install chromium

# Generate Prisma Client
RUN npx prisma generate

# Copy application source code and entrypoint
COPY . .
RUN chmod +x /app/docker-entrypoint.sh

ENV PORT=4000
ENV NODE_ENV=production
EXPOSE 4000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "./node_modules/.bin/jiti", "backend/src/server.ts"]
