// Using CommonJS for Vercel compatibility
const { createClient } = require('@supabase/supabase-js');

// Security Configuration
const ALLOWED_ORIGINS = [
  'https://earth-ph.vercel.app',
  'https://earth-awsuuu35s-dukes-projects-3d01cc3f.vercel.app',
  /^https:\/\/earth-[a-z0-9]+-dukes-projects-[a-z0-9]+\.vercel\.app$/,
  'http://localhost:5173',
  'http://localhost:3000'
];

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

/**
 * Set security headers for production hardening
 * Protects against XSS, clickjacking, MIME-sniffing attacks
 */
function setSecurityHeaders(res, origin) {
  // CORS - Allow only whitelisted origins
  if (origin) {
    const isAllowed = ALLOWED_ORIGINS.some(allowed => {
      if (typeof allowed === 'string') {
        return allowed === origin;
      } else if (allowed instanceof RegExp) {
        return allowed.test(origin);
      }
      return false;
    });
    
    if (isAllowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Vary', 'Origin');
    }
  }
  
  // Security headers (OWASP recommendations)
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
}

/**
 * Log request for security monitoring and debugging
 */
function logRequest(req, res, duration, error = null) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    ip: req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown',
    userAgent: req.headers['user-agent'] || 'unknown',
    origin: req.headers['origin'] || req.headers['referer'] || 'direct',
    status: res.statusCode,
    duration: `${duration}ms`,
    error: error ? error.message : null
  };
  
  console.log(JSON.stringify(logEntry));
  
  // Alert on suspicious activity
  if (res.statusCode === 429) {
    console.warn(`[SECURITY] Rate limit exceeded: IP=${logEntry.ip}, UA=${logEntry.userAgent}`);
  }
  if (error) {
    console.error(`[ERROR] Request failed: ${error.message}`, logEntry);
  }
}

module.exports = async function handler(req, res) {
  const startTime = Date.now();
  const origin = req.headers['origin'] || req.headers['referer'];
  
  try {
    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
      setSecurityHeaders(res, origin);
      return res.status(204).end();
    }
    
    // Only allow GET requests
    if (req.method !== 'GET') {
      setSecurityHeaders(res, origin);
      const duration = Date.now() - startTime;
      logRequest(req, res, duration, new Error('Method not allowed'));
      return res.status(405).json({
        success: false,
        error: 'Method not allowed',
        message: 'Only GET requests are supported'
      });
    }
    
    // Set security headers for all responses
    setSecurityHeaders(res, origin);
    
    // Get client IP for rate limiting
    const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
    
    // Check rate limit
    const rateLimit = checkRateLimit(ip);
    if (!rateLimit.allowed) {
      const duration = Date.now() - startTime;
      logRequest(req, res, duration, new Error('Rate limit exceeded'));
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please try again later.'
      });
    }
    
    // Get Supabase credentials from environment
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      const duration = Date.now() - startTime;
      logRequest(req, res, duration, new Error('Configuration missing'));
      return res.status(500).json({
        success: false,
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
    
    // Set cache headers (60s to match frontend polling and cron frequency)
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=15');
    res.setHeader('X-Response-Time', `${responseTime}ms`);
    res.setHeader('X-Rate-Limit-Remaining', rateLimit.remaining.toString());
    
    // Log successful request
    logRequest(req, res, responseTime);
    
    return res.status(200).json({
      success: true,
      events,
      count: events.length,
      lastUpdated: new Date(lastUpdated).toISOString(),
      responseTime: `${responseTime}ms`
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    res.statusCode = 500;
    logRequest(req, res, duration, error);
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message || 'Failed to fetch earthquake data'
    });
  }
};
