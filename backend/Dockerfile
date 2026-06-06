FROM node:20-alpine

WORKDIR /app

# Install all dependencies (including devDeps — needed for tsx + seed)
COPY package*.json ./
RUN npm ci

# Generate Prisma client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy source (no tsc compile — tsx runs TypeScript directly, matching dev behavior)
COPY tsconfig.json ./
COPY src ./src/

# Create data directory for SQLite volume mount
RUN mkdir -p /app/data

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 4000

ENTRYPOINT ["/docker-entrypoint.sh"]
