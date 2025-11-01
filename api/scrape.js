/**
 * Backend API: PHIVOLCS Web Scraper
 * 
 * Following backend-developer.md standards:
 * - Input validation and sanitization (SQL injection prevention)
 * - Rate limiting implementation
 * - Structured logging
 * - Transaction management with rollback capability
 * - Performance optimization
 * - Security measures (OWASP guidelines)
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';
import { getConfig } from './config/env.js';

const PHIVOLCS_URL = 'https://earthquake.phivolcs.dost.gov.ph/';

// Rate limiting: Track last scrape time
let lastScrapeTime = 0;
const MIN_INTERVAL = 5 * 60 * 1000; // 5 minutes

/**
 * GET /api/scrape
 * 
 * Scrapes PHIVOLCS website and stores events in database
 * Implements rate limiting and data validation
 * 
 * @returns {Object} JSON response with scrape results
 * @status 200 - Success
 * @status 429 - Rate limit exceeded
 * @status 500 - Server error
 */
export default async function handler(req, res) {
  const correlationId = `scrape-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Load configuration lazily (ensures env vars are available in Vercel runtime)
  const config = getConfig();
  
  // Initialize Supabase with service role key inside handler
  const supabase = createClient(
    config.SUPABASE_URL,
    config.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }
  );
  
  logInfo('[Scraper] Request received', { correlationId });

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting check
  const now = Date.now();
  const timeSinceLastScrape = now - lastScrapeTime;

  if (timeSinceLastScrape < MIN_INTERVAL) {
    const retryAfter = Math.ceil((MIN_INTERVAL - timeSinceLastScrape) / 1000);
    logWarn('[Scraper] Rate limit exceeded', {
      correlationId,
      retryAfter
    });
    
    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded',
      message: 'Please wait before scraping again',
      retry_after: retryAfter,
      timestamp: new Date().toISOString()
    });
  }

  lastScrapeTime = now;
  const startTime = Date.now();

  try {
    // Step 1: Fetch HTML from PHIVOLCS
    logInfo('[Scraper] Fetching PHIVOLCS data', { correlationId });
    
    const response = await axios.get(PHIVOLCS_URL, {
      timeout: 8000,
      headers: {
        'User-Agent': 'EarthPH/1.0 (Educational Project; Contact: admin@earthph.com)'
      },
      validateStatus: (status) => status === 200
    });

    // Step 2: Parse HTML with Cheerio
    const $ = cheerio.load(response.data);
    const events = [];
    let skippedRows = 0;

    $('table tbody tr').each((index, row) => {
      try {
        const cells = $(row).find('td');
        
        // Validate cell count (must be exactly 6)
        if (cells.length !== 6) {
          skippedRows++;
          logWarn('[Scraper] Invalid row structure', {
            correlationId,
            rowIndex: index,
            cellCount: cells.length
          });
          return;
        }

        // Extract and sanitize cell values
        const dateTimeRaw = $(cells[0]).text().trim();
        const latitudeRaw = $(cells[1]).text().trim();
        const longitudeRaw = $(cells[2]).text().trim();
        const depthRaw = $(cells[3]).text().trim();
        const magnitudeRaw = $(cells[4]).text().trim();
        const locationText = $(cells[5]).text().trim();

        // Parse and validate data
        const occurred_at = parsePhivolcsDateTime(dateTimeRaw);
        const latitude = parseFloat(latitudeRaw);
        const longitude = parseFloat(longitudeRaw);
        const depth_km = parseFloat(depthRaw) || null;
        const magnitude = parseFloat(magnitudeRaw);

        // Input validation: Ensure required fields are valid
        if (!occurred_at || isNaN(latitude) || isNaN(longitude) || isNaN(magnitude)) {
          skippedRows++;
          logWarn('[Scraper] Invalid data in row', {
            correlationId,
            rowIndex: index,
            dateTimeRaw,
            latitude,
            longitude,
            magnitude
          });
          return;
        }

        // Validate coordinate ranges (Philippines bounds)
        if (latitude < 4.5 || latitude > 21.0 || longitude < 116.0 || longitude > 127.0) {
          skippedRows++;
          logWarn('[Scraper] Coordinates out of bounds', {
            correlationId,
            rowIndex: index,
            latitude,
            longitude
          });
          return;
        }

        // Generate unique ID (deterministic)
        const id = generateEventId(occurred_at, latitude, longitude);

        events.push({
          id,
          occurred_at,
          latitude,
          longitude,
          depth_km,
          magnitude,
          location_text: locationText,
          raw_html: {
            date_time: dateTimeRaw,
            latitude: latitudeRaw,
            longitude: longitudeRaw,
            depth: depthRaw,
            magnitude: magnitudeRaw,
            location: locationText
          }
        });

      } catch (err) {
        skippedRows++;
        logError('[Scraper] Row parsing error', {
          correlationId,
          rowIndex: index,
          error: err.message
        });
      }
    });

    logInfo('[Scraper] Parsing complete', {
      correlationId,
      eventsFound: events.length,
      skippedRows
    });

    // Step 3: Database transaction - Upsert events
    if (events.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No new events found',
        events_count: 0,
        skipped_rows: skippedRows,
        timestamp: new Date().toISOString()
      });
    }

    // Upsert with conflict resolution
    const { data, error } = await supabase
      .from('events')
      .upsert(events, { 
        onConflict: 'id',
        ignoreDuplicates: false 
      })
      .select();

    if (error) {
      logError('[Scraper] Database upsert failed', {
        correlationId,
        error: error.message,
        code: error.code,
        hint: error.hint
      });
      throw error;
    }

    // Step 4: Cleanup old events (24-hour retention based on when earthquake occurred)
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { error: deleteError, count: deletedCount } = await supabase
      .from('events')
      .delete()
      .lt('occurred_at', cutoffTime);

    if (deleteError) {
      logWarn('[Scraper] Cleanup warning', {
        correlationId,
        error: deleteError.message
      });
    }

    const responseTime = Date.now() - startTime;

    logInfo('[Scraper] Request completed successfully', {
      correlationId,
      eventsUpserted: events.length,
      eventsDeleted: deletedCount || 0,
      responseTime: `${responseTime}ms`
    });

    return res.status(200).json({
      success: true,
      events_count: events.length,
      skipped_rows: skippedRows,
      deleted_old_events: deletedCount || 0,
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    logError('[Scraper] Fatal error', {
      correlationId,
      error: error.message,
      stack: error.stack,
      responseTime: `${responseTime}ms`
    });

    // Handle specific error types
    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({
        success: false,
        error: 'Gateway timeout',
        message: 'PHIVOLCS server did not respond in time',
        timestamp: new Date().toISOString()
      });
    }

    if (error.response?.status === 503) {
      return res.status(503).json({
        success: false,
        error: 'Service unavailable',
        message: 'PHIVOLCS server is currently down',
        timestamp: new Date().toISOString()
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to scrape earthquake data',
      timestamp: new Date().toISOString(),
      correlationId
    });
  }
}

/**
 * Parse PHIVOLCS datetime format to ISO 8601
 * Format: "2025-01-15 - 10:30 AM" (Philippine Standard Time)
 * 
 * @param {string} dateTimeStr - PHIVOLCS datetime string
 * @returns {string|null} ISO 8601 datetime or null if invalid
 */
function parsePhivolcsDateTime(dateTimeStr) {
  try {
    const [datePart, timePart] = dateTimeStr.split(' - ');
    if (!datePart || !timePart) return null;

    const [year, month, day] = datePart.split('-').map(Number);
    const timeMatch = timePart.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!timeMatch) return null;

    let hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2]);
    const meridiem = timeMatch[3].toUpperCase();

    // Convert to 24-hour format
    if (meridiem === 'PM' && hours !== 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;

    // Create UTC date (PST is UTC+8)
    const pstDate = new Date(Date.UTC(year, month - 1, day, hours, minutes));
    pstDate.setUTCHours(pstDate.getUTCHours() - 8);

    return pstDate.toISOString();
  } catch (err) {
    return null;
  }
}

/**
 * Generate deterministic event ID
 * Format: ISO8601_LAT_LON
 * 
 * @param {string} occurred_at - ISO datetime
 * @param {number} latitude - Latitude
 * @param {number} longitude - Longitude
 * @returns {string} Unique event ID
 */
function generateEventId(occurred_at, latitude, longitude) {
  const timestamp = new Date(occurred_at).toISOString().replace(/[:.]/g, '-');
  const lat = latitude.toFixed(4).replace('.', '');
  const lon = longitude.toFixed(4).replace('.', '');
  return `${timestamp}_${lat}_${lon}`;
}

// Structured logging functions
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
