/**
 * Local API Endpoint Tester
 * Tests the /api/events endpoint to verify scraping and database operations
 */

// Import the handler
import handler from './api/events.js';

// Mock request and response objects
const mockReq = {
  method: 'GET',
  url: '/api/events'
};

const mockRes = {
  statusCode: null,
  headers: {},
  body: null,
  
  status(code) {
    this.statusCode = code;
    return this;
  },
  
  setHeader(key, value) {
    this.headers[key] = value;
    return this;
  },
  
  json(data) {
    this.body = data;
    console.log('\n=== API Response ===');
    console.log('Status Code:', this.statusCode);
    console.log('Headers:', JSON.stringify(this.headers, null, 2));
    console.log('Body:', JSON.stringify(data, null, 2));
    return this;
  },
  
  end() {
    return this;
  }
};

// Test the endpoint
console.log('Testing /api/events endpoint...\n');
console.log('Environment Variables:');
console.log('- VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL?.substring(0, 30) + '...');
console.log('- VITE_SUPABASE_ANON_KEY:', process.env.VITE_SUPABASE_ANON_KEY ? 'Set ✓' : 'Missing ✗');
console.log('- SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set ✓' : 'Missing ✗');

handler(mockReq, mockRes)
  .then(() => {
    console.log('\n=== Test Complete ===');
    if (mockRes.statusCode === 200 && mockRes.body?.success) {
      console.log('✓ API endpoint working correctly');
      console.log(`✓ Found ${mockRes.body.events?.length || 0} earthquake events`);
      
      if (mockRes.body.events?.length > 0) {
        console.log('\nSample Event:');
        console.log(JSON.stringify(mockRes.body.events[0], null, 2));
      }
    } else {
      console.error('✗ API endpoint failed');
      console.error('Response:', mockRes.body);
    }
    process.exit(0);
  })
  .catch(error => {
    console.error('\n=== Test Failed ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  });
