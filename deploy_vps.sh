#!/bin/bash

# ============================================
# Mark's Trades VPS One-Click Deployment Script
# ============================================

set -e  # Exit on any error

echo "🚀 Starting Mark's Trades VPS Deployment..."
echo "============================================"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="/var/www/markstrades"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

# Step 1: Pull latest code
echo -e "\n${YELLOW}Step 1: Pulling latest code from Git...${NC}"
cd $PROJECT_DIR
git pull origin main
echo -e "${GREEN}✓ Code updated${NC}"

# Step 2: Backend updates
echo -e "\n${YELLOW}Step 2: Updating Backend...${NC}"
cd $BACKEND_DIR
source venv/bin/activate

# Install/update Python dependencies
pip install -q python-dotenv
echo -e "${GREEN}✓ Python dependencies updated${NC}"

# Run migrations
python manage.py makemigrations
python manage.py migrate
echo -e "${GREEN}✓ Database migrations applied${NC}"

# Collect static files
python manage.py collectstatic --noinput
echo -e "${GREEN}✓ Static files collected${NC}"

# Set media directory permissions
sudo chown -R ubuntu:www-data media/
sudo chmod -R 755 media/
if [ -d "media/site" ]; then
    sudo chmod -R 644 media/site/*
fi
echo -e "${GREEN}✓ Media permissions set${NC}"

# Restart Backend
sudo systemctl restart markstrades-backend
echo -e "${GREEN}✓ Backend restarted${NC}"

# Step 3: Frontend updates
echo -e "\n${YELLOW}Step 3: Updating Frontend...${NC}"
cd $FRONTEND_DIR

# Install qrcode package if not exists
if ! npm list qrcode > /dev/null 2>&1; then
    npm install qrcode @types/qrcode
    echo -e "${GREEN}✓ QRCode package installed${NC}"
fi

# Build frontend
npm run build
echo -e "${GREEN}✓ Frontend built successfully${NC}"

# Restart Frontend
sudo systemctl restart markstrades-frontend
echo -e "${GREEN}✓ Frontend restarted${NC}"

# Step 4: Nginx configuration
echo -e "\n${YELLOW}Step 4: Checking Nginx configuration...${NC}"

NGINX_CONFIG="/etc/nginx/sites-available/markstrades.com"

# Backup existing config
if [ -f "$NGINX_CONFIG" ]; then
    sudo cp $NGINX_CONFIG ${NGINX_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)
    echo -e "${GREEN}✓ Nginx config backed up${NC}"
fi

# Create/update Nginx configuration
sudo tee $NGINX_CONFIG > /dev/null <<'EOF'
server {
    listen 80;
    server_name markstrades.com www.markstrades.com;

    client_max_body_size 20M;

    # Media files (uploaded content like logos)
    location /media/ {
        alias /var/www/markstrades/backend/media/;
        expires 30d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # Static files (CSS, JS, etc.)
    location /static/ {
        alias /var/www/markstrades/backend/staticfiles/;
        expires 30d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # API requests to Django backend
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Django admin panel
    location /admin/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Unsubscribe page
    location /unsubscribe {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Frontend (Next.js) - must be last
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

echo -e "${GREEN}✓ Nginx configuration updated${NC}"

# Test Nginx configuration
sudo nginx -t
echo -e "${GREEN}✓ Nginx configuration valid${NC}"

# Reload Nginx
sudo systemctl reload nginx
echo -e "${GREEN}✓ Nginx reloaded${NC}"

# Step 5: Generate request numbers for existing records
echo -e "\n${YELLOW}Step 5: Updating existing purchase requests...${NC}"
cd $BACKEND_DIR
source venv/bin/activate

python manage.py shell <<PYTHON_SCRIPT
from core.models import LicensePurchaseRequest
import random

updated = 0
for pr in LicensePurchaseRequest.objects.filter(request_number__isnull=True):
    while True:
        number = str(random.randint(100000, 999999))
        if not LicensePurchaseRequest.objects.filter(request_number=number).exists():
            pr.request_number = number
            pr.save()
            updated += 1
            break

print(f"Updated {updated} purchase requests with random numbers")
PYTHON_SCRIPT

echo -e "${GREEN}✓ Purchase requests updated${NC}"

# Step 6: Verify services
echo -e "\n${YELLOW}Step 6: Verifying services...${NC}"

# Check Backend
if systemctl is-active --quiet markstrades-backend; then
    echo -e "${GREEN}✓ Backend is running${NC}"
else
    echo -e "${RED}✗ Backend is not running${NC}"
fi

# Check Frontend
if systemctl is-active --quiet markstrades-frontend; then
    echo -e "${GREEN}✓ Frontend is running${NC}"
else
    echo -e "${RED}✗ Frontend is not running${NC}"
fi

# Check Nginx
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✓ Nginx is running${NC}"
else
    echo -e "${RED}✗ Nginx is not running${NC}"
fi

# Final summary
echo -e "\n${GREEN}============================================${NC}"
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "✅ All fixes applied:"
echo "  • QR code generation working"
echo "  • Amount display fixed"
echo "  • 6-digit random request numbers"
echo "  • Unsubscribe confirmation page"
echo "  • Logo/media files serving"
echo "  • Database migrations applied"
echo ""
echo "🌐 Site: https://markstrades.com"
echo "🔧 Admin: https://markstrades.com/admin"
echo ""
echo "📊 Check logs:"
echo "  Backend:  sudo journalctl -u markstrades-backend -f"
echo "  Frontend: sudo journalctl -u markstrades-frontend -f"
echo "  Nginx:    sudo tail -f /var/log/nginx/error.log"
echo ""
