export default async function handler(req, res) {
  return res.status(200).json({
    message: 'Hello from scrape test',
    timestamp: new Date().toISOString(),
    env: {
      hasSecret: !!process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
      hasSupabase: !!process.env.SUPABASE_URL,
      nodeVersion: process.version
    }
  });
}
