# Použijeme lehkou verzi Node.js
FROM node:18-alpine

# Vytvoříme pracovní složku
WORKDIR /app

# Zkopírujeme definice závislostí
COPY package*.json ./

# Nainstalujeme knihovny
RUN npm install --production

# Zkopírujeme zbytek aplikace
COPY . .

# Otevřeme port 3000
EXPOSE 3000

# Spustíme server
CMD ["node", "server.js"]
