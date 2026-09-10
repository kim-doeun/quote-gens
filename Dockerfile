# ---- deps: install server dependencies (build tools only needed here) ----
FROM node:20-alpine AS deps
RUN apk add --no-cache python3 make g++
WORKDIR /app/server
COPY server/package.json ./
RUN npm install --omit=dev

# ---- runtime image ----
FROM node:20-alpine
WORKDIR /app

RUN addgroup -S app && adduser -S app -G app \
    && mkdir -p /data && chown -R app:app /data

COPY --from=deps /app/server/node_modules ./server/node_modules
COPY server ./server
COPY css ./css
COPY js ./js
COPY images ./images
COPY .tables ./.tables
COPY index.html customers.html labor-rates.html products.html quote-detail.html quote-new.html quotes.html sales-reps.html ./

ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/data/app.db

EXPOSE 3000
VOLUME ["/data"]
USER app

CMD ["node", "server/index.js"]
