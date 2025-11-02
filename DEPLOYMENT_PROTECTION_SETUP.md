# Deployment Protection Bypass Setup Guide

## Overview
This guide configures Vercel Deployment Protection with secret-based bypass to maintain security while allowing external cron service access.

## Security Benefits
- ✅ Frontend remains protected from unauthorized access
- ✅ API endpoints require secret header for access
- ✅ External cron-job.org can access /api/scrape with secret
- ✅ Prevents abuse while enabling automation

---

## Step 1: Configure Vercel Dashboard

### 1. Access Project Settings
1. Go to: https://vercel.com/dashboard
2. Select your **earthph** project
3. Navigate to: **Settings** → **Deployment Protection**

### 2. Enable Protection Bypass
1. Find section: **"Protection Bypass for Automation"**
2. Click: **"Enable Protection Bypass"**
3. Click: **"Create Bypass Secret"**
4. **IMPORTANT**: Copy the generated secret immediately
   - Format: `vercel_bypass_<random-string>`
   - Example: `vercel_bypass_abc123xyz789`
   - Save it securely (you won't see it again)

### 3. Verify Settings
- Deployment Protection: **Enabled** ✅
- Protection Bypass: **Enabled** ✅
- Bypass Secret: **Created** ✅

---

## Step 2: Configure cron-job.org

### 1. Login to cron-job.org
1. Go to: https://cron-job.org
2. Login to your account
3. Find your existing EarthPH scraper job

### 2. Add Bypass Header
1. Click **Edit** on your scraper job
2. Scroll to: **"Request Headers"** section
3. Click: **"Add Custom Header"**
4. Configure header:
   ```
   Header Name: x-vercel-protection-bypass
   Header Value: <paste-your-secret-here>
   ```
   Example:
   ```
   Header Name: x-vercel-protection-bypass
   Header Value: vercel_bypass_abc123xyz789
   ```

### 3. Update Job Configuration
- URL: `https://your-production-url.vercel.app/api/scrape`
- Schedule: `*/5 * * * *` (every 5 minutes)
- Method: `GET`
- Headers: Include the bypass secret

### 4. Save and Test
1. Click **"Save"**
2. Click **"Run Now"** to test immediately
3. Check execution logs for success (should see HTTP 200)

---

## Step 3: Verify Setup

### Test 1: Without Secret (Should Fail)
```bash
# This should return 401 Unauthorized
curl https://your-production-url.vercel.app/api/events
```
Expected: **401 Unauthorized** ❌

### Test 2: With Secret (Should Succeed)
```bash
# This should return earthquake data
curl -H "x-vercel-protection-bypass: vercel_bypass_abc123xyz789" \
  https://your-production-url.vercel.app/api/events
```
Expected: **200 OK** with JSON data ✅

### Test 3: Cron Job Execution
1. Go to cron-job.org dashboard
2. Check **"Execution History"**
3. Latest runs should show: **HTTP 200** ✅
4. Verify scraper is running every 5 minutes

---

## Step 4: Monitor Production

### Check Data Freshness
1. Wait 5-10 minutes after setup
2. Check PHIVOLCS latest earthquake:
   - https://earthquake.phivolcs.dost.gov.ph/
3. Compare with your production site
4. Timestamp difference should be < 5 minutes

### Verify Database Updates
```bash
# Check Supabase dashboard or run query:
SELECT occurred_at, magnitude, location, created_at 
FROM earthquakes 
ORDER BY occurred_at DESC 
LIMIT 5;
```

---

## Troubleshooting

### Issue: Still getting 401 errors
**Solution**:
1. Verify secret is correctly copied (no extra spaces)
2. Check header name is exactly: `x-vercel-protection-bypass`
3. Ensure protection bypass is enabled in Vercel dashboard
4. Regenerate secret if needed

### Issue: Cron job not running
**Solution**:
1. Check cron-job.org execution logs
2. Verify URL is correct production deployment
3. Ensure schedule is active (*/5 * * * *)
4. Test manually with "Run Now" button

### Issue: Old data still showing
**Solution**:
1. Wait 5 minutes for first cron execution
2. Check Supabase for new entries
3. Verify browser cache is cleared
4. Check API response directly (bypass cache)

---

## Security Best Practices

### ✅ DO:
- Keep bypass secret confidential
- Rotate secret periodically (every 90 days)
- Monitor access logs for suspicious activity
- Use HTTPS only (never HTTP)

### ❌ DON'T:
- Share secret publicly or commit to Git
- Use same secret across multiple projects
- Disable protection entirely unless necessary
- Expose secret in client-side code

---

## Maintenance

### Monthly Check
- [ ] Verify cron job still executing (check logs)
- [ ] Compare PHIVOLCS vs production timestamps
- [ ] Check Supabase storage usage (should be stable)
- [ ] Review Vercel function execution metrics

### Quarterly Tasks
- [ ] Rotate bypass secret
- [ ] Update cron-job.org with new secret
- [ ] Review security logs
- [ ] Test disaster recovery (manual scraper run)

---

## Emergency Contacts

**If production goes down:**
1. Check Vercel status: https://vercel.com/status
2. Check Supabase status: https://status.supabase.com
3. Check cron-job.org status: https://status.cron-job.org
4. Review function logs in Vercel dashboard
5. Manually trigger scraper if needed

---

## Summary

✅ **Deployment Protection**: Enabled (protects frontend)
✅ **Bypass Secret**: Created (allows automation)
✅ **Cron Job**: Configured with secret header
✅ **Data Flow**: PHIVOLCS → Scraper → Supabase → Users
✅ **Update Frequency**: Every 5 minutes
✅ **Security**: Maintained while enabling automation

**Status**: Ready for production ✅
