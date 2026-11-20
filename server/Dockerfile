FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --include=dev
COPY . .
RUN npx tsc
ENV PORT=7860
EXPOSE 7860
CMD ["node", "dist/server.js"]