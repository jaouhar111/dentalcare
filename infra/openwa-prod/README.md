# OpenWA — production deployment runbook

This folder is everything you need to put OpenWA online behind HTTPS on
a small VPS. DentalCare stays on Vercel; only the WhatsApp gateway
moves here.

```
                       ┌────────────────────────────────┐
patient WhatsApp ◄────►│ OpenWA VPS (Hetzner CX11)      │
                       │  docker compose                │
                       │  ├─ nginx :443 (Let's Encrypt) │
                       │  ├─ openwa :2785 (loopback)    │
                       │  └─ certbot (renewal sidecar)  │
                       └──────────────┬─────────────────┘
                                      │ HTTPS REST + Webhook
                                      ▼
                       ┌────────────────────────────────┐
dentiste browser ◄────►│  DentalCare (Vercel)           │
                       │  Next.js + Neon Postgres       │
                       └────────────────────────────────┘
```

## Prerequisites

| | |
|---|---|
| **VPS** | Hetzner Cloud CX11 (€4.51/mo, Falkenstein) — 1 vCPU, 2 GB RAM, 20 GB SSD. Ubuntu 24.04 LTS. |
| **Domain** | One subdomain pointing at the VPS — e.g. `openwa.dentalcare.ma`. A → VPS public IPv4 + AAAA → IPv6 if you have one. |
| **Local CLI** | `ssh`, `scp`, and a sane git CLI. Nothing else. |

Hetzner is the easiest stack:
1. Account at https://hetzner.cloud, add a card, fund €5.
2. Create a CX11 in Falkenstein with Ubuntu 24.04, your SSH key.
3. Note the public IPv4 in the dashboard.
4. Set the DNS record at your registrar: `openwa A <IPv4>`.

DNS propagation should be < 15 min. Test with `dig openwa.dentalcare.ma`.

## Step 1 — prepare the VPS

SSH in as root then create a dedicated user (running OpenWA as root is
asking for trouble):

```bash
ssh root@<VPS-IP>
adduser --disabled-password --gecos "" openwa
usermod -aG sudo,docker openwa
mkdir -p /home/openwa/.ssh
cp /root/.ssh/authorized_keys /home/openwa/.ssh/
chown -R openwa:openwa /home/openwa/.ssh
chmod 700 /home/openwa/.ssh
```

Install Docker (official one-liner — keep Ubuntu's `docker.io` away, it
ships an outdated version):

```bash
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker
```

Lock the firewall down to what we actually need:

```bash
ufw allow ssh
ufw allow 80
ufw allow 443
ufw --force enable
```

Log out and switch to the new user for the rest:

```bash
exit
ssh openwa@<VPS-IP>
```

## Step 2 — pull this runbook to the VPS

```bash
mkdir -p ~/openwa
cd ~/openwa
# Easiest: copy this folder via scp from your laptop:
#   scp -r infra/openwa-prod openwa@<VPS-IP>:~/openwa/
# Or check out the dentalcare repo if you've added SSH keys to it.
```

Copy the env template and fill in `ALLOWED_CIDRS`:

```bash
cp .env.example .env
nano .env   # set ALLOWED_CIDRS to Vercel ranges + your office
```

## Step 3 — issue the TLS certificate

We use the webroot flow so nginx can keep running during renewals. The
trick: nginx needs the cert *before* it can start in TLS mode, so we
first bring everything up minus the TLS server block, request the cert,
then enable the real config.

Bootstrap with a temporary HTTP-only nginx:

```bash
mkdir -p certbot-www certs nginx/conf.d
cat > nginx/conf.d/openwa.conf.tmp <<'EOF'
server {
  listen 80;
  server_name openwa.dentalcare.ma;
  location /.well-known/acme-challenge/ { root /var/www/certbot; }
  location / { return 200 "bootstrapping...\n"; }
}
EOF
mv nginx/conf.d/openwa.conf nginx/conf.d/openwa.conf.real
mv nginx/conf.d/openwa.conf.tmp nginx/conf.d/openwa.conf
docker compose up -d nginx openwa
```

Wait ~30 seconds for nginx to boot, then issue the cert:

```bash
docker compose run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  --email you@dentalcare.ma \
  --agree-tos --no-eff-email \
  -d openwa.dentalcare.ma
```

You should see `Successfully received certificate.` Now swap the real
config back in and reload:

```bash
mv nginx/conf.d/openwa.conf nginx/conf.d/openwa.conf.bootstrap
mv nginx/conf.d/openwa.conf.real nginx/conf.d/openwa.conf
docker compose restart nginx
```

Verify TLS:

```bash
curl -I https://openwa.dentalcare.ma/__healthz
# expect: HTTP/2 200, content-type text/plain
```

## Step 4 — rotate the default API key

The OpenWA container ships with a **dev bootstrap key** (`dev-admin-key`).
**Rotate it before anything goes live.** Inside the container:

```bash
# Generate a 32-byte hex secret on your laptop:
openssl rand -hex 32
# Copy the output — call it $NEW_KEY for the next commands.

# Provision the new admin key via the OpenWA API:
curl -X POST https://openwa.dentalcare.ma/api/auth/api-keys \
  -H "X-API-Key: dev-admin-key" \
  -H "Content-Type: application/json" \
  -d '{ "name": "vercel-prod", "scopes": ["*"] }'
# Expect: { "id": "...", "key": "<NEW_KEY_FROM_OPENWA>" }
# Save that key — it's only shown once.

# Revoke the dev key so it can never be used again:
curl -X POST https://openwa.dentalcare.ma/api/auth/api-keys/<dev-key-id>/revoke \
  -H "X-API-Key: <NEW_KEY>"
```

## Step 5 — wire DentalCare on Vercel

In the Vercel dashboard (`Settings → Environment Variables`), add three
variables to **Production**:

| Key | Value |
|---|---|
| `OPENWA_BASE_URL` | `https://openwa.dentalcare.ma` |
| `OPENWA_API_KEY` | the key you provisioned in step 4 |
| `OPENWA_WEBHOOK_SECRET` | `openssl rand -hex 32` output — pick a fresh one |

Then trigger a fresh production deployment so the env vars get baked in.
The first cabinet that scans a QR will create its session **on the VPS**;
the webhook posts back to `https://app.dentalcare.ma/api/webhooks/whatsapp`
(or whatever your prod URL is) automatically because `startOpenwaConnection`
registers the webhook with the right URL when env.NEXTAUTH_URL is set.

## Step 6 — register the webhook (one-time per session)

Currently `startOpenwaConnection` creates the OpenWA session but doesn't
automatically register the webhook. That's a TODO for the next sprint;
in the meantime, register it manually the first time you onboard a
real cabinet:

```bash
SESSION_ID=<uuid from the cabinet's /settings/ai-receptionist panel>
curl -X POST https://openwa.dentalcare.ma/api/sessions/$SESSION_ID/webhooks \
  -H "X-API-Key: <OPENWA_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://app.dentalcare.ma/api/webhooks/whatsapp",
    "events": ["message.received"],
    "secret": "<OPENWA_WEBHOOK_SECRET>"
  }'
```

## Operations cheatsheet

| What | Where |
|---|---|
| OpenWA logs | `docker compose logs -f openwa` |
| nginx access logs | `docker compose logs -f nginx` |
| Cert renewal next-run | certbot renews twice/day automatically |
| Backup of sessions | `tar -czf openwa-backup-$(date +%F).tgz ./data` — keep at least 7 days |
| Health | `curl https://openwa.dentalcare.ma/__healthz` should return `ok` |
| Sessions list | `curl -H "X-API-Key: $KEY" https://openwa.dentalcare.ma/api/sessions` |
| Rotate keys | Repeat step 4 every 90 days, redeploy Vercel with the new key |

## Costs

| | |
|---|---|
| Hetzner CX11 | €4.51/mo |
| Domain (.ma, AnNIC) | ~80 MAD/year ≈ €0.6/mo |
| Let's Encrypt | free |
| Backups (object storage, optional) | ~€0.50/mo for 10 GB |
| **Total** | **~€5.5/mo** before the first paying client |

When you cross ~30 paying cabinets, bump to CX21 (€7/mo, 2 vCPU / 4 GB)
because Puppeteer eats 200-300 MB RAM per session.

## What's NOT in this runbook

- **PostgreSQL migration** — fine to stay on SQLite until ~50 sessions.
- **Multi-region failover** — Casablanca traffic from a single Falkenstein
  node is < 50 ms; multi-region is over-engineering at this stage.
- **Monitoring / Sentry** — wire DentalCare's existing Sentry to the
  webhook handler, the gateway side is best monitored with UptimeRobot.
