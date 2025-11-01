/**
 * Test endpoint to verify config import works
 */

import { getConfig } from './config/env.js';

export default async function handler(req, res) {
  try {
    // Try to get config
    const config = getConfig();
    
    res.status(200).json({
      message: "Config import successful!",
      hasConfig: !!config,
      configKeys: config ? Object.keys(config) : [],
      urlPresent: !!config?.SUPABASE_URL,
      anonKeyPresent: !!config?.SUPABASE_ANON_KEY,
      serviceKeyPresent: !!config?.SUPABASE_SERVICE_ROLE_KEY
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
}
