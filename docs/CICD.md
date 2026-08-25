# Business Application — CI/CD (GitHub Actions)

Push to `main` → **build**, **VPS backend deploy (PM2)**, **cPanel frontend FTP**.

Manual: GitHub → **Actions** → **Deploy** → **Run workflow**.

Same pattern as `swift-finance`.

---

## Architecture

| Part | Where | Example URL |
|------|--------|-------------|
| Frontend | cPanel (static) | `https://business.swiftgd.com` |
| Backend | VPS + PM2 + Nginx | `https://baapi.swiftgd.com` → `127.0.0.1:5003` |
| MySQL | VPS localhost | `business_management` |

Deploy path on VPS: **`/var/www/business-application`** (you already created this).

---

## VPS — next steps (you are here)

Directory `/var/www/business-application/` exists. Do these **in order** on the VPS as root:

### 1) Folders

```bash
mkdir -p /var/www/business-application/{backend,deploy}
```

### 2) MySQL database

```bash
# Edit password inside the SQL first, or run interactively:
mysql -u root -p <<'SQL'
CREATE DATABASE IF NOT EXISTS business_management CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'business_app'@'localhost' IDENTIFIED BY 'CHANGE_ME_STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON business_management.* TO 'business_app'@'localhost';
FLUSH PRIVILEGES;
SQL
```

### 3) Backend `.env` (CI never overwrites this)

```bash
nano /var/www/business-application/backend/.env
```

Paste from `backend/.env.production.example` in the repo, then set real:

- `DB_PASSWORD`
- `JWT_SECRET` (long random)
- `CORS_ORIGIN` = your real frontend HTTPS URL
- `COOKIE_DOMAIN=.swiftgd.com` (if both front + API are under swiftgd.com)
- `PORT=5003` (avoids clash with swift-finance on 5002)

### 4) First code copy (manual once, before GitHub Actions)

From your PC (or after you push workflows, Actions will rsync):

```bash
# On VPS — optional: clone once
cd /var/www/business-application
# Or wait for first GitHub Deploy job to rsync backend/
```

Then:

```bash
cd /var/www/business-application/backend
npm ci --omit=dev
```

### 5) Start PM2

```bash
# ecosystem file must exist at /var/www/business-application/deploy/ecosystem.config.cjs
# (comes from repo via rsync, or copy manually once)
cd /var/www/business-application
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 status
curl -s http://127.0.0.1:5003/api/health
```

### 6) Firewall (if using IP:port temporarily)

```bash
# firewalld example (CWP often uses firewalld)
firewall-cmd --permanent --add-port=5003/tcp
firewall-cmd --reload
```

### 7) API subdomain + Nginx (recommended)

1. DNS A record: `baapi.swiftgd.com` → VPS IP  
2. Use `deploy/nginx-api.conf.example` as proxy to `127.0.0.1:5003`  
3. SSL (certbot or CWP SSL) for `baapi.swiftgd.com`  
4. Test: `curl https://baapi.swiftgd.com/api/health`

### 8) Deploy SSH key for GitHub Actions

On your PC:

```bash
ssh-keygen -t ed25519 -C "github-actions-business-application" -f ~/.ssh/business_app_deploy -N ""
```

- Public key → VPS `~/.ssh/authorized_keys` (root or deploy user)
- Private key → GitHub secret `VPS_SSH_KEY`

```bash
# Test from PC
ssh -i ~/.ssh/business_app_deploy root@YOUR_VPS_IP "pm2 status"
```

---

## GitHub repo setup

Repo: `https://github.com/yumxbutt/business-application`

### Variables (Settings → Secrets and variables → Actions → Variables)

| Name | Example |
|------|---------|
| `VITE_API_BASE_URL` | `https://baapi.swiftgd.com/api` |
| `VPS_DEPLOY_PATH` | `/var/www/business-application` |
| `FTP_SERVER_DIR` | `/business.swiftgd.com/` (or `/` if FTP is chrooted to that site) |
| `FTP_PROTOCOL` | `ftp` (or `ftps`) |
| `LIVE_SITE_URL` | `https://business.swiftgd.com` |

### Secrets

| Secret | Value |
|--------|--------|
| `VPS_SSH_KEY` | Private key contents |
| `VPS_HOST` | VPS IP |
| `VPS_USER` | `root` (or your SSH user) |
| `FTP_SERVER` | hostname only, e.g. `ftp.swiftgd.com` |
| `FTP_USERNAME` | cPanel FTP user |
| `FTP_PASSWORD` | cPanel FTP password |

---

## cPanel frontend

1. Create subdomain / domain docroot (e.g. `business.swiftgd.com`)
2. Point DNS to cPanel
3. Set `FTP_SERVER_DIR` to that docroot (from FTP account root)
4. After Deploy workflow: open site, hard refresh (Ctrl+Shift+R)

---

## First automated deploy

1. Commit & push workflows to `main` (or run **Deploy** manually)
2. Confirm Actions: Build + Deploy API + Deploy frontend all green
3. Check:
   - `curl https://baapi.swiftgd.com/api/health`
   - Frontend login on live URL

---

## Notes

- `.env` on VPS is **never** replaced by CI
- Tables/seeds run on API start (`bootstrap.js`)
- Port **5003** keeps this app separate from swift-finance (**5002**)
- Change domains later → update GitHub `VITE_API_BASE_URL` + VPS `.env` `CORS_ORIGIN` / Nginx `server_name`
