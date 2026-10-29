# Zero-dependency Node app: there is nothing to install at build time,
# but the npm step keeps the Dockerfile realistic for the platform's
# build → test → push pipeline.
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production \
    PORT=5000

COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY . .

# Drop privileges; the app needs no writes to the filesystem.
USER node

EXPOSE 5000

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5000/health >/dev/null 2>&1 || exit 1

CMD ["node", "index.js"]
