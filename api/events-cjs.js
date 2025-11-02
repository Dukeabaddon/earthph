// Using CommonJS for Vercel compatibility
const { createClient } = require('@supabase/supabase-js');

// Rate limiting configuration
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60000;
const MAX_REQUESTS_PER_MINUTE = 100; // Increased for public access

function checkRateLimit(ip) {
  const now = Date.now();
  const userRequests = rateLimitMap.get(ip) || [];
  const recentRequests = userRequests.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW_MS);
  
  if (recentRequests.length >= MAX_REQUESTS_PER_MINUTE) {
    rateLimitMap.set(ip, recentRequests);
    return { allowed: false, remaining: 0 };
  }
  
  recentRequests.push(now);
  rateLimitMap.set(ip, recentRequests);
  return { allowed: true, remaining: MAX_REQUESTS_PER_MINUTE - recentRequests.length };
}

module.exports = async function handler(req, res) {
  const startTime = Date.now();
  
  try {
    // Get client IP for rate limiting
    const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
    
    // Check rate limit
    const rateLimit = checkRateLimit(ip);
    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please try again later.'
      });
    }
    
    // Get Supabase credentials from environment
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({
        error: 'Configuration Error',
        message: 'Database configuration not available'
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    
    // Query database - only events from the last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
      .from('events')
      .select('id, occurred_at, latitude, longitude, depth_km, magnitude, location_text, created_at')
      .gte('occurred_at', twentyFourHoursAgo)
      .order('occurred_at', { ascending: false })
      .limit(500);
    
    if (error) {
      throw error;
    }
    
    // Find the most recent created_at timestamp
    const lastUpdated = data && data.length > 0 
      ? data.reduce((latest, event) => {
          const eventCreated = new Date(event.created_at).getTime();
          return eventCreated > latest ? eventCreated : latest;
        }, 0)
      : Date.now();
    
    // Transform data to match frontend expectations
    const events = (data || []).map(event => ({
      id: event.id,
      datetime: event.occurred_at,
      latitude: event.latitude,
      longitude: event.longitude,
      depth: event.depth_km,
      magnitude: event.magnitude,
      location: event.location_text
    }));
    
    const responseTime = Date.now() - startTime;
    
    // Set cache headers
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
    res.setHeader('X-Response-Time', `${responseTime}ms`);
    res.setHeader('X-Rate-Limit-Remaining', rateLimit.remaining.toString());
    
    return res.status(200).json({
      success: true,
      events,
      count: events.length,
      lastUpdated: new Date(lastUpdated).toISOString(),
      responseTime: `${responseTime}ms`
    });
    
  } catch (error) {
    console.error('[Events] Error:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message || 'Failed to fetch earthquake data'
    });
  }
};
