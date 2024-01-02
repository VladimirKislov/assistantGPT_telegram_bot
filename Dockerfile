// FROM node:16-alpine
FROM node:lts-alpine as Build

// WORKDIR /app
WORKDIR /tmp

COPY package*.json ./

RUN npm cach clean --force

RUN npm ci

COPY . .

//ENV PORT=3000

//EXPOSE $PORT

CMD ["npm", "start"]
