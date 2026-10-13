FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY . .
RUN npm run build && mkdir -p /data/uploads && chown node:node /data/uploads
ENV NODE_ENV=production
USER node
EXPOSE 8080
CMD ["sh", "-c", "node run-migrations.js && node scripts/bootstrap.js && node app.js"]
