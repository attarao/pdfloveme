FROM node:18-slim

# Install libreoffice for conversions (optional heavy package)
RUN apt-get update && apt-get install -y libreoffice --no-install-recommends && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json .
RUN npm install --production
COPY . .
EXPOSE 4000
CMD ["node","server.js"]
