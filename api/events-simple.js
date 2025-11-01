/**
 * Simplified events endpoint - database query only
 */

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
    
    // Query database
    const { data, error } = await supabase
      .from('earthquake_events')
      .select('*')
      .order('datetime', { ascending: false })
      .limit(100);
    
    if (error) {
      throw error;
    }
    
    const responseTime = Date.now() - startTime;
    
    res.status(200).json({
      events: data || [],
      count: data?.length || 0,
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
