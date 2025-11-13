/**
 * Test endpoint to verify environment variables are loaded
 * This helps debug configuration issues
 */

export default async function handler(req, res) {
  const envVars = {
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    hasViteSupabaseUrl: !!process.env.VITE_SUPABASE_URL,
    hasSupabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasViteSupabaseServiceKey: !!process.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
    hasSupabaseAnonKey: !!process.env.SUPABASE_ANON_KEY,
    hasViteSupabaseAnonKey: !!process.env.VITE_SUPABASE_ANON_KEY,
    hasCronSecret: !!process.env.EARTHPH_CRON_SECRET,
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    
    // Show first 10 chars of each to verify they're not empty strings
    supabaseUrlPreview: process.env.SUPABASE_URL?.substring(0, 20) || 'NOT_SET',
    viteSupabaseUrlPreview: process.env.VITE_SUPABASE_URL?.substring(0, 20) || 'NOT_SET',
    serviceKeyPreview: process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20) || 'NOT_SET',
    viteServiceKeyPreview: process.env.VITE_SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20) || 'NOT_SET',
    cronSecretPreview: process.env.EARTHPH_CRON_SECRET?.substring(0, 20) || 'NOT_SET',
  };

  return res.status(200).json({
    success: true,
    environment: envVars,
    timestamp: new Date().toISOString()
  });
}

