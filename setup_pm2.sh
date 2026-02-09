#!/bin/bash

# ============================================
# PM2 Setup Script for Mark's Trades
# Run this ONCE on the VPS to switch from systemctl to PM2
# After this, use: pm2 restart all
# ============================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

PROJECT_DIR="/var/www/markstrades"

echo -e "${YELLOW}Setting up PM2 for Mark's Trades...${NC}"

# Create logs directory
mkdir -p $PROJECT_DIR/logs
echo -e "${GREEN}✓ Logs directory created${NC}"

# Stop existing systemctl services (if running)
echo -e "${YELLOW}Stopping systemctl services...${NC}"
sudo systemctl stop markstrades-backend 2>/dev/null || true
sudo systemctl stop markstrades-frontend 2>/dev/null || true
sudo systemctl disable markstrades-backend 2>/dev/null || true
sudo systemctl disable markstrades-frontend 2>/dev/null || true
echo -e "${GREEN}✓ Old systemctl services stopped and disabled${NC}"

# Kill any existing PM2 processes
pm2 kill 2>/dev/null || true

# Start both apps with ecosystem config
cd $PROJECT_DIR
pm2 start ecosystem.config.js
echo -e "${GREEN}✓ PM2 apps started${NC}"

# Save PM2 process list (so pm2 restart all works after reboot)
pm2 save
echo -e "${GREEN}✓ PM2 process list saved${NC}"

# Setup PM2 startup (auto-start on server reboot)
pm2 startup
echo -e "${YELLOW}⚠️  If PM2 printed a sudo command above, copy and run it!${NC}"

# Verify
echo ""
pm2 status
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}✅ PM2 Setup Complete!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "Commands:"
echo "  pm2 restart all        - Restart both backend & frontend"
echo "  pm2 restart backend    - Restart only backend"
echo "  pm2 restart frontend   - Restart only frontend"
echo "  pm2 status             - Check status"
echo "  pm2 logs               - View all logs"
echo "  pm2 logs backend       - View backend logs"
echo "  pm2 logs frontend      - View frontend logs"
echo "  pm2 monit              - Real-time monitoring"
echo ""
