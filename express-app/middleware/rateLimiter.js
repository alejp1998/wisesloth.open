/**
 * Rate Limiting Middleware
 * Protects API endpoints from abuse and DoS attacks
 * Conservative limits to avoid annoying legitimate users
 */

const rateLimit = require('express-rate-limit');

// Check if we're in development mode
const isDevelopment = process.env.NODE_ENV !== 'production';

// Skip rate limiting function for development
const skipInDevelopment = () => isDevelopment;

/**
 * Default rate limiter for general API endpoints
 * 500 requests per 15 minutes per IP (generous for normal browsing)
 */
const defaultLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: Number(process.env.HTTP_RATE_LIMIT_PER_15_MIN || '500'),
  keyGenerator: req => req.session?.user ? `user:${req.session.user.id}` : `ip:${req.ip}`,
  skip: req => skipInDevelopment(req) || process.env.HTTP_RATE_LIMIT_PER_15_MIN === '0',
  message: {
    success: false,
    error: 'Too many requests',
    message: 'Too many requests from this IP, please try again after 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json(options.message);
  }
});

/**
 * Strict rate limiter for authentication endpoints
 * 20 attempts per 15 minutes per IP (allows for typos)
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Allow for typos and multiple attempts
  skip: skipInDevelopment,
  message: {
    success: false,
    error: 'Too many login attempts',
    message: 'Too many login attempts from this IP, please try again after 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json(options.message);
  }
});

/**
 * Account creation rate limiter
 * 10 accounts per hour per IP (allows for family/shared networks)
 */
const accountCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Allow for shared networks/families
  skip: skipInDevelopment,
  message: {
    success: false,
    error: 'Account creation limit reached',
    message: 'Too many accounts created from this IP, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json(options.message);
  }
});

/**
 * API rate limiter for external API calls
 * 200 requests per minute per IP (generous for SPA navigation)
 */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200, // Generous for SPA with lots of API calls
  skip: skipInDevelopment,
  message: {
    success: false,
    error: 'API rate limit exceeded',
    message: 'Too many API requests, please slow down'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json(options.message);
  }
});

/**
 * Very lenient limiter for static assets and public pages
 * 5000 requests per 15 minutes per IP (basically unlimited for normal use)
 */
const lenientLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // Essentially unlimited for normal browsing
  skip: skipInDevelopment,
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  defaultLimiter,
  authLimiter,
  accountCreationLimiter,
  apiLimiter,
  lenientLimiter,
};
