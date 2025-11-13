import axios from 'axios';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';
import { getConfig } from './config/env.js';

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
  // Generate unique event ID
  return `${occurred_at.replace(/[:.]/g, '-')}_${(latitude * 100).toFixed(0)}_${(longitude * 100).toFixed(0)}`;
}

let lastRun = 0;
const MIN_INTERVAL = 60 * 1000; // 1 minute

export default async function handler(req, res) {
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
    // Supabase client (service role)
    const config = getConfig();
    const supabase = createClient(
      config.SUPABASE_URL,
      config.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    // Scrape PHIVOLCS
    const response = await axios.get(PHIVOLCS_URL, { timeout: 8000 });
    const $ = cheerio.load(response.data);
    const events = [];
    const table = $('table').eq(2).find('tbody');

    table.find('tr').each((index, row) => {
      if (index === 0) return;
      const cells = $(row).find('td');
      const occurred_at = parsePhivolcsDateTime(cells.eq(0).text());
      const latitude = parseFloat(cells.eq(1).text());
      const longitude = parseFloat(cells.eq(2).text());
      const id = generateEventId(occurred_at, latitude, longitude);
      events.push({ id, occurred_at, latitude, longitude });
    });

    // Upsert events
    if (events.length > 0) {
      const { data, error } = await supabase.from('events').upsert(events).select();
      if (error) throw error;
      eventsUpserted = data?.length || events.length;
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
}
