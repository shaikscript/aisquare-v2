FROM node:20-bookworm-slim

# Install build toolchain only if native compilation fallback is needed for better-sqlite3
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Ensure runtime data & private upload directories exist
RUN mkdir -p /app/data /app/storage/resumes /app/storage/guidelines

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "start"]
