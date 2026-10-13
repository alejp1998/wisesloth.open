/**
 * Environment Variable Validation
 * Validates that all required environment variables are set at startup
 * Prevents silent failures in production
 */


// Required environment variables for the application to function
const REQUIRED_ENV_VARS = [
  'DB_USERNAME',
  'DB_PASSWORD',
  'DB_HOST',
  'DB_DIALECT'
];

// Required in production only
const PRODUCTION_REQUIRED_ENV_VARS = [
  'SESSION_SECRET',
  'DB_NAME_PROD'
];

// Required in development only
const DEVELOPMENT_REQUIRED_ENV_VARS = [
  'DB_NAME_DEV'
];

// Optional but recommended
const RECOMMENDED_ENV_VARS = [
  'PORT',
  'APP_URL'
];

/**
 * Validates environment variables
 * @param {boolean} exitOnError - Whether to exit the process on validation failure
 * @returns {object} Validation result with missing and warnings arrays
 */
function validateEnv(exitOnError = true) {
  const env = process.env.NODE_ENV || 'development';
  const missing = [];
  const warnings = [];

  // Check required variables
  REQUIRED_ENV_VARS.forEach(varName => {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  });

  // Check environment-specific required variables
  if (env === 'production') {
    PRODUCTION_REQUIRED_ENV_VARS.forEach(varName => {
      if (!process.env[varName]) {
        missing.push(varName);
      }
    });

    // Critical: Session secret must not be the fallback in production
    if (!process.env.SESSION_SECRET) {
      missing.push('SESSION_SECRET (CRITICAL: Using fallback secret in production is a security risk!)');
    }
  } else {
    DEVELOPMENT_REQUIRED_ENV_VARS.forEach(varName => {
      if (!process.env[varName]) {
        missing.push(varName);
      }
    });
  }

  // Check recommended variables
  RECOMMENDED_ENV_VARS.forEach(varName => {
    if (!process.env[varName]) {
      warnings.push(`${varName} is not set, using default value`);
    }
  });

  if (env === 'production') {
    if ((process.env.SESSION_SECRET || '').length < 32) missing.push('SESSION_SECRET (at least 32 characters)');
    if (!/^[a-f0-9]{64}$/i.test(process.env.KEY_ENCRYPTION_SECRET || '')) missing.push('KEY_ENCRYPTION_SECRET (64 hexadecimal characters)');
  }
  try {
    const url = new URL(process.env.APP_URL || 'http://localhost:8080');
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      missing.push('APP_URL (an HTTP(S) origin without a path or credentials)');
    }
  } catch (_error) { missing.push('APP_URL (a valid HTTP(S) origin)'); }
  const uncertainCost = Number(process.env.UNCERTAIN_REQUEST_COST_USD || '1');
  if (!Number.isFinite(uncertainCost) || uncertainCost < 0) missing.push('UNCERTAIN_REQUEST_COST_USD (nonnegative USD amount)');

  const httpLimit = Number(process.env.HTTP_RATE_LIMIT_PER_15_MIN || '500');
  if (!Number.isSafeInteger(httpLimit) || httpLimit < 0) missing.push('HTTP_RATE_LIMIT_PER_15_MIN (nonnegative integer)');

  // Report results
  if (warnings.length > 0) {
    console.warn('\n⚠️  Environment Variable Warnings:');
    warnings.forEach(warning => console.warn(`   - ${warning}`));
  }

  if (missing.length > 0) {
    console.error('\n❌ Missing Required Environment Variables:');
    missing.forEach(varName => console.error(`   - ${varName}`));
    console.error('\nPlease set these variables in your .env file or environment.\n');

    if (exitOnError && env === 'production') {
      console.error('Exiting due to missing required environment variables in production.\n');
      process.exit(1);
    }
  } else {
    console.log('✅ Environment variables validated successfully');
  }

  return { missing, warnings, isValid: missing.length === 0 };
}

/**
 * Get a validated environment variable with optional default
 * @param {string} name - The environment variable name
 * @param {*} defaultValue - Default value if not set
 * @param {boolean} required - Whether to throw if not set and no default
 * @returns {string} The environment variable value
 */
function getEnv(name, defaultValue = undefined, required = false) {
  const value = process.env[name];

  if (value !== undefined) {
    return value;
  }

  if (defaultValue !== undefined) {
    return defaultValue;
  }

  if (required) {
    throw new Error(`Required environment variable ${name} is not set`);
  }

  return undefined;
}

/**
 * Check if we're in production
 * @returns {boolean}
 */
function isProduction() {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if we're in development
 * @returns {boolean}
 */
function isDevelopment() {
  return process.env.NODE_ENV !== 'production';
}

module.exports = {
  validateEnv,
  getEnv,
  isProduction,
  isDevelopment,
  REQUIRED_ENV_VARS,
  PRODUCTION_REQUIRED_ENV_VARS,
  DEVELOPMENT_REQUIRED_ENV_VARS
};
