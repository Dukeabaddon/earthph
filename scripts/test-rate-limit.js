/**
 * Test Rate Limiting on /api/events
 * 
 * This script tests the rate limiting implementation by making
 * multiple requests to the API endpoint and checking for 429 responses.
 */

const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:3000/api/events';
const MAX_REQUESTS = 15; // Exceed the 10 req/min limit

async function testRateLimit() {
  console.log('🔬 Testing Rate Limiting on /api/events');
  console.log(`📍 API URL: ${API_URL}`);
  console.log(`🔢 Sending ${MAX_REQUESTS} requests...\n`);

  const results = {
    success: 0,
    rateLimited: 0,
    errors: 0
  };

  for (let i = 1; i <= MAX_REQUESTS; i++) {
    try {
      const startTime = Date.now();
      const response = await axios.get(API_URL, {
        validateStatus: () => true // Don't throw on any status
      });
      const duration = Date.now() - startTime;

      const rateLimit = {
        limit: response.headers['x-ratelimit-limit'],
        remaining: response.headers['x-ratelimit-remaining'],
        reset: response.headers['x-ratelimit-reset']
      };

      if (response.status === 200) {
        results.success++;
        console.log(`✅ Request ${i}: HTTP 200 (${duration}ms) - Remaining: ${rateLimit.remaining}`);
      } else if (response.status === 429) {
        results.rateLimited++;
        console.log(`⛔ Request ${i}: HTTP 429 Rate Limited - Retry after ${response.data.retryAfter}s`);
        console.log(`   Message: ${response.data.message}`);
      } else {
        results.errors++;
        console.log(`❌ Request ${i}: HTTP ${response.status} - ${response.statusText}`);
      }

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      results.errors++;
      console.log(`❌ Request ${i}: Error - ${error.message}`);
    }
  }

  console.log('\n📊 Test Results:');
  console.log(`   ✅ Successful: ${results.success}`);
  console.log(`   ⛔ Rate Limited: ${results.rateLimited}`);
  console.log(`   ❌ Errors: ${results.errors}`);

  if (results.rateLimited > 0) {
    console.log('\n✅ Rate limiting is working correctly!');
  } else {
    console.log('\n⚠️  Warning: No rate limiting detected. Check implementation.');
  }
}

// Run test
testRateLimit().catch(console.error);
