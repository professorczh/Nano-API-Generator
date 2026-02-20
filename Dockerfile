FROM node:18-alpine

WORKDIR /app

COPY package.json /app/
RUN npm install

COPY server.js /app/
COPY index.html /app/
COPY config.js /app/

EXPOSE 8000

CMD ["node", "server.js"]