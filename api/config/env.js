function getEnvVar(primaryName, fallbackName, required = true) {
  let value = process.env[primaryName] || process.env[fallbackName];
  
  // Trim whitespace that might have been added during configuration
  if (value) {
    value = value.trim();
  }
  
  if (!value && required) {
    throw new Error(
      `Missing required environment variable: ${primaryName} or ${fallbackName}. ` +
      `Please check your .env.local (for development) or Vercel environment variables (for production).`
    );
  }
  
  // Log which variable was used (for debugging)
  if (value) {
    const source = process.env[primaryName] ? primaryName : fallbackName;
    console.log(`[ENV] Using ${source} for ${primaryName}`);
  }
  
  return value;
}

/**
 * Validate that a value looks like a valid URL
 */
function validateUrl(value, name) {
  if (!value) return;
  
  // Trim whitespace
  const trimmedValue = value.trim();
  
  try {
    new URL(trimmedValue);
  } catch (err) {
    throw new Error(`Invalid URL in ${name}: ${value}`);
  }
}

/**
 * Validate that a value looks like a JWT token
 */
function validateJwt(value, name) {
  if (!value) return;
  
  // Trim whitespace that might have been added during configuration
  const trimmedValue = value.trim();
  
  // JWT pattern: Must have 3 parts separated by dots, each part base64url encoded
  // More lenient pattern that allows for longer tokens
  const jwtPattern = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
  if (!jwtPattern.test(trimmedValue)) {
    throw new Error(
      `Invalid JWT format in ${name}. ` +
      `Expected format: header.payload.signature (base64url encoded). ` +
      `Received length: ${value.length}, starts with: ${value.substring(0, 20)}...`
    );
  }
}

// Lazy singleton configuration cache
// This ensures env vars are loaded at RUNTIME (inside handler functions)
// rather than at MODULE LOAD TIME, fixing Vercel serverless function lifecycle
let _config = null;

/**
 * Get configuration with lazy initialization and caching
 */
export function getConfig() {
  if (!_config) {
    // Load environment variables (only executes on first call)
    const url = getEnvVar('SUPABASE_URL', 'VITE_SUPABASE_URL', true);
    const anonKey = getEnvVar('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY', true);
    const serviceKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', true);
    
    // Validate the values
    validateUrl(url, 'SUPABASE_URL');
    validateJwt(anonKey, 'SUPABASE_ANON_KEY');
    validateJwt(serviceKey, 'SUPABASE_SERVICE_ROLE_KEY');
    
    // Cache the configuration
    _config = {
      SUPABASE_URL: url,
      SUPABASE_ANON_KEY: anonKey,
      SUPABASE_SERVICE_ROLE_KEY: serviceKey
    };
    
    // Log successful configuration (without exposing secrets)
    console.log('[ENV] Configuration loaded successfully:', {
      supabaseUrl: url,
      hasAnonKey: !!anonKey,
      hasServiceRoleKey: !!serviceKey,
      environment: process.env.NODE_ENV || 'development'
    });
  }
  
  return _config;
}

// Export utility functions for other modules
export { getEnvVar, validateUrl, validateJwt };

// Export as default for compatibility
export default getConfig;
