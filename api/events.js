

import { createClient } from '@supabase/supabase-js';
import { getConfig } from './config/env.js';

// Rate limiting configuration
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60000;
const MAX_REQUESTS_PER_MINUTE = 10;

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

export default async function handler(req, res) {
  const startTime = Date.now();
  
  try {
    // CRITICAL: Validate bypass secret BEFORE loading config
    const bypassSecret = req.headers['x-vercel-protection-bypass'];
    const validSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    
    // Debug logging
    console.log('[Events] Bypass validation', {
      hasHeader: !!bypassSecret,
      hasEnvVar: !!validSecret,
      headerLength: bypassSecret?.length,
      envVarLength: validSecret?.length,
      allEnvVars: Object.keys(process.env).filter(k => k.includes('VERCEL') || k.includes('SUPABASE'))
    });
    
    // Check if environment variable is configured
    if (!validSecret) {
      console.error('[Events] VERCEL_AUTOMATION_BYPASS_SECRET not configured');
      return res.status(500).json({ 
        error: 'Configuration Error',
        message: 'Server authentication not configured'
      });
    }
    
    // Require bypass secret for API access
    if (!bypassSecret || bypassSecret !== validSecret) {
      console.warn('[Events] Unauthorized access attempt', {
        hasSecret: !!bypassSecret,
        ip: req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown'
      });
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Valid x-vercel-protection-bypass header required'
      });
    }
    
    // Now load config and create Supabase client
    let config, supabase;
    try {
      config = getConfig();
      supabase = createClient(
        config.SUPABASE_URL,
        config.SUPABASE_ANON_KEY,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false
          }
        }
      );
    } catch (error) {
      console.error('[Events] Configuration initialization failed', { 
        error: error.message 
      });
      return res.status(500).json({
        error: 'Configuration Error',
        message: 'Failed to initialize server configuration',
        details: error.message
      });
    }
    
    // Get client IP
    const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
    
    // Check rate limit
    const rateLimit = checkRateLimit(ip);
    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please try again later.'
      });
    }
    
    // Query database - only events from the last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
      .from('events')
      .select('id, occurred_at, latitude, longitude, depth_km, magnitude, location_text, created_at')
      .gte('occurred_at', twentyFourHoursAgo)
      .order('occurred_at', { ascending: false })
      .limit(500); // Increased from 100 to 500 to handle high earthquake activity days
    
    if (error) {
      throw error;
    }
    
    // Find the most recent created_at timestamp (when data was last scraped)
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
    
    res.status(200).json({
      success: true,
      events: events || [],
      count: events?.length || 0,
      lastUpdated: new Date(lastUpdated).toISOString(),
      responseTime: `${responseTime}ms`
    });
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error('[ERROR]', error);
    res.status(500).json({
      error: error.message,
      responseTime: `${responseTime}ms`
    });
  }
}
