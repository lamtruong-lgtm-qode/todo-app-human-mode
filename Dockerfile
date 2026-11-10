FROM node:20-alpine
WORKDIR /app
COPY package.json ./
COPY src ./src
COPY public ./public
ENV PORT=3000
EXPOSE 3000
USER node
CMD ["node", "src/server.js"]
