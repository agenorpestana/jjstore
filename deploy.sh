
#!/bin/bash

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== GERENCIADOR RASTREAÊ ===${NC}"

# 1. Verificar se é root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Erro: Por favor, rode este script como root (sudo su)${NC}"
  exit
fi

# 2. Perguntar diretório/domínio
echo -e "${YELLOW}>>> Configuração:${NC}"
read -p "Digite o domínio do site (ex: app.meusite.com): " DOMAIN_NAME

APP_DIR="/var/www/$DOMAIN_NAME"

# 3. Lógica de Instalação vs Atualização
if [ -d "$APP_DIR" ]; then
    # --- MODO ATUALIZAÇÃO ---
    echo -e "${GREEN}>>> Instalação detectada em $APP_DIR. Iniciando ATUALIZAÇÃO...${NC}"
    
    cd $APP_DIR
    
    echo "Baixando código mais recente..."
    git pull
    
    echo "Instalando novas dependências..."
    npm install
    
    echo "Gerando novo build..."
    npm run build
    
    echo "Reiniciando aplicação..."
    # Isso vai disparar o server.js que contem a lógica de atualização do DB (migration)
    pm2 restart rastreae-app

    # Atualizar Nginx config caso tenha mudado
    echo "Atualizando configuração do Nginx..."
    NGINX_CONF="/etc/nginx/sites-available/$DOMAIN_NAME"
    cat > $NGINX_CONF <<EOF
server {
    listen 80;
    server_name $DOMAIN_NAME;

    # Aumenta limite de upload para evitar Erro 413
    client_max_body_size 200M;

    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
EOF
    nginx -t && systemctl reload nginx
    
    echo -e "${GREEN}=== ATUALIZAÇÃO CONCLUÍDA! ===${NC}"

else
    # --- MODO INSTALAÇÃO DO ZERO ---
    echo -e "${GREEN}>>> Nenhuma instalação encontrada. Iniciando INSTALAÇÃO COMPLETA...${NC}"
    
    read -p "Digite a URL do Repositório Git (https://...): " GIT_REPO
    echo -e "\n${YELLOW}>>> Configuração do Banco de Dados Local (MySQL):${NC}"
    read -p "Nome do Banco de Dados (ex: rastreae_db): " DB_NAME
    read -p "Nome do Usuário do Banco (ex: rastreae_user): " DB_USER
    read -p "Senha para o Usuário do Banco: " -s DB_PASSWORD
    echo "" 

    # Atualizar Sistema
    echo -e "${GREEN}>>> Atualizando sistema e instalando dependências...${NC}"
    export DEBIAN_FRONTEND=noninteractive
    apt update && apt upgrade -y
    apt install -y curl git nginx certbot python3-certbot-nginx build-essential mysql-server

    # MySQL
    echo -e "${GREEN}>>> Configurando MySQL Local...${NC}"
    systemctl start mysql
    systemctl enable mysql
    sudo mysql -e "CREATE DATABASE IF NOT EXISTS ${DB_NAME};"
    sudo mysql -e "CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';"
    sudo mysql -e "GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';"
    sudo mysql -e "FLUSH PRIVILEGES;"

    # Node.js
    echo -e "${GREEN}>>> Instalando Node.js 20...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
    npm install -g pm2

    # Clone
    echo -e "${GREEN}>>> Clonando repositório...${NC}"
    git clone $GIT_REPO $APP_DIR
    cd $APP_DIR

    # .env
    echo -e "${GREEN}>>> Gerando arquivo .env...${NC}"
    cat > .env <<EOF
PORT=3002
DB_HOST=localhost
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_NAME=$DB_NAME
DB_USE_SSL=false
EOF

    # Install & Build
    echo -e "${GREEN}>>> Instalando e compilando...${NC}"
    npm pkg set type=module
    npm install
    npm install express mysql2 cors dotenv body-parser
    npm install -D vite @vitejs/plugin-react typescript @types/react @types/react-dom
    npm install react react-dom lucide-react @google/genai
    npm run build

    # PM2
    echo -e "${GREEN}>>> Iniciando servidor...${NC}"
    cat > ecosystem.config.cjs <<EOF
module.exports = {
  apps: [{
    name: "rastreae-app",
    script: "server.js",
    env: {
      NODE_ENV: "production",
      PORT: 3002
    }
  }]
};
EOF
    pm2 delete rastreae-app 2>/dev/null || true
    pm2 start ecosystem.config.cjs
    pm2 save
    pm2 startup | grep "sudo" | bash 2>/dev/null || true

    # Nginx
    echo -e "${GREEN}>>> Configurando Nginx...${NC}"
    NGINX_CONF="/etc/nginx/sites-available/$DOMAIN_NAME"
    cat > $NGINX_CONF <<EOF
server {
    listen 80;
    server_name $DOMAIN_NAME;

    # Aumenta limite de upload para evitar Erro 413
    client_max_body_size 200M;

    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
EOF
    ln -sfn $NGINX_CONF /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    nginx -t && systemctl restart nginx

    # SSL
    echo -e "${GREEN}>>> Configurando SSL...${NC}"
    if certbot --nginx -d $DOMAIN_NAME --non-interactive --agree-tos -m admin@$DOMAIN_NAME --redirect; then
        echo -e "${GREEN}SSL Configurado!${NC}"
    else
        echo -e "${RED}Erro no SSL. Verifique o DNS.${NC}"
    fi
fi

echo -e "${GREEN}=== OPERAÇÃO CONCLUÍDA! ===${NC}"
