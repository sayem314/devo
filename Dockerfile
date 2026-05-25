FROM node:lts-slim AS deps

WORKDIR /app
COPY package.json ./
RUN npm install --ignore-scripts --min-release-age=3 --no-audit --no-fund

FROM deps AS build

WORKDIR /app
COPY . .
RUN npm run build
RUN npm prune --omit=dev --ignore-scripts --no-audit --no-fund

FROM node:lts-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production \
  HOST=0.0.0.0 \
  PORT=3000 \
  DEVO_DATA_DIR=/data

COPY --from=build /app/build ./build
COPY --from=build /app/src/lib/server/db/migrations ./build/server/chunks/migrations
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./

VOLUME ["/data"]
EXPOSE 3000

CMD ["node", "build"]
