// Using CommonJS for Vercel compatibility
const axios = require('axios');
const cheerio = require('cheerio');
const { createClient } = require('@supabase/supabase-js');

const PHIVOLCS_URL = 'https://earthquake.phivolcs.dost.gov.ph/';
let lastScrapeTime = 0;
const MIN_INTERVAL = 5 * 60 * 1000;

module.exports = async function handler(req, res) {
  const correlationId = `scrape-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Validate bypass secret
  const bypassSecret = req.headers['x-vercel-protection-bypass'];
  const validSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  
  if (!validSecret) {
    return res.status(500).json({ 
      error: 'Configuration Error',
      message: 'VERCEL_AUTOMATION_BYPASS_SECRET not configured'
    });
  }
  
  if (!bypassSecret || bypassSecret !== validSecret) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Valid x-vercel-protection-bypass header required'
    });
  }

  try {
    // Get Supabase credentials from environment
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({
        error: 'Configuration Error',
        message: 'Supabase credentials not configured'
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    console.log(`[${correlationId}] Starting scrape`);

    // Fetch PHIVOLCS data (disable SSL verification due to their certificate issues)
    const https = require('https');
    const response = await axios.get(PHIVOLCS_URL, { 
      timeout: 8000,
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    });
    const $ = cheerio.load(response.data);
    
    const events = [];
    // The earthquake table is the 3rd table (index 2) on the page
    const table = $('table').eq(2).find('tbody');
    
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
      
      const id = `${occurred_at.replace(/[:.]/g, '-')}_${(latitude * 100).toFixed(0)}_${(longitude * 100).toFixed(0)}`;
      
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

    console.log(`[${correlationId}] Parsed ${events.length} events`);

    // Upsert to database
    if (events.length > 0) {
      const { error } = await supabase.from('events').upsert(events, { onConflict: 'id' });
      if (error) throw error;
    }

    return res.status(200).json({
      success: true,
      message: `Scraped ${events.length} events`,
      correlationId
    });

  } catch (error) {
    console.error(`[${correlationId}] Error:`, error);
    return res.status(500).json({
      error: error.message,
      correlationId
    });
  }
};

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
