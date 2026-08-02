# ---------- Build Stage ----------
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json .sequelizerc ./
COPY src ./src

RUN npm run build

# ---------- Production Stage ----------
FROM node:20-alpine AS production

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

# Migrations and seeders are plain CommonJS under src/sequelize and are never
# compiled into dist/, but ARCHITECTURE.md §8 requires them to be runnable via
# `docker compose exec backend npm run db:migrate`. They and .sequelizerc must
# therefore ship in the runtime image, and sequelize-cli is a runtime
# dependency rather than a devDependency for the same reason.
COPY --from=build /app/.sequelizerc ./.sequelizerc
COPY --from=build /app/src/sequelize ./src/sequelize

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 8080

CMD ["node", "dist/server.js"]
