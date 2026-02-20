FROM node:18-alpine

WORKDIR /app

COPY server.js /app/
COPY index.html /app/
COPY config.js /app/

EXPOSE 8000

CMD ["node", "server.js"]