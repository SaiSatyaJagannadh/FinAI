FROM node:20-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements-deploy.txt ./
RUN pip3 install --no-cache-dir --break-system-packages -r requirements-deploy.txt

COPY server/package*.json server/
RUN cd server && npm ci --omit=dev

COPY client/package*.json client/
RUN cd client && npm ci

COPY . .
RUN cd client && npm run build

ENV NODE_ENV=production \
    PYTHON_BIN=python3 \
    PORT=5000
EXPOSE 5000

CMD ["node", "server/server.js"]
