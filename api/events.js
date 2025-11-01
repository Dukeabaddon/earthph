/**
 * Backend API: Get Earthquake Events
 * 
 * Following backend-developer.md standards:
 * - RESTful API design with proper HTTP semantics
 * - Input validation and sanitization
 * - Structured logging with correlation
 * - Error handling with standardized responses
 * - Response time optimization (<100ms p95 target)
 * - OpenAPI spec compatible
 * - Smart caching with automatic refresh
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as cheerio from 'cheerio';

// Initialize Supabase client with connection pooling
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

// Cache configuration
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const PHIVOLCS_URL = 'https://earthquake.phivolcs.dost.gov.ph/';

// In-memory cache for last scrape time
let lastScrapeTime = 0;

// Rate limiting configuration
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_MINUTE = 10; // 10 requests per minute per IP

/**
 * Check rate limit for IP address
 * @param {string} ip - Client IP address
 * @returns {Object} { allowed: boolean, remaining: number }
 */
function checkRateLimit(ip) {
  const now = Date.now();
  const userRequests = rateLimitMap.get(ip) || [];
  
  // Clean old requests outside the time window
  const recentRequests = userRequests.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW_MS);
  
  if (recentRequests.length >= MAX_REQUESTS_PER_MINUTE) {
    rateLimitMap.set(ip, recentRequests);
    return { allowed: false, remaining: 0 };
  }
  
  // Add current request
  recentRequests.push(now);
  rateLimitMap.set(ip, recentRequests);
  
  return { allowed: true, remaining: MAX_REQUESTS_PER_MINUTE - recentRequests.length };
}

// Clean up rate limit map every 5 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of rateLimitMap.entries()) {
    const recentRequests = timestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
    if (recentRequests.length === 0) {
      rateLimitMap.delete(ip);
    } else {
      rateLimitMap.set(ip, recentRequests);
    }
  }
}, 5 * 60 * 1000);

/**
 * GET /api/events
 * 
 * Fetches recent earthquake events from database
 * Automatically refreshes data if cache is stale (>5 minutes)
 * 
 * @returns {Object} JSON response with events array
 * @status 200 - Success
 * @status 500 - Server error
 */
export default async function handler(req, res) {
  const correlationId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Extract client IP address
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || 
                   req.headers['x-real-ip'] || 
                   req.connection?.remoteAddress || 
                   'unknown';
  
  // Check rate limit
  const rateCheck = checkRateLimit(clientIp);
  if (!rateCheck.allowed) {
    logWarn('Rate limit exceeded', { correlationId, ip: clientIp });
    return res.status(429).json({
      success: false,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: 60, // seconds
      timestamp: new Date().toISOString()
    });
  }
  
  // Log request start
  logInfo('Request received', {
    correlationId,
    method: req.method,
    path: '/api/events',
    ip: clientIp,
    rateLimitRemaining: rateCheck.remaining
  });

  // CORS headers for cross-origin requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // CDN caching headers (cache for 60s, allow stale for 30s)
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
  
  // Rate limit headers
  res.setHeader('X-RateLimit-Limit', MAX_REQUESTS_PER_MINUTE.toString());
  res.setHeader('X-RateLimit-Remaining', rateCheck.remaining.toString());
  res.setHeader('X-RateLimit-Reset', new Date(Date.now() + RATE_LIMIT_WINDOW_MS).toISOString());

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    logWarn('Method not allowed', { correlationId, method: req.method });
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      message: 'Only GET requests are supported',
      timestamp: new Date().toISOString()
    });
  }

  const startTime = Date.now();

  try {
    // Check if we need to refresh data (cache is stale or empty)
    const now = Date.now();
    const shouldRefresh = (now - lastScrapeTime) > CACHE_DURATION_MS;

    if (shouldRefresh) {
      logInfo('Cache stale, triggering scrape', { correlationId });
      await scrapeAndStore(correlationId);
      lastScrapeTime = now;
    } else {
      logInfo('Cache fresh, skipping scrape', { 
        correlationId, 
        cacheAge: `${Math.round((now - lastScrapeTime) / 1000)}s` 
      });
    }

    // Query database with optimized selectors
    const { data, error } = await supabase
      .from('events')
      .select('id, occurred_at, latitude, longitude, depth_km, magnitude, location_text')
      .order('occurred_at', { ascending: false })
      .limit(100);

    if (error) {
      logError('Database query failed', {
        correlationId,
        error: error.message,
        code: error.code
      });
      throw error;
    }

    const responseTime = Date.now() - startTime;

    // Log successful response
    logInfo('Request completed', {
      correlationId,
      eventCount: data?.length || 0,
      responseTime: `${responseTime}ms`,
      dataRefreshed: shouldRefresh
    });

    // Standardized success response
    return res.status(200).json({
      success: true,
      events: data || [],
      count: data?.length || 0,
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      cached: !shouldRefresh
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    logError('Request failed', {
      correlationId,
      error: error.message,
      stack: error.stack,
      responseTime: `${responseTime}ms`
    });

    // Standardized error response
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to fetch earthquake events',
      timestamp: new Date().toISOString(),
      correlationId
    });
  }
}

// Structured logging utilities
function logInfo(message, data = {}) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'INFO',
    message,
    ...data
  }));
}

function logWarn(message, data = {}) {
  console.warn(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'WARN',
    message,
    ...data
  }));
}

function logError(message, data = {}) {
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'ERROR',
    message,
    ...data
  }));
}

/**
 * Scrape PHIVOLCS and store events in database
 * @param {string} correlationId - Request correlation ID
 */
async function scrapeAndStore(correlationId) {
  try {
    logInfo('Starting PHIVOLCS scrape', { correlationId });

    // Initialize Supabase with service role key for writes
    const supabaseAdmin = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );

    // Fetch HTML from PHIVOLCS
    const response = await axios.get(PHIVOLCS_URL, {
      timeout: 8000,
      headers: {
        'User-Agent': 'EarthPH/1.0 (Educational Project)'
      },
      // Disable SSL verification for development (PHIVOLCS uses self-signed cert)
      // In production, Vercel handles SSL properly
      httpsAgent: process.env.NODE_ENV === 'production' 
        ? undefined 
        : new (await import('https')).Agent({ rejectUnauthorized: false })
    });

    // Parse HTML with Cheerio
    const $ = cheerio.load(response.data);
    const events = [];
    let skippedRows = 0;

    // PHIVOLCS table structure: Find all <tr> rows with earthquake data
    // Each row has 6 <td> cells: DateTime(with link), Lat, Lon, Depth, Mag, Location
    $('table tbody tr').each((index, row) => {
      try {
        const cells = $(row).find('td');
        
        // Skip header rows or rows without 6 cells
        if (cells.length !== 6) {
          skippedRows++;
          return;
        }

        // Extract text from each cell (handles nested tags like <a>, <span>, <strong>)
        const dateTimeRaw = $(cells[0]).text().trim();
        const latitudeRaw = $(cells[1]).text().trim();
        const longitudeRaw = $(cells[2]).text().trim();
        const depthRaw = $(cells[3]).text().trim();
        const magnitudeRaw = $(cells[4]).text().trim();
        const locationText = $(cells[5]).text().trim();

        // Skip empty rows or non-data rows
        if (!dateTimeRaw || !latitudeRaw || !longitudeRaw || !magnitudeRaw) {
          skippedRows++;
          return;
        }

        // Parse values
        const occurred_at = parsePhivolcsDateTime(dateTimeRaw);
        const latitude = parseFloat(latitudeRaw);
        const longitude = parseFloat(longitudeRaw);
        const depth_km = parseFloat(depthRaw) || null;
        const magnitude = parseFloat(magnitudeRaw);

        // Validate parsed values
        if (!occurred_at || isNaN(latitude) || isNaN(longitude) || isNaN(magnitude)) {
          skippedRows++;
          return;
        }

        // Validate Philippines coordinates (rough bounding box)
        if (latitude < 4.5 || latitude > 21.0 || longitude < 116.0 || longitude > 127.0) {
          skippedRows++;
          return;
        }

        // Generate unique event ID
        const id = generateEventId(occurred_at, latitude, longitude, magnitude);

        events.push({
          id,
          occurred_at,
          latitude,
          longitude,
          depth_km,
          magnitude,
          location_text: locationText
        });

      } catch (err) {
        skippedRows++;
        logError('Row parsing error', {
          correlationId,
          rowIndex: index,
          error: err.message
        });
      }
    });

    logInfo('Parsing complete', {
      correlationId,
      eventsFound: events.length,
      skippedRows
    });

    if (events.length === 0) {
      logWarn('No events found', { correlationId });
      return;
    }

    // Deduplicate events by ID (keep first occurrence)
    const uniqueEvents = [];
    const seenIds = new Set();
    let duplicatesRemoved = 0;
    
    for (const event of events) {
      if (!seenIds.has(event.id)) {
        seenIds.add(event.id);
        uniqueEvents.push(event);
      } else {
        duplicatesRemoved++;
      }
    }

    if (duplicatesRemoved > 0) {
      logInfo('Duplicates removed', {
        correlationId,
        duplicatesRemoved,
        uniqueEventsCount: uniqueEvents.length
      });
    }

    // Upsert events to database
    const { error: upsertError } = await supabaseAdmin
      .from('events')
      .upsert(uniqueEvents, { 
        onConflict: 'id',
        ignoreDuplicates: false 
      });

    if (upsertError) {
      logError('Database upsert failed', {
        correlationId,
        error: upsertError.message
      });
      throw upsertError;
    }

    // Cleanup old events (24-hour retention)
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { error: deleteError, count: deletedCount } = await supabaseAdmin
      .from('events')
      .delete()
      .lt('created_at', cutoffTime);

    if (deleteError) {
      logWarn('Cleanup warning', {
        correlationId,
        error: deleteError.message
      });
    }

    logInfo('Scrape completed successfully', {
      correlationId,
      eventsUpserted: uniqueEvents.length,
      eventsDeleted: deletedCount || 0
    });

  } catch (error) {
    logError('Scrape failed', {
      correlationId,
      error: error.message,
      stack: error.stack
    });
    // Don't throw - allow returning cached data on scrape failure
  }
}

/**
 * Parse PHIVOLCS datetime format to ISO 8601
 * @param {string} dateTimeStr - Format: "01 November 2025 - 04:12 PM"
 * @returns {string|null} ISO 8601 datetime or null
 */
function parsePhivolcsDateTime(dateTimeStr) {
  try {
    // Example: "01 November 2025 - 04:12 PM"
    const parts = dateTimeStr.split(' - ');
    if (parts.length !== 2) return null;

    const datePart = parts[0].trim(); // "01 November 2025"
    const timePart = parts[1].trim(); // "04:12 PM"

    // Parse date: "01 November 2025"
    const dateMatch = datePart.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
    if (!dateMatch) return null;

    const day = parseInt(dateMatch[1]);
    const monthName = dateMatch[2];
    const year = parseInt(dateMatch[3]);

    // Convert month name to number
    const monthMap = {
      'January': 0, 'February': 1, 'March': 2, 'April': 3,
      'May': 4, 'June': 5, 'July': 6, 'August': 7,
      'September': 8, 'October': 9, 'November': 10, 'December': 11
    };
    const month = monthMap[monthName];
    if (month === undefined) return null;

    // Parse time: "04:12 PM"
    const timeMatch = timePart.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!timeMatch) return null;

    let hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2]);
    const meridiem = timeMatch[3].toUpperCase();

    // Convert to 24-hour format
    if (meridiem === 'PM' && hours !== 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;

    // PHIVOLCS times are in Philippine Standard Time (PST = UTC+8)
    // Create date in UTC, then subtract 8 hours to get actual UTC time
    const pstDate = new Date(Date.UTC(year, month, day, hours, minutes));
    pstDate.setUTCHours(pstDate.getUTCHours() - 8);

    return pstDate.toISOString();
  } catch (err) {
    return null;
  }
}

/**
 * Generate deterministic event ID
 * @param {string} occurred_at - ISO datetime
 * @param {number} latitude - Latitude
 * @param {number} longitude - Longitude
 * @param {number} magnitude - Magnitude
 * @returns {string} Unique event ID
 */
function generateEventId(occurred_at, latitude, longitude, magnitude) {
  const timestamp = new Date(occurred_at).toISOString().replace(/[:.]/g, '-');
  const lat = latitude.toFixed(4).replace('.', '');
  const lon = longitude.toFixed(4).replace('.', '');
  const mag = magnitude.toFixed(1).replace('.', '');
  return `${timestamp}_${lat}_${lon}_${mag}`;
}
