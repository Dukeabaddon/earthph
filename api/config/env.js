/**
 * Environment Variable Configuration Utility
 * 
 * Provides smart environment variable resolution with fallback logic
 * to support both Vercel serverless functions and local Vite development.
 * 
 * Following backend-security.md principles:
 * - Defense in depth (multiple variable sources)
 * - Environment-aware configuration
 * - Validation at startup
 * - Secure logging (no secret exposure)
 */

/**
 * Get environment variable with fallback support
 * @param {string} primaryName - Primary variable name (e.g., 'SUPABASE_URL')
 * @param {string} fallbackName - Fallback variable name (e.g., 'VITE_SUPABASE_URL')
 * @param {boolean} required - Whether the variable is required
 * @returns {string|null} Variable value or null if not found and not required
 * @throws {Error} If required variable is missing
 */
function getEnvVar(primaryName, fallbackName, required = true) {
  const value = process.env[primaryName] || process.env[fallbackName];
  
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
 * @param {string} value - Value to validate
 * @param {string} name - Variable name (for error messages)
 * @throws {Error} If value is not a valid URL
 */
function validateUrl(value, name) {
  if (!value) return;
  
  try {
    new URL(value);
  } catch (err) {
    throw new Error(`Invalid URL in ${name}: ${value}`);
  }
}

/**
 * Validate that a value looks like a JWT token
 * @param {string} value - Value to validate
 * @param {string} name - Variable name (for error messages)
 * @throws {Error} If value is not a valid JWT format
 */
function validateJwt(value, name) {
  if (!value) return;
  
  const jwtPattern = /^eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/;
  if (!jwtPattern.test(value)) {
    throw new Error(`Invalid JWT format in ${name}`);
  }
}

// Lazy singleton configuration cache
// This ensures env vars are loaded at RUNTIME (inside handler functions)
// rather than at MODULE LOAD TIME, fixing Vercel serverless function lifecycle
let _config = null;

/**
 * Get configuration with lazy initialization and caching
 * This function should be called inside handler functions to ensure
 * environment variables are available in Vercel's serverless runtime
 * 
 * @returns {Object} Configuration object with Supabase credentials
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
