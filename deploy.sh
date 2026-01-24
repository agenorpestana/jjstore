
#!/bin/bash

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== INICIANDO INSTALAÇÃO AUTOMATIZADA RASTREAÊ ===${NC}"

# 1. Verificar se é root
if [ "$EUID" -ne 0 ]; then
  echo "Por favor, rode este script como root (sudo su)"
  exit
fi

# 2. Perguntas Iniciais
echo -e "${YELLOW}Configuração Inicial:${NC}"
read -p "Digite o domínio do site (ex: app.meusite.com): " DOMAIN_NAME
read -p "Digite a URL do Repositório Git (https://...): " GIT_REPO

echo -e "${YELLOW}Configuração do Banco de Dados (HostGator/Externo):${NC}"
read -p "DB Host (IP da HostGator): " DB_HOST
read -p "DB User: " DB_USER
read -p "DB Password: " -s DB_PASSWORD
echo ""
read -p "DB Name: " DB_NAME

# 3. Atualizar Sistema e Instalar Dependências
echo -e "${GREEN}>>> Atualizando sistema e instalando dependências...${NC}"
apt update && apt upgrade -y
apt install -y curl git nginx certbot python3-certbot-nginx build-essential

# 4. Instalar Node.js 20
echo -e "${GREEN}>>> Instalando Node.js 20...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# 5. Configurar Diretório da Aplicação
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

# 6. Criar arquivo .env
echo -e "${GREEN}>>> Gerando arquivo .env...${NC}"
cat > .env <<EOF
PORT=3002
DB_HOST=$DB_HOST
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_NAME=$DB_NAME
DB_USE_SSL=false
EOF

# 7. Instalação e Build
echo -e "${GREEN}>>> Instalando pacotes e gerando Build do Frontend...${NC}"
npm install
npm run build

# 8. Configurar PM2
echo -e "${GREEN}>>> Iniciando aplicação com PM2...${NC}"
pm2 stop rastreae-app 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup | bash # Isso pode pedir para rodar um comando manualmente em alguns sistemas, mas geralmente o bash executa

# 9. Configurar Nginx
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

# 10. Configurar SSL (Certbot)
echo -e "${GREEN}>>> Configurando SSL Gratuito (Let's Encrypt)...${NC}"
# --non-interactive: não pergunta nada
# --agree-tos: concorda com termos
# -m: email (usando admin@dominio como placeholder, idealmente pediria email)
# --redirect: força HTTPS
certbot --nginx -d $DOMAIN_NAME --non-interactive --agree-tos -m admin@$DOMAIN_NAME --redirect

echo -e "${GREEN}=== INSTALAÇÃO CONCLUÍDA COM SUCESSO! ===${NC}"
echo -e "Acesse seu site em: https://$DOMAIN_NAME"
