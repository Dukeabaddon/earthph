# Development Scripts

This folder contains utility scripts for local development and testing.

## Available Scripts

### `test-api-local.js`
**Purpose**: Test the `/api/events` endpoint locally during development.

**Usage**:
```bash
# Set environment variables first
$env:VITE_SUPABASE_URL='your-url'
$env:VITE_SUPABASE_ANON_KEY='your-anon-key'
$env:SUPABASE_SERVICE_ROLE_KEY='your-service-role-key'

# Run the test
node scripts/test-api-local.js
```

**What it does**:
- Simulates a request to `/api/events`
- Tests scraping and database operations
- Displays response headers, status code, and body
- Useful for debugging without starting the dev server

---

### `test-rate-limit.js`
**Purpose**: Test the rate limiting implementation on `/api/events`.

**Usage**:
```bash
# Make sure dev server is running
npm run dev

# In another terminal:
node scripts/test-rate-limit.js
```

**What it does**:
- Sends 15 requests to `/api/events` (exceeds 10 req/min limit)
- Verifies HTTP 429 responses after limit exceeded
- Checks rate limit headers (X-RateLimit-Limit, X-RateLimit-Remaining)
- Confirms rate limiting is working correctly

**Expected output**:
- First 10 requests: HTTP 200 ✅
- Requests 11-15: HTTP 429 ⛔ (Rate Limited)

---

## Notes

- These scripts are for **development only** and are not deployed to production
- They are excluded from the build process
- Keep them updated if API changes are made
