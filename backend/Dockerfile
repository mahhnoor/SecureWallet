FROM node:20-slim

ENV NODE_ENV=production
WORKDIR /app

# Install production dependencies first so Docker can cache this layer.
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node . .

# SEC: run as the unprivileged "node" user, not root.
USER node

EXPOSE 4000

# Seed the demo users (optional, idempotent), then start the API.
# "exec" lets Docker's stop signal reach Node directly for a clean shutdown.
CMD ["sh", "-c", "if [ \"$SEED_DEMO_DATA\" = \"true\" ]; then node src/db/seed.js; fi; exec node src/server.js"]
