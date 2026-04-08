# Ubuntu 24.04 Installation Guide

This guide provides step-by-step instructions for installing and setting up **Elkartearen App** on Ubuntu 24.04 LTS (the app UI is branded _Gure Txokoa_ in the client).

## Prerequisites

- Ubuntu 24.04 LTS system
- sudo/administrator privileges
- Internet connection

## System Requirements

- **RAM**: Minimum 2GB, Recommended 4GB+
- **Storage**: Minimum 10GB free space
- **CPU**: Any modern 64-bit processor
- **Node.js**: v24 or higher (the project's `engines` field requires ≥24)
- **pnpm**: v10.x (specified in `packageManager` field)

## Installation Steps

### 1. Update System Packages

```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Install Required Dependencies

```bash
# Install Git and build tools
sudo apt install -y git build-essential

# Install Node.js 24.x (required by the project)
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs

# Install pnpm (the project's package manager)
corepack enable
corepack prepare pnpm@10.22.0 --activate

# Verify versions
node --version   # should be v24.x
pnpm --version   # should be 10.x

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib
```

**Optional — E2E testing only:**

```bash
npx playwright install --with-deps
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
git clone https://github.com/gorbeia/testapp001-app.git
cd testapp001-app

# Install dependencies
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

# Environment
NODE_ENV=production

# Application port (default 5000)
PORT=5000

# JWT Secret — society app tokens (generate with: openssl rand -base64 32)
JWT_SECRET="your_jwt_secret_key_here"

# JWT Secret — backoffice / superadmin tokens (separate from society JWT)
BACKOFFICE_JWT_SECRET="your_backoffice_jwt_secret_here"

# Session secret
SESSION_SECRET="your_session_secret_here"
```

> **Tip**: Generate secure secrets with `openssl rand -base64 32`. Never reuse the same value for `JWT_SECRET` and `BACKOFFICE_JWT_SECRET`.

### 6. Database Setup

```bash
# Reset database and apply consolidated migration
pnpm db:reset
```

**Database Permissions**: If you encounter permission errors, grant the necessary privileges:

```bash
# Grant permissions in the correct database
sudo -u postgres psql -d guretxokoa -c "
GRANT ALL ON SCHEMA public TO guretxokoa_user;
GRANT ALL ON ALL TABLES IN SCHEMA public TO guretxokoa_user;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO guretxokoa_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO guretxokoa_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO guretxokoa_user;
ALTER SCHEMA public OWNER TO guretxokoa_user;
"
```

```bash
# Seed database with initial data (optional)
pnpm db:seed
```

### 7. Build the Application

```bash
# Build the application
pnpm build
```

### 8. Start the Application

#### Development Mode:

```bash
pnpm dev
```

#### Production Mode:

```bash
pnpm start
```

### 9. Verify Installation

Open your web browser and navigate to:

- **Application**: [http://YOUR_SERVER_IP:5000](http://YOUR_SERVER_IP:5000)
- **API Health Check**: [http://YOUR_SERVER_IP:5000/api](http://YOUR_SERVER_IP:5000/api)

Replace `YOUR_SERVER_IP` with your server's IP address or domain name. If you configured a different `PORT` in `.env`, use that port instead.

## Default Login Credentials

After seeding (`pnpm db:seed`), you can use these demo accounts:

| Email                  | Password | Function          | Role     |
| ---------------------- | -------- | ----------------- | -------- |
| `admin@txokoa.eus`     | demo     | Administratzailea | Bazkidea |
| `diruzaina@txokoa.eus` | demo     | Diruzaina         | Bazkidea |
| `sotolaria@txokoa.eus` | demo     | Sotolaria         | Bazkidea |
| `bazkidea@txokoa.eus`  | demo     | Arrunta           | Bazkidea |
| `laguna@txokoa.eus`    | demo     | Arrunta           | Laguna   |

**Society ID**: Use `GT001` in the login form.

> **Important**: Change all demo passwords immediately after installation in production.

## Firewall Configuration

If you want to access the application from other machines:

```bash
# If using Nginx reverse proxy (recommended), only open HTTP/HTTPS
sudo ufw allow 80
sudo ufw allow 443

# If accessing the app directly without Nginx, open the app port
sudo ufw allow 5000

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
  apps: [
    {
      name: "guretxokoa",
      script: "dist/index.cjs",
      instances: "max", // Use all available CPU cores
      exec_mode: "cluster",
      env: {
        NODE_ENV: "development",
        PORT: 5000,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 5000,
      },
      error_file: "./logs/err.log",
      out_file: "./logs/out.log",
      log_file: "./logs/combined.log",
      time: true,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      node_args: "--max-old-space-size=1024",
    },
  ],
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

### 5. Save PM2 Configuration (survive reboot)

```bash
# Save current process list
pm2 save

# Install the startup hook — PM2 prints one command to run (copy and run it; it needs sudo)
pm2 startup
```

Run exactly the command `pm2 startup` prints (do not skip this step), then:

```bash
pm2 save
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

# Update application (see "Updating the Application" section for full procedure)
pnpm build
pm2 reload guretxokoa

# Scale instances
pm2 scale guretxokoa 4
```

## Nginx Reverse Proxy (Recommended)

To set up Nginx as a reverse proxy for ports 80 and 443:

**Important:** Do **not** add `listen 443`, `ssl_certificate`, or `ssl_certificate_key` until **after** Let’s Encrypt has created the files under `/etc/letsencrypt/live/`. If nginx points at certificates that do not exist yet, `sudo nginx -t` fails and **`certbot --nginx` cannot run** (it runs `nginx -t` internally).

Order of operations:

1. Install nginx and deploy an **HTTP-only** site on port **80** (below).
2. Run **`nginx -t`** and reload nginx — config must be valid.
3. Run **`certbot --nginx`** — certbot obtains certificates and rewrites nginx for HTTPS (and usually redirects HTTP → HTTPS).

```bash
# Install Nginx
sudo apt install -y nginx

# Create Nginx configuration
sudo nano /etc/nginx/sites-available/guretxokoa
```

Add this **initial** configuration (replace `your-domain.com` with your real domain, e.g. `elkartettipia.eus`):

```nginx
# HTTP only — until certbot has created certificates (then it adds HTTPS)
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # Application Proxy
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    location /ws {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        proxy_pass http://127.0.0.1:5000;
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

After HTTPS is working (next section), you can edit the generated SSL server block to add extra **security headers** if you want (e.g. `Strict-Transport-Security`, `X-Frame-Options`). Certbot does not add all of them by default.

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

- **Port 80**: HTTP traffic (typically redirected to HTTPS by certbot)
- **Port 443**: HTTPS traffic to your application
- **SSL certificates**: Automatically renewed
- **Security headers**: Add any HTTPS-only headers you need in the SSL `server` block

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
 # Check what's using the default port (5000)
 sudo lsof -i :5000

 # Kill the process if needed
 sudo kill -9 <PID>
```

4. **Node.js Version Issues**

```bash
 # Check Node.js version
 node --version

 # Must be v24.x or higher (project requires >=24.0.0)
```

5. **Certbot / nginx: `cannot load certificate ... fullchain.pem` / `nginx -t` fails**

This happens when the site config references `/etc/letsencrypt/live/<domain>/fullchain.pem` (and `privkey.pem`) **before** those files exist. The `certbot --nginx` plugin always runs `nginx -t`, so it cannot recover until nginx config is valid again.

**Fix:**

1. Edit the site file under `/etc/nginx/sites-available/` (and check `sites-enabled/` for duplicates).
2. **Remove or comment out** the entire `server { listen 443 ssl ... }` block, and any `ssl_certificate` / `ssl_certificate_key` directives.
3. Ensure **port 80** serves your app with `proxy_pass` (see [Nginx Reverse Proxy](#nginx-reverse-proxy-recommended) — HTTP-only starter config). Do **not** use `return 301 https://...` on port 80 until after the first successful certbot run (otherwise Let’s Encrypt HTTP-01 validation can break).
4. Run:

```bash
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

5. After certbot succeeds, reload nginx if needed: `sudo systemctl reload nginx`.

### Logs

- **Application logs**: `pm2 logs` / `pm2 logs guretxokoa` (see `logs/` if you use file targets in `ecosystem.config.js`)
- **Database logs**: `/var/log/postgresql/`
- **Nginx logs**: `/var/log/nginx/`

## Updating the Application

This section covers how to deploy a new version of the application after the initial installation.

### Pre-Update Checklist

1. **Back up the database** before every update (see [Backups](#backups) below).
2. Read the release notes or commit log for breaking changes (`git log --oneline HEAD..origin/main`).
3. Ensure no one is mid-operation on the app during the update window.

### Standard Update Procedure

```bash
cd /home/your_username/testapp001-app

# 1. Back up the database
pg_dump "$DATABASE_URL" > ~/backups/guretxokoa_pre_update_$(date +%Y%m%d_%H%M).sql

# 2. Pull latest code
git fetch origin
git pull origin main

# 3. Install any new/changed dependencies
pnpm install --frozen-lockfile

# 4. Apply database schema changes (non-destructive)
pnpm db:push

# 5. Rebuild the production bundle
pnpm build

# 6. Restart the application (zero-downtime with PM2)
pm2 reload guretxokoa

# 7. Verify the app is healthy
pm2 status
curl -s http://localhost:5000/api | head -c 200
```

### Database Schema Changes

The project uses **Drizzle ORM** for schema management. There are two approaches:

| Command              | Use case                                                                   | Destructive?                |
| -------------------- | -------------------------------------------------------------------------- | --------------------------- |
| `pnpm db:push`       | Apply schema from code to DB (adds columns/tables, does **not** drop data) | No                          |
| `pnpm db:migrate`    | Run SQL migration files from `migrations/` directory                       | No                          |
| `pnpm db:reset`      | **Drops all tables** and re-creates from schema                            | **Yes — destroys all data** |
| `pnpm db:reset:seed` | Reset + insert demo data                                                   | **Yes — destroys all data** |

For production updates, use `**pnpm db:push`** or `**pnpm db:migrate\*\*`. Never use `db:reset` on a production database.

If a release includes migration files, prefer `pnpm db:migrate`. Otherwise `pnpm db:push` is safe for additive changes.

### Rolling Back

If an update causes problems:

```bash
# 1. Revert to the previous version
git checkout <previous-commit-hash>

# 2. Reinstall dependencies for that version
pnpm install --frozen-lockfile

# 3. Rebuild
pnpm build

# 4. Restart
pm2 reload guretxokoa

# 5. Restore database backup if schema changed
psql "$DATABASE_URL" < ~/backups/guretxokoa_pre_update_YYYYMMDD_HHMM.sql
```

## Maintenance

### System Updates

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y
```

### Dependency Updates

```bash
cd /home/your_username/testapp001-app

# Check for outdated packages
pnpm outdated

# Update dependencies (review changes before deploying)
pnpm update

# Rebuild and restart after updates
pnpm build
pm2 reload guretxokoa
```

### Backups

```bash
# Create backups directory
mkdir -p ~/backups

# Database backup
pg_dump "$DATABASE_URL" > ~/backups/guretxokoa_$(date +%Y%m%d).sql

# Application files backup (includes .env and logs)
tar -czf ~/backups/app_backup_$(date +%Y%m%d).tar.gz \
  --exclude=node_modules \
  --exclude=dist \
  /home/your_username/testapp001-app
```

**Recommended**: Set up a cron job for daily database backups:

```bash
crontab -e
```

Add:

```
0 2 * * * pg_dump "postgresql://guretxokoa_user:your_secure_password@localhost:5432/guretxokoa" > /home/your_username/backups/guretxokoa_$(date +\%Y\%m\%d).sql 2>&1
```

### Log Rotation (PM2)

```bash
# Install PM2 log rotation module
pm2 install pm2-logrotate

# Configure rotation (optional)
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

## Support

For issues and support:

- Check the application logs: `pm2 logs` or `pm2 logs guretxokoa --lines 200`
- Verify all services are running: `pm2 status` and `sudo systemctl status postgresql`
- Check database connectivity: `psql "$DATABASE_URL" -c "SELECT 1"`
- Check network/firewall: `sudo ufw status`

## Security Considerations

1. **Change default passwords** immediately after installation
2. **Use strong JWT secrets** — generate with `openssl rand -base64 32`
3. **Keep software updated** — both system packages and Node.js dependencies
4. **Use HTTPS** in production (see Nginx + Certbot sections above)
5. **Limit database access** to the application user only
6. **Regular backups** of database and configuration
7. **Restrict `.env` file permissions**: `chmod 600 .env`
8. **Do not expose port 5000 directly** when using Nginx — only allow 80/443 in the firewall

---

**Note**: This guide assumes a fresh Ubuntu 24.04 installation. Adjust paths and usernames according to your specific setup.
