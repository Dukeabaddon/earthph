// Simple endpoint to test environment variable availability
export default async function handler(req, res) {
  const envStatus = {
    VERCEL_AUTOMATION_BYPASS_SECRET: {
      exists: !!process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
      length: process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.length || 0
    },
    SUPABASE_URL: {
      exists: !!process.env.SUPABASE_URL,
      value: process.env.SUPABASE_URL ? process.env.SUPABASE_URL.substring(0, 30) + '...' : 'NOT SET'
    },
    VITE_SUPABASE_URL: {
      exists: !!process.env.VITE_SUPABASE_URL,
      value: process.env.VITE_SUPABASE_URL ? process.env.VITE_SUPABASE_URL.substring(0, 30) + '...' : 'NOT SET'
    },
    SUPABASE_ANON_KEY: {
      exists: !!process.env.SUPABASE_ANON_KEY,
      length: process.env.SUPABASE_ANON_KEY?.length || 0
    },
    VITE_SUPABASE_ANON_KEY: {
      exists: !!process.env.VITE_SUPABASE_ANON_KEY,
      length: process.env.VITE_SUPABASE_ANON_KEY?.length || 0
    },
    SUPABASE_SERVICE_ROLE_KEY: {
      exists: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      length: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0
    },
    allEnvVarKeys: Object.keys(process.env).filter(k => 
      k.includes('VERCEL') || k.includes('SUPABASE')
    )
  };

  return res.status(200).json(envStatus);
}
