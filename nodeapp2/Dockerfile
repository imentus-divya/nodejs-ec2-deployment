FROM node:18-alpine

WORKDIR /app

COPY package.json package.json
COPY package-lock.json package-lock.json
COPY app.js app.js

RUN npm install

CMD ["node","app.js"]