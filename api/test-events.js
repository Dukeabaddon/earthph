/**
 * Minimal test of events endpoint with Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { getConfig } from './config/env.js';

export default async function handler(req, res) {
  try {
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
    
    const { data, error } = await supabase
      .from('earthquake_events')
      .select('*')
      .order('datetime', { ascending: false })
      .limit(5);
    
    if (error) {
      throw error;
    }
    
    res.status(200).json({
      success: true,
      count: data?.length || 0,
      events: data
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
}
