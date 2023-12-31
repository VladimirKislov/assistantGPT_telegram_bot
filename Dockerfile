FROM node:16-alpine

WORKDIR /app

COPY package*.json ./

RUN npm cach clean --force

RUN npm install -g npm@10.2.5

RUN npm ci

COPY . .

ENV PORT=1337

EXPOSE $PORT

CMD ["npm", "start"]
