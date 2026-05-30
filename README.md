# CDC Export System

A containerized Change Data Capture (CDC) data export system using Node.js, Express, and PostgreSQL.

---

## Prerequisites

- Docker Desktop installed and running
- Git Bash or any terminal

---

## Setup & Run

### Step 1 — Clone the repo

```bash
git clone <your-repo-url>
cd cdc-export-system
```

### Step 2 — Copy environment file

```bash
cp .env.example .env
```

### Step 3 — Start all services

```bash
docker-compose up --build
```

Wait until you see this line in the logs:
```
app-1 | {"level":"info","event":"server_started","port":"8080"}
```

### Step 4 — Confirm it is running (open a second terminal)

```bash
curl http://localhost:8080/health
```

Expected:
```json
{"status":"ok","timestamp":"2026-05-29T07:00:00.000Z"}
```

---

## Verify Database Seeding

```bash
# Total users (must be >= 100,000)
docker-compose exec db psql -U user -d mydatabase -c "SELECT COUNT(*) FROM users;"

# Soft-deleted users (must be >= 1,000)
docker-compose exec db psql -U user -d mydatabase -c "SELECT COUNT(*) FROM users WHERE is_deleted = TRUE;"

# Date range (must span 7+ days)
docker-compose exec db psql -U user -d mydatabase -c "SELECT MIN(updated_at), MAX(updated_at) FROM users;"
```

---

## API Commands

### Full Export

```bash
curl -X POST http://localhost:8080/exports/full \
  -H "X-Consumer-ID: consumer-1"
```

Wait 25 seconds then check the file:
```bash
ls output/
```

### Check Watermark

```bash
curl http://localhost:8080/exports/watermark \
  -H "X-Consumer-ID: consumer-1"
```

### Incremental Export

First simulate some changes in the DB:
```bash
docker-compose exec db psql -U user -d mydatabase \
  -c "UPDATE users SET updated_at = NOW() WHERE id IN (1,2,3);"
```

Then run incremental export:
```bash
curl -X POST http://localhost:8080/exports/incremental \
  -H "X-Consumer-ID: consumer-1"
```

Wait 5 seconds then check file:
```bash
ls output/
```

### Delta Export

First simulate INSERT, UPDATE, and DELETE:
```bash
# INSERT
docker-compose exec db psql -U user -d mydatabase \
  -c "INSERT INTO users (name, email, created_at, updated_at) VALUES ('New User', 'new@test.com', NOW(), NOW());"

# UPDATE
docker-compose exec db psql -U user -d mydatabase \
  -c "UPDATE users SET updated_at = NOW() WHERE id = 50;"

# DELETE (soft delete)
docker-compose exec db psql -U user -d mydatabase \
  -c "UPDATE users SET is_deleted = TRUE, updated_at = NOW() WHERE id = 60;"
```

Then run delta export:
```bash
curl -X POST http://localhost:8080/exports/delta \
  -H "X-Consumer-ID: consumer-3"
```

Wait 5 seconds then check file:
```bash
ls output/
head -5 output/delta_consumer-3_*.csv
```

### 404 for unknown consumer

```bash
curl http://localhost:8080/exports/watermark \
  -H "X-Consumer-ID: brand-new-consumer"
```

---

## Run Tests

```bash
docker-compose exec app npm test
```

Expected result: all tests pass with 70%+ line coverage.

---

## View Logs

```bash
docker-compose logs app | grep '"event"'
```

You should see `export_started` and `export_completed` lines for every job.

---

## Stop Everything

```bash
docker-compose down
```

---

## Environment Variables

| Variable | Description | Value |
|----------|-------------|-------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:password@db:5432/mydatabase` |
| `PORT` | App port | `8080` |
| `NODE_ENV` | Environment | `development` |

---

## Project Structure

```
cdc-export-system/
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── package.json
├── src/
│   ├── index.js
│   ├── db.js
│   ├── logger.js
│   ├── routes/
│   │   ├── health.js
│   │   └── exports.js
│   └── services/
│       ├── exportService.js
│       └── watermarkService.js
├── seeds/
│   └── 01_init.sql
├── tests/
│   ├── unit/exportService.test.js
│   └── integration/api.test.js
└── output/
```

---

## API Summary

| Method | Endpoint | Header | Description |
|--------|----------|--------|-------------|
| GET | `/health` | — | Health check |
| POST | `/exports/full` | `X-Consumer-ID` | Export all non-deleted users |
| POST | `/exports/incremental` | `X-Consumer-ID` | Export only changed rows since last watermark |
| POST | `/exports/delta` | `X-Consumer-ID` | Same as incremental + operation column (INSERT/UPDATE/DELETE) |
| GET | `/exports/watermark` | `X-Consumer-ID` | Get last exported timestamp for a consumer |0