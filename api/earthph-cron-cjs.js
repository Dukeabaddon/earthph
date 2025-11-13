// Using CommonJS for Vercel compatibility
const axios = require('axios');
const cheerio = require('cheerio');
const { createClient } = require('@supabase/supabase-js');

const PHIVOLCS_URL = 'https://earthquake.phivolcs.dost.gov.ph/';

function parsePhivolcsDateTime(dateTimeStr) {
  try {
    const [datePart, timePart] = dateTimeStr.split(' - ');
    if (!datePart || !timePart) return null;

    const dateTokens = datePart.trim().split(' ');
    if (dateTokens.length !== 3) return null;

    const day = parseInt(dateTokens[0]);
    const monthName = dateTokens[1];
    const year = parseInt(dateTokens[2]);

    const months = {
      'January': 1, 'February': 2, 'March': 3, 'April': 4,
      'May': 5, 'June': 6, 'July': 7, 'August': 8,
      'September': 9, 'October': 10, 'November': 11, 'December': 12
    };

    const month = months[monthName];
    if (!month || !day || !year) return null;

    const timeMatch = timePart.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!timeMatch) return null;

    let hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2]);
    const meridiem = timeMatch[3].toUpperCase();

    if (meridiem === 'PM' && hours !== 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;

    const pstDate = new Date(Date.UTC(year, month - 1, day, hours, minutes));
    pstDate.setUTCHours(pstDate.getUTCHours() - 8);

    return pstDate.toISOString();
  } catch (err) {
    return null;
  }
}

function generateEventId(occurred_at, latitude, longitude) {
  return `${occurred_at.replace(/[:.]/g, '-')}_${(latitude * 100).toFixed(0)}_${(longitude * 100).toFixed(0)}`;
}

let lastRun = 0;
const MIN_INTERVAL = 60 * 1000; // 1 minute

module.exports = async function handler(req, res) {
  const startTime = Date.now();
  let eventsUpserted = 0, eventsDeleted = 0, errorMsg = null;

  // Secret header check
  const secret = req.headers['x-earthph-cron-secret'];
  if (secret !== process.env.EARTHPH_CRON_SECRET) {
    console.warn('[SECURITY] Unauthorized access attempt');
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  // Rate limit
  if (Date.now() - lastRun < MIN_INTERVAL) {
    console.warn('[SECURITY] Rate limit exceeded');
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' });
  }
  lastRun = Date.now();

  try {
    // Get Supabase credentials from environment
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    // Scrape PHIVOLCS
    console.log('[CRON] Fetching data from PHIVOLCS...');
    const response = await axios.get(PHIVOLCS_URL, { timeout: 8000 });
    const $ = cheerio.load(response.data);
    const events = [];
    const table = $('table').eq(2).find('tbody');
    console.log('[CRON] Parsing earthquake data...');

    table.find('tr').each((index, row) => {
      // Skip header row (first row)
      if (index === 0) return;
      if (index >= 501) return false; // Limit to 500 events

      const cells = $(row).find('td');
      if (cells.length < 6) return;

      const dateTimeRaw = $(cells[0]).text().trim();
      const latitudeRaw = $(cells[1]).text().trim();
      const longitudeRaw = $(cells[2]).text().trim();
      const depthRaw = $(cells[3]).text().trim();
      const magnitudeRaw = $(cells[4]).text().trim();
      const locationText = $(cells[5]).text().trim();

      // Parse date
      const occurred_at = parsePhivolcsDateTime(dateTimeRaw);
      if (!occurred_at) return;

      const latitude = parseFloat(latitudeRaw);
      const longitude = parseFloat(longitudeRaw);
      const magnitude = parseFloat(magnitudeRaw);
      const depth_km = parseFloat(depthRaw) || null;

      if (isNaN(latitude) || isNaN(longitude) || isNaN(magnitude)) return;
      if (latitude < 4.0 || latitude > 22.0 || longitude < 116.0 || longitude > 128.0) return;

      const id = generateEventId(occurred_at, latitude, longitude);

      events.push({
        id,
        occurred_at,
        latitude,
        longitude,
        depth_km,
        magnitude,
        location_text: locationText
      });
    });

    console.log(`[CRON] Parsed ${events.length} events`);

    // Upsert events
    if (events.length > 0) {
      const { data, error } = await supabase.from('events').upsert(events).select();
      if (error) throw error;
      eventsUpserted = data?.length || events.length;
      console.log(`[CRON] Upserted ${eventsUpserted} events`);
    }

    // Delete old events
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { error: deleteError, count: deletedCount } = await supabase
      .from('events')
      .delete()
      .lt('created_at', cutoffTime);
    if (deleteError) throw deleteError;
    eventsDeleted = deletedCount || 0;

    // Response
    return res.status(200).json({
      success: true,
      events_upserted: eventsUpserted,
      events_deleted: eventsDeleted,
      responseTime: `${Date.now() - startTime}ms`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    errorMsg = error.message;
    console.error('[ERROR]', errorMsg);
    return res.status(500).json({
      success: false,
      error: errorMsg,
      events_upserted: eventsUpserted,
      events_deleted: eventsDeleted,
      responseTime: `${Date.now() - startTime}ms`,
      timestamp: new Date().toISOString()
    });
  }
};

