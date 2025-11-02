

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
    
    // Get config and create Supabase client
    const config = getConfig();
    const supabase = createClient(
      config.SUPABASE_URL,
      config.SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );
    
    // Query database - only events from the last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
      .from('events')
      .select('id, occurred_at, latitude, longitude, depth_km, magnitude, location_text, created_at')
      .gte('occurred_at', twentyFourHoursAgo)
      .order('occurred_at', { ascending: false })
      .limit(100);
    
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
