/**
 * Simple test endpoint to verify Vercel serverless function works
 */

export default async function handler(req, res) {
  try {
    // Test if we can access environment variables
    const hasSupabaseUrl = !!process.env.SUPABASE_URL || !!process.env.VITE_SUPABASE_URL;
    const hasAnonKey = !!process.env.SUPABASE_ANON_KEY || !!process.env.VITE_SUPABASE_ANON_KEY;
    const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    res.status(200).json({
      message: "Test endpoint working!",
      envVarsAvailable: {
        SUPABASE_URL: hasSupabaseUrl,
        SUPABASE_ANON_KEY: hasAnonKey,
        SUPABASE_SERVICE_ROLE_KEY: hasServiceKey
      },
      availableEnvVars: Object.keys(process.env).filter(k => k.includes('SUPABASE') || k.includes('VERCEL'))
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
}
