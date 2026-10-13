/**
 * Middleware Index
 * Exports all middleware for easy importing
 */

const { AppError, logger, errorHandler, asyncHandler, notFoundHandler } = require('./errorHandler');
const {
  validate,
  sanitizers,
  validationRules,
  sanitizeRequestBody,
  stripDangerousTags,
  body,
  param,
  query,
  validationResult
} = require('./validation');
const {
  defaultLimiter,
  authLimiter,
  accountCreationLimiter,
  apiLimiter,
  lenientLimiter
} = require('./rateLimiter');
const { sameOrigin } = require('./same-origin');
const {
  logger: pinoLogger,
  httpLogger,
  loggers,
  logUtils,
  attachLogger,
  createModuleLogger
} = require('./logger');

module.exports = {
  // Error handling
  AppError,
  logger,
  errorHandler,
  asyncHandler,
  notFoundHandler,

  // Validation & Sanitization
  validate,
  sanitizers,
  validationRules,
  sanitizeRequestBody,
  stripDangerousTags,
  body,
  param,
  query,
  validationResult,

  // Rate limiting
  defaultLimiter,
  authLimiter,
  accountCreationLimiter,
  apiLimiter,
  lenientLimiter,

  sameOrigin,

  // Structured Logging
  pinoLogger,
  httpLogger,
  loggers,
  logUtils,
  attachLogger,
  createModuleLogger
};
