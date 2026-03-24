FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* /app/
RUN npm install

COPY . /app/

EXPOSE 8000

CMD ["npx", "nodemon", "--legacy-watch", "server.js"]
