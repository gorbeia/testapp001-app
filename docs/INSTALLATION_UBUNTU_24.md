# Ubuntu 24.04 Installation Guide

This guide provides step-by-step instructions for installing and setting up **Elkartearen App** on Ubuntu 24.04 LTS (the app UI is branded *Gure Txokoa* in the client).

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
```

Create the database role and database in one shot (replace `your_secure_password` with a strong password; use the **same** password in `DATABASE_URL` in `.env`):

```bash
sudo -u postgres psql <<'SQL'
CREATE DATABASE guretxokoa;
CREATE USER guretxokoa_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE guretxokoa TO guretxokoa_user;
ALTER USER guretxokoa_user CREATEDB;
SQL
```

Alternatively, open an interactive shell and paste the same statements:

```bash
sudo -u postgres psql
```

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

Edit the `.env` file with your configuration. Replace every placeholder (`your_secure_password`, `203.0.113.50`, `elkartea.eus`, etc.) with your real values.

```bash
# Generate three different secrets (paste each output into .env):
openssl rand -base64 32
openssl rand -base64 32
openssl rand -base64 32
```

```env
# Database Configuration
DATABASE_URL="postgresql://guretxokoa_user:your_secure_password@localhost:5432/guretxokoa"

# Environment
NODE_ENV=production

# Application port (default 5000)
PORT=5000

# JWT Secret — society app tokens
JWT_SECRET="paste_output_of_openssl_rand_here_1"

# JWT Secret — backoffice / superadmin tokens (must differ from JWT_SECRET)
BACKOFFICE_JWT_SECRET="paste_output_of_openssl_rand_here_2"

# Session secret
SESSION_SECRET="paste_output_of_openssl_rand_here_3"

# --- Tenant hosts (default multitenancy) ---
# Same apex hostname everywhere: no scheme, no path, no trailing dot (e.g. elkartea.eus).
# Server: resolves society from Host header for {subdomain}.{TENANT_APEX_DOMAIN}.
TENANT_APEX_DOMAIN="elkartea.eus"

# Client build (Vite): must match TENANT_APEX_DOMAIN. Set before `pnpm build`; change requires rebuild.
VITE_TENANT_APEX_DOMAIN="elkartea.eus"

# Behind nginx TLS termination: safe to omit when NODE_ENV=production (Express enables trust proxy).
# Uncomment if you need X-Forwarded-* trust without production NODE_ENV:
# TRUST_PROXY=1
```

> **Tip**: Never reuse the same random string for `JWT_SECRET` and `BACKOFFICE_JWT_SECRET`. Society subdomains are configured in the backoffice (`societies.subdomain`); DNS and TLS must cover `*.your-domain.com`. Details: [subdomain-tenancy.md](features/subdomain-tenancy.md).

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

Client assets embed `VITE_*` values from `.env` at **build** time. If you change `VITE_TENANT_APEX_DOMAIN` (or `VITE_API_URL`), run `pnpm build` again before restarting the server.

```bash
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

If you are testing **without** nginx (direct to Node), replace `203.0.113.50` with your server IP and run:

```bash
curl -sS "http://203.0.113.50:5000/api" | head -c 300
```

Open in a browser (same IP/port):

- **Application**: `http://203.0.113.50:5000`
- **API**: `http://203.0.113.50:5000/api`

With **nginx + HTTPS** and apex `elkartea.eus`, use your real domain:

```bash
curl -sS "https://elkartea.eus/api" | head -c 300
```

- **Public / marketing host (apex)**: `https://elkartea.eus`
- **Example society host** (after DNS + TLS + backoffice subdomain `txokoa`): `https://txokoa.elkartea.eus`

If you set a different `PORT` in `.env`, use that port in the direct-to-Node URLs.

## Default Login Credentials

After seeding (`pnpm db:seed`), you can use these demo accounts:


| Email                  | Password | Function          | Role     |
| ---------------------- | -------- | ----------------- | -------- |
| `admin@txokoa.eus`     | demo     | Administratzailea | Bazkidea |
| `diruzaina@txokoa.eus` | demo     | Diruzaina         | Bazkidea |
| `sotolaria@txokoa.eus` | demo     | Sotolaria         | Bazkidea |
| `bazkidea@txokoa.eus`  | demo     | Arrunta           | Bazkidea |
| `laguna@txokoa.eus`    | demo     | Arrunta           | Laguna   |


**Society ID**: Use `GT001` in the login form when you are **not** on that society’s tenant subdomain. On `https://{subdomain}.{TENANT_APEX_DOMAIN}`, the app binds login to the host; set each society’s subdomain in the backoffice to match DNS.

> **Important**: Change all demo passwords immediately after installation in production.

## Firewall Configuration

If you want to access the application from other machines:

```bash
# Allow SSH first so you are not locked out (skip if already allowed)
sudo ufw allow OpenSSH

# With Nginx reverse proxy (recommended): only HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Direct access to Node (no Nginx): open the app port
sudo ufw allow 5000/tcp

sudo ufw enable
sudo ufw status
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
        // Same apex as .env TENANT_APEX_DOMAIN (optional here if PM2 loads .env from cwd)
        TENANT_APEX_DOMAIN: "elkartea.eus",
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

The app resolves **which society** to show from the HTTP `**Host`** header when `TENANT_APEX_DOMAIN` is set (e.g. `txokoa.elkartea.eus` → society subdomain `txokoa`). Nginx must proxy **all** of these names to the same upstream and pass `**Host` unchanged** (`proxy_set_header Host $host;` — as below).

**DNS (do this before or alongside nginx):** Point your apex and every society hostname at the server. Replace `203.0.113.50` with your server’s public IPv4 (or use your provider’s “flattened” / ALIAS pattern if you use a CNAME on the apex).


| Purpose               | Type           | Name / host | Value                 |
| --------------------- | -------------- | ----------- | --------------------- |
| Apex                  | `A`            | `@`         | `203.0.113.50`        |
| `www`                 | `A` or `CNAME` | `www`       | `203.0.113.50` or `@` |
| All tenant subdomains | `A` or `CNAME` | `*`         | `203.0.113.50` or `@` |


Example checks after DNS propagates:

```bash
dig +short elkartea.eus A
dig +short www.elkartea.eus A
dig +short txokoa.elkartea.eus A
```

**Important:** Do **not** add `listen 443`, `ssl_certificate`, or `ssl_certificate_key` until certificate files exist under `/etc/letsencrypt/live/`. If nginx references missing certs, `sudo nginx -t` fails and `**certbot --nginx` cannot run** (it runs `nginx -t` internally).

Order of operations:

1. Install nginx and deploy an **HTTP-only** site on port **80** (below), including `***.your-domain.com`** in `server_name`.
2. Run `**sudo nginx -t**` and reload nginx — config must be valid.
3. Obtain TLS certificates (see [SSL Certificate](#ssl-certificate-required-for-port-443)): for tenant subdomains you need a name set that includes `***.your-domain.com**` (wildcard via DNS-01, or per-host certificates).

```bash
# Install Nginx
sudo apt install -y nginx

# Create Nginx configuration
sudo nano /etc/nginx/sites-available/guretxokoa
```

Add this **initial** configuration. Replace `elkartea.eus` with your real apex domain (same value as `TENANT_APEX_DOMAIN` / `VITE_TENANT_APEX_DOMAIN` in `.env`):

```nginx
# HTTP only — add HTTPS after certificates exist (see SSL section)
server {
    listen 80;
    server_name elkartea.eus www.elkartea.eus *.elkartea.eus;

    # Application proxy — Host must reach Node for tenant resolution
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

Society URLs use `**https://{subdomain}.{TENANT_APEX_DOMAIN}`**. A single certificate obtained with HTTP-01 for **only** the apex and `www` does **not** cover arbitrary subdomains. For production with tenant hosts, obtain a certificate that includes `***.your-domain.com`** (wildcard) using Let’s Encrypt **DNS-01**, or use your DNS provider’s **certbot DNS plugin** (fewer manual TXT steps).

```bash
# Install Certbot and the nginx plugin (plugin used when you choose --nginx below)
sudo apt install -y certbot python3-certbot-nginx
```

### Obtain a wildcard certificate (recommended for tenant subdomains)

Use the same apex label as in `.env` (`TENANT_APEX_DOMAIN`). Example domain: `elkartea.eus`.

```bash
sudo certbot certonly --manual --preferred-challenges dns \
  -d "elkartea.eus" \
  -d "*.elkartea.eus"
```

Certbot will print a **TXT** record name (usually `_acme-challenge.elkartea.eus`) and a **value**. Add it at your DNS provider, verify it is visible in the public DNS, then press Enter in the terminal. If certbot asks for a second TXT record, add that one too (some providers merge challenges on the same name — follow certbot’s prompts).

**New value every time:** Each Certbot run (including after a failed attempt) issues a **new** challenge string. You must set the TXT record to the **current** value Certbot shows; **do not reuse** an old token. If you already pressed Enter and validation failed, run Certbot again and update DNS to match the **new** output.

**Verify before Enter** (replace `elkartea.eus` with your apex):

```bash
dig TXT _acme-challenge.elkartea.eus +short
```

Continue only when the output includes the exact string Certbot gave you (propagation can take from seconds to many minutes).

After success, certificates are under:

```text
/etc/letsencrypt/live/elkartea.eus/fullchain.pem
/etc/letsencrypt/live/elkartea.eus/privkey.pem
```

Add an **HTTPS** `server` block (and keep HTTP on port 80 for redirects and renewal). Edit the site file:

```bash
sudo nano /etc/nginx/sites-available/guretxokoa
```

Append or merge the following (same `server_name` list and `proxy_*` headers as the HTTP server; replace `elkartea.eus` if needed):

```nginx
server {
    listen 443 ssl http2;
    server_name elkartea.eus www.elkartea.eus *.elkartea.eus;

    ssl_certificate     /etc/letsencrypt/live/elkartea.eus/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/elkartea.eus/privkey.pem;

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

server {
    listen 80;
    server_name elkartea.eus www.elkartea.eus *.elkartea.eus;
    return 301 https://$host$request_uri;
}
```

The site file should contain **only** these two `server` blocks for this vhost: `listen 443` (proxy) and `listen 80` (redirect). Delete the earlier **HTTP-only** `server { listen 80; ... proxy_pass ... }` block so nginx does not define port 80 twice. Then test and reload:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

```bash
curl -sS "https://elkartea.eus/api" | head -c 200
curl -sS "https://txokoa.elkartea.eus/api" | head -c 200
```

(The second URL succeeds only if DNS points `txokoa.elkartea.eus` to this server and that society’s subdomain is configured in the backoffice.)

### Optional: apex + `www` only via `certbot --nginx` (HTTP-01)

If you truly do **not** need arbitrary subdomains over HTTPS, you can use the automated nginx plugin **after** the HTTP-only config validates:

```bash
sudo certbot --nginx -d elkartea.eus -d www.elkartea.eus
```

This does **not** issue `*.elkartea.eus`; tenant subdomains would need separate certificates (e.g. repeat certbot with `-d txokoa.elkartea.eus` for each host) or switch to wildcard DNS-01.

### Renewal

Let’s Encrypt **does not keep the same TXT token forever**. On each **renewal**, the CA performs a **new** DNS challenge: you must publish the **new** `_acme-challenge` value(s) again (same hostname, updated content), unless renewal is fully automated.

- `**certbot renew`** with `**--manual**`: not suitable for unattended cron — renewal will stop and wait for you to change DNS, or fail. Use a **DNS plugin** (or auth hook) for your provider so Certbot can set TXT records itself.
- **HTTP-01** (`certbot --nginx`): renewals usually need **no** DNS TXT changes.

```bash
sudo certbot renew --dry-run
```

```bash
sudo crontab -e
```

Add (only meaningful when renewal does not require interactive DNS; with manual DNS-01, fix automation first):

```
0 12 * * * /usr/bin/certbot renew --quiet --post-hook "systemctl reload nginx"
```

After SSL is working, you can add extra **security headers** in the `listen 443` server block if you want (e.g. `Strict-Transport-Security`, `X-Frame-Options`).

## Troubleshooting

### Common Issues

1. **Database Connection Error**

```bash
 # Check PostgreSQL status
 sudo systemctl status postgresql

 # Check if database exists
 sudo -u postgres psql -l
```

1. **Permission Denied**

```bash
sudo chown -R "$USER:$USER" /home/your_username/testapp001-app
chmod +x /home/your_username/testapp001-app/script/*.ts
```

1. **Port Already in Use**

```bash
 # Check what's using the default port (5000)
 sudo lsof -i :5000

 # Kill the process if needed
 sudo kill -9 <PID>
```

1. **Node.js Version Issues**

```bash
 # Check Node.js version
 node --version

 # Must be v24.x or higher (project requires >=24.0.0)
```

1. **Certbot / nginx: `cannot load certificate ... fullchain.pem` / `nginx -t` fails**

This happens when the site config references `/etc/letsencrypt/live/<domain>/fullchain.pem` (and `privkey.pem`) **before** those files exist. The `certbot --nginx` plugin always runs `nginx -t`, so it cannot recover until nginx config is valid again.

**Fix:**

1. Edit the site file under `/etc/nginx/sites-available/` (and check `sites-enabled/` for duplicates).
2. **Remove or comment out** the entire `server { listen 443 ssl ... }` block, and any `ssl_certificate` / `ssl_certificate_key` directives.
3. Ensure **port 80** serves your app with `proxy_pass` (see [Nginx Reverse Proxy](#nginx-reverse-proxy-recommended) — HTTP-only starter config). Do **not** use `return 301 https://...` on port 80 until after the first successful certbot run (otherwise Let’s Encrypt HTTP-01 validation can break).
4. Run:

```bash
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d elkartea.eus -d www.elkartea.eus
```

1. After certbot succeeds, reload nginx if needed: `sudo systemctl reload nginx`.

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


For production updates, use `**pnpm db:push`** or `**pnpm db:migrate\*\`*. Never use `db:reset` on a production database.

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