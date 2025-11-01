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

// Load and validate Supabase configuration
const SUPABASE_URL_VAL = getEnvVar('SUPABASE_URL', 'VITE_SUPABASE_URL', true);
const SUPABASE_ANON_KEY_VAL = getEnvVar('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY', true);
const SUPABASE_SERVICE_ROLE_KEY_VAL = getEnvVar('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', true);

// Validate the values
validateUrl(SUPABASE_URL_VAL, 'SUPABASE_URL');
validateJwt(SUPABASE_ANON_KEY_VAL, 'SUPABASE_ANON_KEY');
validateJwt(SUPABASE_SERVICE_ROLE_KEY_VAL, 'SUPABASE_SERVICE_ROLE_KEY');

// Log successful configuration (without exposing secrets)
console.log('[ENV] Configuration loaded successfully:', {
  supabaseUrl: SUPABASE_URL_VAL,
  hasAnonKey: !!SUPABASE_ANON_KEY_VAL,
  hasServiceRoleKey: !!SUPABASE_SERVICE_ROLE_KEY_VAL,
  environment: process.env.NODE_ENV || 'development'
});

// Export configuration
export const SUPABASE_URL = SUPABASE_URL_VAL;
export const SUPABASE_ANON_KEY = SUPABASE_ANON_KEY_VAL;
export const SUPABASE_SERVICE_ROLE_KEY = SUPABASE_SERVICE_ROLE_KEY_VAL;

// Export utility functions for other modules
export { getEnvVar, validateUrl, validateJwt };

// Also export as default for compatibility
export default {
  SUPABASE_URL: SUPABASE_URL_VAL,
  SUPABASE_ANON_KEY: SUPABASE_ANON_KEY_VAL,
  SUPABASE_SERVICE_ROLE_KEY: SUPABASE_SERVICE_ROLE_KEY_VAL,
  getEnvVar,
  validateUrl,
  validateJwt
};
