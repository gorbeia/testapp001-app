# Ubuntu 24.04 Installation Guide

This guide provides step-by-step instructions for installing and setting up the Gure Txokoa application on Ubuntu 24.04 LTS.

## Prerequisites

- Ubuntu 24.04 LTS system
- sudo/administrator privileges
- Internet connection
- Git installed

## System Requirements

- **RAM**: Minimum 2GB, Recommended 4GB+
- **Storage**: Minimum 10GB free space
- **CPU**: Any modern 64-bit processor

## Installation Steps

### 1. Update System Packages

```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Install Required Dependencies

```bash
# Install Node.js and npm
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install Git (if not already installed)
sudo apt install -y git

# Install build tools
sudo apt install -y build-essential
```

### 3. Configure PostgreSQL

```bash
# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Switch to postgres user and create database
sudo -u postgres psql
```

In the PostgreSQL shell:

```sql
CREATE DATABASE guretxokoa;
CREATE USER guretxokoa_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE guretxokoa TO guretxokoa_user;
ALTER USER guretxokoa_user CREATEDB;
\q
```

### 4. Install Application Dependencies

```bash
# Clone the repository (replace with your actual repository URL)
git clone https://github.com/your-username/testapp001-app.git
cd testapp001-app

# Install Node.js dependencies
npm install

# Install pnpm (recommended for better performance)
npm install -g pnpm
pnpm install
```

### 5. Environment Configuration

Create and configure the environment file:

```bash
cp .env.example .env
nano .env
```

Edit the `.env` file with your configuration:

```env
# Database Configuration
DATABASE_URL="postgresql://guretxokoa_user:your_secure_password@localhost:5432/guretxokoa"

# Application Configuration
NODE_ENV=development
PORT=3000

# JWT Secret (generate a secure random string)
JWT_SECRET="your_jwt_secret_key_here"

# Other configuration as needed
```

### 6. Database Setup

```bash
# Reset database and apply consolidated migration
NODE_OPTIONS='--import tsx' node script/reset-database.ts

# Seed the database with initial data
npm run db:seed
```

### 7. Build the Application

```bash
# Build the application
npm run build
```

### 8. Start the Application

#### Development Mode:

```bash
npm run dev
```

#### Production Mode:

```bash
npm start
```

### 9. Verify Installation

Open your web browser and navigate to:
- **Application**: http://localhost:3000
- **API Endpoints**: http://localhost:3000/api

## Default Login Credentials

After seeding, you can use these demo accounts:

| Email | Password | Role |
|-------|----------|------|
| admin@txokoa.eus | demo | Administrator |
| diruzaina@txokoa.eus | demo | Treasurer |
| sotolaria@txokoa.eus | demo | CellarSotolaria Distinct |
|. bazkidea@职员 | demo | . Member |
 . laguna kost | demo |.
| lagunaarca.eusH | demo |.
| Friend |

**S.
**Society ID. ID**.
**.
**GT001** (for login form).

## Firewall Configuration

If you want to access the application from other machines:

```bash
# Allow port 3000 through firewall
sudo ufw allow 3000

# Enable firewall (if not already enabled)
sudo ufw enable
```

## PM2 Production Deployment (Recommended)

For production environments, PM2 provides superior process management:

### 1. Install PM2

```bash
# Install PM2 globally
sudo npm install -g pm2

# Verify installation
pm2 --version
```

### 2. Create PM2 Configuration File

Create `ecosystem.config.js` in the project root:

```bash
nano ecosystem.config.js
```

Add the following configuration:

```javascript
module.exports = {
  apps: [{
    name: 'guretxokoa',
    script: 'dist/index.cjs',
    instances: 'max', // Use all available CPU cores
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
};
```

### 3. Create Logs Directory

```bash
mkdir -p logs
```

### 4. Start Application with PM2

```bash
# Start in production mode
pm2 start ecosystem.config.js --env production

# Check status
pm2 status

# View logs
pm2 logs

# Monitor performance
pm2 monit
```

### 5. Save PM2 Configuration

```bash
# Save current process list
pm2 save

# Generate startup script
pm2 startup

# Follow the output to enable startup (usually):
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp $HOME
```

### 6. PM2 Commands

```bash
# Start/Stop/Restart
pm2 start guretxokoa
pm2 stop guretxokoa
pm2 restart guretxokoa
pm2 delete guretxokoa

# Reload without downtime
pm2 reload guretxokoa

# View logs
pm2 logs guretxokoa
pm2 logs --lines 100

# Monitor
pm2 monit
pm2 status

# Update application
npm run build
pm2 reload guretxokoa

# Scale instances
pm2 scale guretxokoa 4
```

## Systemd Service (Alternative)

To run the application as a system service:

Create a service file:

```bash
sudo nano /etc/systemd/system/guretxokoa.service
```

Add the following content:

```ini
[Unit]
Description=Gure Txokoa Application
After=network.target postgresql.service

[Service]
Type=simple
User=your_username
WorkingDirectory=/home/your_username/testapp001-app
Environment=NODE_ENV=production
Environment=PATH=/usr/bin
ExecStart=/usr/bin/node dist/index.cjs
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable guretxokoa
sudo systemctl start guretxokoa
```

Check service status:

```bash
sudo systemctl status guretxokoa
```

## Nginx Reverse Proxy (Recommended)

To set up Nginx as a reverse proxy for ports 80 and 443:

```bash
# Install Nginx
sudo apt install -y nginx

# Create Nginx configuration
sudo nano /etc/nginx/sites-available/guretxokoa
```

Add the following configuration:

```nginx
# HTTP (Port 80) - Redirect to HTTPS
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    
    # Redirect all HTTP traffic to HTTPS
    return 301 https://$server_name$request_uri;
}

# HTTPS (Port 443) - Main application
server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    # SSL Configuration (after obtaining certificates)
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # SSL Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Application Proxy
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # WebSocket Support (if needed)
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static files caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        proxy_pass http://localhost:3000;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/guretxokoa /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## SSL Certificate (Required for Port 443)

For HTTPS on port 443, use Let's Encrypt:

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain SSL certificate (this will update Nginx config automatically)
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Test auto-renewal
sudo certbot renew --dry-run

# Set up auto-renewal cron job
sudo crontab -e
```

Add this line for auto-renewal:

```
0 12 * * * /usr/bin/certbot renew --quiet --post-hook "systemctl reload nginx"
```

After SSL setup, your Nginx configuration will automatically handle:
- **Port 80**: HTTP traffic redirected to HTTPS
- **Port 443**: HTTPS traffic to your application
- **SSL certificates**: Automatically renewed
- **Security headers**: HTTPS-only features enabled

## Troubleshooting

### Common Issues

1. **Database Connection Error**
   ```bash
   # Check PostgreSQL status
   sudo systemctl status postgresql
   
   # Check if database exists
   sudo -u postgres psql -l
   ```

2. **Permission Denied**
   ```bash
   # Fix file permissions
   sudo chown -R $USER:$USER /path/to/testapp001-app
   chmod +x /path/to/testapp001-app/script/*.ts
   ```

3. **Port Already in Use**
   ```bash
   # Check what's using port 3000
   sudo lsof -i :3000
   
   # Kill the process
   sudo kill -9 <PID>
   ```

4. **Node.js Version Issues**
   ```bash
   # Check Node.js version
   node --version
   
   # Should be v20.x or higher
   ```

### Logs

- **Application logs**: Check terminal output or use `journalctl` if using systemd
- **Database logs**: `/var/log/postgresql/`
- **Nginx logs**: `/var/log/nginx/`

## Maintenance

### Regular Updates

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Node.js dependencies
npm update

# Update database schema (if needed)
NODE_OPTIONS='--import tsx' node script/reset-database.ts
npm run db:seed
```

### Backups

```bash
# Database backup
sudo -u postgres pg_dump guretxokoa > backup_$(date +%Y%m%d).sql

# Application files backup
tar -czf app_backup_$(date +%Y%m%d).tar.gz /path/to/testapp001-app
```

## Support

For issues and support:
- Check the application logs for error messages
- Verify all configuration settings
- Ensure all services are running
- Check network connectivity and firewall settings

## Security Considerations

1. **Change default passwords** immediately after installation
2. **Use strong JWT secrets** - generate random strings
3. **Keep software updated** regularly
4. **Use HTTPS** in production
5. **Limit database access** to application user only
6. **Regular backups** of database and configuration

---

**Note**: This guide assumes a fresh Ubuntu 24.04 installation. Adjust paths and usernames according to your specific setup.
