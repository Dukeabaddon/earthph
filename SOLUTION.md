# 🔧 Complete Solution for EarthPH Cron Job 500 Error

## ✅ **PROBLEM SOLVED!**

The cron job is now working successfully! 🎉

## 🔍 Root Cause Identified

### Actual Issue: Duplicate Event IDs in Upsert Operation
The error was **NOT** about RLS policies or environment variables. The actual PostgreSQL error was:

```
"ON CONFLICT DO UPDATE command cannot affect row a second time"
```

**What This Means:**
The scraper was trying to upsert multiple events with the **same ID** in a single database operation, which PostgreSQL rejects.

**Why Duplicates Occurred:**
The ID generation logic creates IDs based on:
```javascript
`${occurred_at}_${(latitude * 100).toFixed(0)}_${(longitude * 100).toFixed(0)}`
```

When two earthquakes have:
- Same timestamp (to the second)
- Similar coordinates (when rounded to 2 decimal places)

They generate the **same ID**, causing duplicates in the array.

---

## ✅ THE FIX

### Code Change: Deduplicate Events Before Upsert

Added deduplication logic in `api/scrape-cjs.js`:

```javascript
// Deduplicate events by ID (prevent "ON CONFLICT DO UPDATE" error)
const uniqueEvents = Array.from(
  new Map(events.map(event => [event.id, event])).values()
);

if (uniqueEvents.length < events.length) {
  console.log(`Removed ${events.length - uniqueEvents.length} duplicate events`);
}

// Upsert only unique events
const { data, error } = await supabase.from('events').upsert(uniqueEvents).select();
```

**How It Works:**
1. Creates a Map with event IDs as keys (automatically removes duplicates)
2. Converts back to array of unique events
3. Logs how many duplicates were removed
4. Upserts only unique events to database

---

## 📊 Test Results

### Successful Cron Job Execution:
```json
{
  "success": true,
  "message": "Scraped 497 events (1 duplicates removed), deleted 0 old events",
  "eventsScraped": 497,
  "eventsDeleted": 0,
  "duplicatesRemoved": 1,
  "duration": "3563ms",
  "correlationId": "scrape-1763036684177-7oall42rh"
}
```

### Frontend Status:
- ✅ Website loading correctly
- ✅ Map displaying earthquake markers
- ✅ Showing 66 events in last 24 hours
- ✅ All functionality working

---

## 🔍 What We Investigated (That Wasn't the Problem)

### ❌ Things We Ruled Out:
1. **Vercel Deployment Protection** - Already disabled
2. **Supabase URL Truncation** - Was a red herring (test-env preview truncates for security)
3. **RLS Policies** - Not the issue (service role key bypasses RLS)
4. **Environment Variables** - All correctly configured
5. **Authentication Headers** - Working correctly
6. **SSL Certificates** - Already handled with `rejectUnauthorized: false`

### ✅ The Real Problem:
**Duplicate event IDs in a single upsert operation** causing PostgreSQL conflict error.

---

## 📁 API Files Status

### Current API Files:

| File | Purpose | Status |
|------|---------|--------|
| `events-cjs.js` | **PUBLIC** endpoint for frontend | ✅ WORKING |
| `scrape-cjs.js` | **CRON** endpoint for scraping + cleanup | ✅ FIXED & WORKING |
| `events.js` | OLD ESM version (not used) | ⚠️ Can be deleted |
| `test-env.js` | Testing endpoint | ⚠️ Can be deleted |
| `test-supabase.js` | Testing endpoint | ⚠️ Can be deleted |

### Optional Cleanup:
```bash
git rm api/events.js api/test-env.js api/test-supabase.js
git commit -m "Clean up obsolete API files"
git push origin main
```

---

## 🔄 How the System Works Now

### 1. Frontend → `events-cjs.js`
- **URL**: `https://earth-ph.vercel.app/api/events-cjs`
- **Method**: GET
- **Auth**: None (public endpoint)
- **Purpose**: Fetch earthquake events for display
- **Status**: ✅ Working (200 OK)

### 2. Cron Job → `scrape-cjs.js`
- **URL**: `https://earth-ph.vercel.app/api/scrape-cjs`
- **Method**: GET
- **Auth**: Header `x-earthph-cron-secret: 6ef64934-d545-4fdf-b8a3-9c7e2f1a4d6b`
- **Schedule**: Every 1 minute (via cron-job.org)
- **Status**: ✅ Working (200 OK)
- **Process**:
  1. Scrape PHIVOLCS website (8s timeout)
  2. Parse earthquake data
  3. **Deduplicate events by ID**
  4. Upsert unique events to Supabase
  5. Delete events older than 24 hours (based on `created_at`)

---

## 📝 Summary

### Problem History:
1. ❌ **Initial Error**: "TypeError: fetch failed" → Fixed by correcting Supabase URL
2. ❌ **Second Error**: "new row violates row-level security policy" → Fixed by adding SERVICE_ROLE_KEY
3. ❌ **Final Error**: "ON CONFLICT DO UPDATE command cannot affect row a second time" → **Fixed by deduplicating events**

### Final Solution:
**Deduplicate events before upsert** to prevent PostgreSQL conflict errors when multiple events have the same ID.

### Current Status:
- ✅ Frontend working (66 events displayed)
- ✅ Cron job working (497 events scraped, 1 duplicate removed)
- ✅ Auto-cleanup ready (will delete old events on next run)
- ✅ All systems operational

### Next Steps:
1. Monitor cron job executions in cron-job.org dashboard
2. Verify old events are being deleted after 24 hours
3. (Optional) Clean up obsolete API test files
4. (Optional) Adjust cron schedule if needed (currently every 1 minute)

