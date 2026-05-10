FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci || npm install
COPY . .
EXPOSE 5173
# Expose Vite dev server to host machine
CMD ["npm", "run", "dev", "--", "--host"]
