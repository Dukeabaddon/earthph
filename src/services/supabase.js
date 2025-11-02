/**
 * Supabase Service Layer
 * 
 * Following frontend-developer.md standards:
 * - Proper state management integration
 * - Error boundaries and error handling
 * - Environment variable management
 * - Connection pooling optimization
 */

import { createClient } from '@supabase/supabase-js';

// Validate environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Supabase] Missing environment variables');
  throw new Error('Supabase configuration is missing. Please check your .env.local file.');
}

/**
 * Supabase client instance with optimized configuration
 * - No session persistence (public read-only app)
 * - Auto-refresh disabled (using anon key)
 * - Connection pooling handled by Supabase
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'X-Client-Info': 'earthph-web/1.0'
    }
  }
});

/**
 * Fetch recent earthquake events from API endpoint
 * 
 * Following API-designer.md standards:
 * - Use API endpoint instead of direct database access
 * - Let backend handle scraping, caching, and data fetching
 * - Standardized error responses
 * 
 * Updated to use events-cjs (CommonJS public endpoint) instead of events (ESM with auth)
 * - No authentication required for public access
 * - Works with Vercel's CommonJS compilation
 * 
 * @param {number} limit - Maximum number of events to fetch (default: 100)
 * @returns {Promise<{data: Array, error: Error|null, cached: boolean}>}
 */
export async function fetchEvents(limit = 100) {
  try {
    const response = await fetch('/api/events-cjs');
    const result = await response.json();

    if (!response.ok) {
      console.error('[API] Request failed:', result);
      return { 
        data: null, 
        error: new Error(result.message || 'Failed to fetch events'),
        cached: false 
      };
    }

    if (!result.success) {
      console.error('[API] Response unsuccessful:', result);
      return { 
        data: null, 
        error: new Error(result.message || 'API returned unsuccessful response'),
        cached: false 
      };
    }

    console.log('[API] Events fetched:', {
      count: result.events?.length || 0,
      cached: result.cached,
      timestamp: result.timestamp
    });

    return { 
      data: result.events || [], 
      error: null,
      cached: result.cached || false
    };
  } catch (err) {
    console.error('[API] Unexpected error:', err);
    return { data: null, error: err, cached: false };
  }
}

/**
 * Subscribe to real-time event updates (optional feature)
 * 
 * @param {Function} callback - Function to call when new events arrive
 * @returns {Object} Subscription object with unsubscribe method
 */
export function subscribeToEvents(callback) {
  const subscription = supabase
    .channel('events-channel')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'events'
      },
      (payload) => {
        console.log('[Supabase] New event received:', payload.new);
        callback(payload.new);
      }
    )
    .subscribe();

  return {
    unsubscribe: () => {
      supabase.removeChannel(subscription);
    }
  };
}

/**
 * Trigger scraper endpoint
 * 
 * @returns {Promise<{success: boolean, data: Object|null, error: Error|null}>}
 */
export async function triggerScraper() {
  try {
    const response = await fetch('/api/scrape');
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Scraper request failed');
    }

    return { success: true, data, error: null };
  } catch (err) {
    console.error('[Scraper] Error:', err);
    return { success: false, data: null, error: err };
  }
}

export default supabase;
