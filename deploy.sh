#!/bin/bash

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== INICIANDO INSTALAÇÃO AUTOMATIZADA RASTREAÊ (BANCO LOCAL) ===${NC}"

# 1. Verificar se é root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Erro: Por favor, rode este script como root (sudo su)${NC}"
  exit
fi

# 2. Perguntas Iniciais
echo -e "${YELLOW}>>> Configuração do Site:${NC}"
read -p "Digite o domínio do site (ex: app.meusite.com): " DOMAIN_NAME
read -p "Digite a URL do Repositório Git (https://...): " GIT_REPO

echo -e "\n${YELLOW}>>> Configuração do Banco de Dados Local (MySQL):${NC}"
echo "Vamos criar um novo banco de dados e usuário nesta VPS."
read -p "Nome do Banco de Dados (ex: rastreae_db): " DB_NAME
read -p "Nome do Usuário do Banco (ex: rastreae_user): " DB_USER
read -p "Senha para o Usuário do Banco: " -s DB_PASSWORD
echo "" 

# 3. Atualizar Sistema e Instalar Dependências Básicas
echo -e "${GREEN}>>> Atualizando sistema e instalando dependências...${NC}"
export DEBIAN_FRONTEND=noninteractive
apt update && apt upgrade -y
apt install -y curl git nginx certbot python3-certbot-nginx build-essential mysql-server

# 4. Configurar MySQL (Banco Local)
echo -e "${GREEN}>>> Configurando MySQL Local...${NC}"

# Inicia o serviço se não estiver rodando
systemctl start mysql
systemctl enable mysql

# Criação do Banco e Usuário via SQL
# Nota: Em VPS Ubuntu novas, o root do MySQL usa auth_socket (sudo sem senha), o que facilita automação
sudo mysql -e "CREATE DATABASE IF NOT EXISTS ${DB_NAME};"
sudo mysql -e "CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';"
sudo mysql -e "GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';"
sudo mysql -e "FLUSH PRIVILEGES;"

echo -e "${GREEN}>>> Banco de dados ${DB_NAME} criado com sucesso!${NC}"

# 5. Instalar Node.js 20
echo -e "${GREEN}>>> Instalando Node.js 20...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# 6. Configurar Diretório da Aplicação
APP_DIR="/var/www/$DOMAIN_NAME"
echo -e "${GREEN}>>> Configurando diretório em $APP_DIR...${NC}"

# Instalar PM2 Globalmente
npm install -g pm2

if [ -d "$APP_DIR" ]; then
    echo "Diretório já existe. Atualizando repositório..."
    cd $APP_DIR
    git pull
else
    echo "Clonando repositório..."
    git clone $GIT_REPO $APP_DIR
    cd $APP_DIR
fi

# 7. Criar arquivo .env
echo -e "${GREEN}>>> Gerando arquivo .env...${NC}"
cat > .env <<EOF
PORT=3002
DB_HOST=localhost
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_NAME=$DB_NAME
DB_USE_SSL=false
EOF

# 8. Instalação e Build
echo -e "${GREEN}>>> Instalando pacotes e gerando Build do Frontend...${NC}"
npm install
npm run build

# 9. Configurar PM2
echo -e "${GREEN}>>> Iniciando aplicação com PM2...${NC}"
pm2 stop rastreae-app 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup | bash # Executa o comando necessário para persistência

# 10. Configurar Nginx
echo -e "${GREEN}>>> Configurando Nginx (Reverse Proxy)...${NC}"
NGINX_CONF="/etc/nginx/sites-available/$DOMAIN_NAME"

cat > $NGINX_CONF <<EOF
server {
    listen 80;
    server_name $DOMAIN_NAME;

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

# Ativar site e remover default se existir
ln -sfn $NGINX_CONF /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

# 11. Configurar SSL (Certbot)
echo -e "${GREEN}>>> Configurando SSL Gratuito (Let's Encrypt)...${NC}"
# Tenta obter o SSL. Se falhar (por DNS não propagado), avisa mas não quebra o script todo
if certbot --nginx -d $DOMAIN_NAME --non-interactive --agree-tos -m admin@$DOMAIN_NAME --redirect; then
    echo -e "${GREEN}SSL Configurado com sucesso!${NC}"
else
    echo -e "${RED}Atenção: Não foi possível gerar o SSL automaticamente.${NC}"
    echo "Verifique se o DNS do domínio $DOMAIN_NAME está apontando corretamente para este servidor."
    echo "Depois, rode: sudo certbot --nginx -d $DOMAIN_NAME"
fi

echo -e "${GREEN}=== INSTALAÇÃO CONCLUÍDA! ===${NC}"
echo -e "Acesse seu site em: https://$DOMAIN_NAME"
echo -e "Banco de dados local configurado: $DB_NAME (Usuário: $DB_USER)"
