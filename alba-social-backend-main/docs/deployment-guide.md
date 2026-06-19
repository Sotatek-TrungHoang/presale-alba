# Alba Social Backend - Deployment Guide

## Prerequisites

- Node.js 18+ and npm 9+
- PostgreSQL 14+
- Docker (for containerized deployment)
- Git
- Firebase project with admin credentials
- Stripe account with API keys
- AWS account with S3 bucket (for image storage)
- Environment variables configured

---

## Pre-Deployment Checklist

- [ ] All environment variables set and validated
- [ ] Database migrations applied (`npx prisma migrate deploy`)
- [ ] Prisma client generated (`npx prisma generate`)
- [ ] Tests passing (`npm run test`, `npm run test:e2e`)
- [ ] Linting passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] Stripe webhooks configured (see STRIPE_WEBHOOKS.md)
- [ ] Firebase credentials validated
- [ ] S3 bucket and IAM permissions verified
- [ ] Sentry DSN configured (optional)

---

## Environment Variables

Create a `.env` file in the root directory (never commit to version control):

### Database
```env
DATABASE_URL="postgresql://user:password@localhost:5432/alba_db?schema=public"
```

### Firebase Authentication
```env
FIREBASE_PROJECT_ID="your-project-id"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk@your-project.iam.gserviceaccount.com"
```

### Stripe
```env
STRIPE_SECRET_KEY="sk_live_..." or "sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
WEBHOOK_BASE_URL="https://api.yourdomain.com"
```

### AWS S3
```env
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="your-access-key"
AWS_SECRET_ACCESS_KEY="your-secret-key"
S3_BUCKET_NAME="alba-images-prod"
```

### Google Maps
```env
GOOGLE_MAPS_API_KEY="your-api-key"
```

### Mapbox (Optional)
```env
MAPBOX_ACCESS_TOKEN="your-access-token"
```

### Expo Push Notifications
```env
EXPO_ACCESS_TOKEN="your-expo-access-token"
```

### Sentry Error Tracking (Optional)
```env
SENTRY_DSN="https://<key>@<organization>.ingest.sentry.io/<project-id>"
SENTRY_DEBUG="false"  # Set to true in development to test
```

### Application
```env
PORT=3000
NODE_ENV="production"  # or "development"
```

---

## Local Development Setup

### 1. Clone Repository
```bash
git clone <repository-url>
cd alba-social-backend
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment
```bash
cp temp.env .env  # Copy example env (adjust values)
# Edit .env with your local settings
```

### 4. Start PostgreSQL
```bash
# Using Docker
docker run --name alba-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=alba_db \
  -p 5432:5432 \
  -d postgres:14

# Or using local PostgreSQL
createdb alba_db
```

### 5. Generate Prisma Client
```bash
npx prisma generate
```

### 6. Run Database Migrations
```bash
npx prisma migrate deploy
```

### 7. Start Development Server
```bash
npm run start:dev
```

Server runs on `http://localhost:3000`  
Swagger API docs at `http://localhost:3000/api`

---

## Building for Production

### 1. Validate Build
```bash
npm run lint
npm run test
npm run test:cov  # Check coverage
npm run test:e2e
```

### 2. Build Application
```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` directory.

### 3. Verify Build Output
```bash
ls -la dist/
# Should contain compiled JS files
```

---

## Docker Deployment

### 1. Build Docker Image
```bash
docker build -t alba-backend:latest .
```

### 2. Run Container Locally
```bash
docker run --name alba-backend \
  -e DATABASE_URL="postgresql://user:password@host:5432/alba_db" \
  -e NODE_ENV="production" \
  -e FIREBASE_PROJECT_ID="your-project-id" \
  -e FIREBASE_PRIVATE_KEY="..." \
  -e STRIPE_SECRET_KEY="..." \
  -p 3000:3000 \
  alba-backend:latest
```

Or use provided script:
```bash
./docker-run.sh
```

### 3. Docker Compose (for local development with PostgreSQL)
```yaml
version: '3.8'
services:
  db:
    image: postgres:14
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: alba_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  app:
    build: .
    depends_on:
      - db
    environment:
      DATABASE_URL: "postgresql://postgres:postgres@db:5432/alba_db"
      NODE_ENV: "development"
      # ... other env vars
    ports:
      - "3000:3000"
    volumes:
      - .:/app
    command: npm run start:dev

volumes:
  postgres_data:
```

Run with:
```bash
docker-compose up
```

---

## Production Deployment

### Option 1: Heroku

#### 1. Create Heroku App
```bash
heroku create alba-social-backend
heroku config:set NODE_ENV=production
```

#### 2. Add PostgreSQL Add-on
```bash
heroku addons:create heroku-postgresql:standard-0
```

#### 3. Set Environment Variables
```bash
heroku config:set DATABASE_URL="postgresql://..."
heroku config:set FIREBASE_PROJECT_ID="..."
heroku config:set FIREBASE_PRIVATE_KEY="..."
heroku config:set STRIPE_SECRET_KEY="..."
# ... other env vars
```

#### 4. Deploy
```bash
git push heroku main
```

Heroku automatically builds and runs the application.

#### 5. Run Migrations
```bash
heroku run npx prisma migrate deploy
```

### Option 2: AWS EC2

#### 1. Launch EC2 Instance
```bash
# Ubuntu 20.04 LTS, t3.medium or larger
# Security group: Allow ports 80, 443, 3000 (SSH 22)
```

#### 2. Install Dependencies
```bash
ssh ec2-user@your-instance

# Update system
sudo apt-get update
sudo apt-get upgrade -y

# Install Node.js 18
curl -sL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL client
sudo apt-get install -y postgresql-client

# Install Docker (optional)
sudo apt-get install -y docker.io

# Install Nginx (for reverse proxy)
sudo apt-get install -y nginx
```

#### 3. Clone and Setup
```bash
cd /opt
sudo git clone <repository-url> alba-backend
cd alba-backend
sudo npm install
sudo npm run build
```

#### 4. Create systemd Service
```bash
sudo tee /etc/systemd/system/alba-backend.service <<EOF
[Unit]
Description=Alba Social Backend
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/alba-backend
ExecStart=/usr/bin/npm run start:prod
Restart=always
RestartSec=10

Environment="NODE_ENV=production"
Environment="DATABASE_URL=postgresql://..."
Environment="FIREBASE_PROJECT_ID=..."
# ... other env vars

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable alba-backend
sudo systemctl start alba-backend
```

#### 5. Configure Nginx Reverse Proxy
```bash
sudo tee /etc/nginx/sites-available/alba-backend <<EOF
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        
        # For Stripe webhooks (raw body)
        proxy_request_buffering off;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/alba-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 6. Setup SSL (Let's Encrypt)
```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

#### 7. Setup PostgreSQL Connection
```bash
# If using RDS:
export DATABASE_URL="postgresql://user:password@rds-instance.amazonaws.com:5432/alba_db"

# Test connection
psql $DATABASE_URL -c "SELECT 1;"
```

#### 8. Run Migrations
```bash
cd /opt/alba-backend
DATABASE_URL="..." npx prisma migrate deploy
```

### Option 3: Google Cloud Run

#### 1. Create Cloud Run Service
```bash
gcloud run create alba-backend \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --port 3000
```

#### 2. Set Environment Variables
```bash
gcloud run services update alba-backend \
  --region us-central1 \
  --set-env-vars NODE_ENV=production \
  --set-env-vars DATABASE_URL="postgresql://..." \
  --set-env-vars FIREBASE_PROJECT_ID="..." \
  # ... other env vars
```

#### 3. Setup Cloud SQL Proxy
```bash
# Enable Cloud SQL Admin API
gcloud services enable sqladmin.googleapis.com

# Create Cloud SQL instance
gcloud sql instances create alba-postgres \
  --database-version POSTGRES_14 \
  --tier db-f1-micro \
  --region us-central1

# Connect
gcloud sql databases create alba_db --instance alba-postgres

# Update Cloud Run to use Cloud SQL
gcloud run services update alba-backend \
  --add-cloudsql-instances PROJECT_ID:us-central1:alba-postgres
```

#### 4. Run Migrations
```bash
gcloud sql connect alba-postgres --user postgres

CREATE DATABASE alba_db;
```

Then deploy:
```bash
gcloud run deploy alba-backend \
  --source . \
  --region us-central1
```

---

## Database Migration Strategy

### First Deployment
```bash
# Apply all pending migrations
npx prisma migrate deploy

# Verify schema
npx prisma studio
```

### Rolling Updates
```bash
# Create new migration
npx prisma migrate dev --name your_migration_name

# Review generated migration file
cat prisma/migrations/<timestamp>_<name>/migration.sql

# Test locally
npm run test

# Deploy (CI/CD handles prisma migrate deploy)
git push origin main
```

### Rollback (if needed)
```bash
# Prisma doesn't auto-rollback. Manual steps:
# 1. Revert code to previous version
# 2. Manually revert database changes or restore backup
# 3. Redeploy previous version
```

---

## Post-Deployment

### 1. Verify Application Health
```bash
# Check health endpoint
curl https://api.yourdomain.com/health

# Check Swagger API docs
curl https://api.yourdomain.com/api

# Test a simple endpoint
curl -X GET https://api.yourdomain.com/users \
  -H "Authorization: Bearer <valid-token>"
```

### 2. Configure Monitoring
```bash
# Sentry dashboard
https://sentry.io/organizations/your-org/issues/

# CloudWatch (AWS)
aws logs tail /aws/lambda/alba-backend --follow

# Vercel/Heroku logs
heroku logs --tail
```

### 3. Setup Stripe Webhooks
```bash
# Stripe Dashboard → Developers → Webhooks
# Add endpoint: https://api.yourdomain.com/stripe/webhook/payment
# Add endpoint: https://api.yourdomain.com/stripe/webhook/account

# Select events to subscribe to:
# - payment_intent.succeeded
# - charge.refunded
# - transfer.created
# - payout.paid
# - account.updated
```

### 4. Test Stripe Webhooks
```bash
# From Stripe Dashboard, click "Send test webhook"
# Monitor logs: should see webhook processing logs

# Or test locally using stripe-cli
stripe listen --forward-to localhost:3000/stripe/webhook/payment
stripe trigger payment_intent.succeeded
```

### 5. Verify Firebase Authentication
```bash
# Test token validation
curl -X GET https://api.yourdomain.com/users/me \
  -H "Authorization: Bearer <firebase-id-token>"

# Should return 200 with user details
```

### 6. Setup Cron Jobs

#### Scheduled Notifications
```bash
# Setup cron to run notification dispatcher
# Daily at 9 AM UTC

# Option 1: systemd timer (Linux)
sudo tee /etc/systemd/system/alba-notifications.timer <<EOF
[Unit]
Description=Alba Scheduled Notifications

[Timer]
OnCalendar=daily
OnCalendar=*-*-* 09:00:00

[Install]
WantedBy=timers.target
EOF

# Option 2: AWS EventBridge
# Create rule: cron(0 9 * * ? *)
# Target: Lambda → invoke notification runner

# Option 3: Heroku Scheduler
heroku addons:create scheduler:standard
heroku scheduler:jobs
# Add job: npm run cron:notifications
# Frequency: Daily at 9 AM
```

---

## Monitoring & Logging

### Application Logs
```bash
# Heroku
heroku logs --tail

# EC2 systemd
sudo journalctl -u alba-backend -f

# Docker
docker logs -f alba-backend

# Google Cloud Run
gcloud run logs read alba-backend --follow
```

### Database Performance
```bash
# Slow query logs (PostgreSQL)
postgres=# SET log_min_duration_statement = 1000; -- 1 second

# Analyze slow queries
EXPLAIN ANALYZE SELECT * FROM games WHERE status = 'READY' ...;

# Check indexes
\d games
```

### Error Tracking (Sentry)
- Visit https://sentry.io/organizations/your-org/
- Set alerts for error spikes
- Configure integrations (Slack, email)

---

## Scaling & Optimization

### Database Scaling
```bash
# Horizontal scaling (read replicas)
# AWS RDS: Create read replica
# GCP Cloud SQL: Create read replica
# PostgreSQL: Set up streaming replication

# Vertical scaling (larger instance)
# AWS RDS: Modify instance class (blue-green deployment)
# GCP Cloud SQL: Increase machine type

# Connection pooling
# PgBouncer or native pooling in Prisma
DATABASE_URL="postgresql://...?schema=public&pgbouncer=true"
```

### Application Scaling
```bash
# Horizontal: Load balancer + multiple app instances
# - Heroku: scale dynos
# - EC2: Auto Scaling Group + ELB
# - GCP Cloud Run: Automatic scaling (concurrent requests)

# Vertical: Increase instance size
# - Node.js can handle 10k+ concurrent connections per instance

# Caching
# Redis for session/data caching
# Cloudflare for API response caching
```

### API Performance
```bash
# Monitor response times
# Optimize slow endpoints (database indexes, query optimization)
# Implement pagination (skip/take)
# Use HTTP caching headers (ETag, Cache-Control)
```

---

## Disaster Recovery

### Database Backup
```bash
# AWS RDS: Automated backups (35 days default)
# GCP Cloud SQL: Automated backups (7 days default)
# Manual backup:
pg_dump -Fc $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Restore from backup
pg_restore -d alba_db backup-20260619.sql
```

### Application Failover
```bash
# Multi-region deployment
# - Heroku: Multiple apps in different regions
# - AWS: Lambda + API Gateway in multiple regions
# - GCP: Cloud Run in multiple regions

# Database failover
# - RDS: Multi-AZ (automatic failover)
# - Cloud SQL: High availability (regional redundancy)
```

### Secrets Recovery
```bash
# Store secrets in secure vault
# - AWS Secrets Manager
# - GCP Secret Manager
# - HashiCorp Vault

# Audit access logs
# - Monitor who accessed secrets
# - Set rotation policies (every 90 days)
```

---

## Security Hardening

### HTTPS/TLS
```bash
# Enforce HTTPS
# - Heroku: Automatic
# - EC2 + Nginx: Let's Encrypt + certbot
# - GCP Cloud Run: Automatic

# Use TLS 1.2+
# nginx.conf: ssl_protocols TLSv1.2 TLSv1.3;
```

### API Security
```bash
# Rate limiting (optional, implement in Guard)
# CORS restrictions
# Input validation (already in DTOs)
# HTTPS only cookies
# API versioning (/v1/*)
```

### Database Security
```bash
# Enforce SSL for database connections
# DATABASE_URL with ?sslmode=require

# Restrict database access
# - Firewall rules: only app servers
# - IAM roles: minimal permissions

# Encrypt data at rest
# - AWS RDS: Enable encryption
# - GCP Cloud SQL: Enable encryption
```

### Secrets Management
```bash
# Never commit .env files
# Use environment variables from deployment platform
# Rotate credentials regularly
# Audit secret access

# .gitignore
.env
.env.local
.env.*.local
```

---

## Common Issues & Troubleshooting

### Database Connection Errors
```bash
# Verify DATABASE_URL
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1;"

# Check Prisma client
npx prisma validate

# Re-generate Prisma client
npx prisma generate
```

### Port Already in Use
```bash
# Find process on port 3000
lsof -i :3000

# Kill process
kill -9 <PID>

# Or use different port
PORT=3001 npm run start:prod
```

### Stripe Webhook Signature Errors
```bash
# Verify webhook secret
echo $STRIPE_WEBHOOK_SECRET

# Check raw body parsing is enabled (main.ts)
# rawBody: true ✓

# Test webhook locally
stripe listen --forward-to localhost:3000/stripe/webhook/payment
```

### Firebase Authentication Failures
```bash
# Verify Firebase credentials
echo $FIREBASE_PRIVATE_KEY

# Check Firebase project is active
# Visit Firebase Console → Project Settings

# Re-download service account JSON
# Firebase Console → Service Accounts → Generate New Private Key
```

---

## Deployment Checklist Summary

- [ ] Environment variables validated
- [ ] Database migrations applied
- [ ] Tests passing (unit, E2E, coverage)
- [ ] Build successful
- [ ] Docker image builds (if using)
- [ ] Application starts without errors
- [ ] Swagger API accessible
- [ ] Firebase auth working
- [ ] Stripe webhooks configured
- [ ] S3 bucket accessible
- [ ] Sentry monitoring active
- [ ] Database backups configured
- [ ] SSL certificate valid
- [ ] Rate limiting configured (optional)
- [ ] Logging configured
- [ ] Health checks passing
- [ ] Performance metrics monitored
- [ ] Disaster recovery plan documented
- [ ] Team trained on deployment process
- [ ] Post-deployment testing completed

---

## Support & Reference

- **NestJS Deployment:** https://docs.nestjs.com/deployment
- **Prisma Deployment:** https://www.prisma.io/docs/guides/deployment
- **Stripe Webhooks:** https://stripe.com/docs/webhooks (see STRIPE_WEBHOOKS.md)
- **Firebase:** https://firebase.google.com/docs/admin/setup
- **PostgreSQL:** https://www.postgresql.org/docs/
