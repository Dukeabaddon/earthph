/**
 * Cleanup Endpoint - Delete events older than 24 hours
 * 
 * Standalone endpoint to clean up old earthquake data
 * No dependencies on axios/cheerio (avoids serverless import issues)
 */

import { createClient } from '@supabase/supabase-js';
import { getConfig } from './config/env.js';

export default async function handler(req, res) {
  const startTime = Date.now();
  
  try {
    // Get config
    const config = getConfig();
    
    // Initialize Supabase with service role key (needed for delete operations)
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
    
    // Calculate cutoff time (24 hours ago)
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    // Get count before deletion
    const { count: beforeCount } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true });
    
    // Delete old events based on occurred_at timestamp
    const { error: deleteError, count: deletedCount } = await supabase
      .from('events')
      .delete()
      .lt('occurred_at', cutoffTime);
    
    if (deleteError) {
      throw deleteError;
    }
    
    // Get count after deletion
    const { count: afterCount } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true });
    
    const responseTime = Date.now() - startTime;
    
    return res.status(200).json({
      success: true,
      message: 'Cleanup completed successfully',
      cutoff_time: cutoffTime,
      events_before: beforeCount,
      events_deleted: deletedCount || 0,
      events_after: afterCount,
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    console.error('[Cleanup] Error:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message,
      responseTime: `${responseTime}ms`
    });
  }
}
