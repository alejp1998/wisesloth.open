/**
 * Structured Logging with Pino
 * High-performance JSON logging for production environments
 */

const pino = require('pino');
const pinoHttp = require('pino-http');
const crypto = require('crypto');

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

// Base logger configuration
const loggerConfig = {
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),

  // Redact sensitive fields from logs
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.confirmPassword',
      'req.body.currentPassword',
      'req.body.newPassword',
      'req.body.email',
      'req.body.creditCard',
      'res.headers["set-cookie"]'
    ],
    remove: true
  },

  // Custom serializers for common objects
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      path: req.path || req.url?.split('?')[0],
      query: req.query,
      params: req.params,
      headers: {
        'user-agent': req.headers?.['user-agent'],
        'content-type': req.headers?.['content-type'],
        'accept': req.headers?.['accept'],
        'x-forwarded-for': req.headers?.['x-forwarded-for'],
        'x-real-ip': req.headers?.['x-real-ip']
      },
      remoteAddress: req.remoteAddress || req.socket?.remoteAddress
    }),
    res: (res) => ({
      statusCode: res.statusCode
    }),
    err: pino.stdSerializers.err
  },

  // Add timestamp
  timestamp: pino.stdTimeFunctions.isoTime,

  // Format options based on environment
  formatters: {
    level: (label) => ({ level: label }),
    bindings: (bindings) => ({
      pid: bindings.pid,
      hostname: bindings.hostname,
      service: 'wisesloth-express',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    })
  }
};

// Use pretty printing in development
const transport = isDevelopment
  ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname',
      singleLine: false
    }
  }
  : undefined;

// Create the main logger instance
const logger = pino({
  ...loggerConfig,
  transport
});

// HTTP request logger middleware
const httpLogger = pinoHttp({
  logger,

  // Generate unique request ID
  genReqId: (req) => {
    return req.headers['x-request-id'] ||
           req.headers['x-correlation-id'] ||
           crypto.randomUUID();
  },

  // Custom success message
  customSuccessMessage: (req, _res) => {
    return `${req.method} ${req.url} completed`;
  },

  // Custom error message
  customErrorMessage: (req, res, _err) => {
    return `${req.method} ${req.url} errored with ${res.statusCode}`;
  },

  // Customize log level based on response status
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    if (res.statusCode >= 300) return 'silent'; // Don't log redirects
    return 'info';
  },

  // Don't log these paths (health checks, static files)
  autoLogging: {
    ignore: (req) => {
      const ignorePaths = ['/health', '/ready', '/favicon.ico'];
      return ignorePaths.some(path => req.url?.startsWith(path));
    }
  },

  // Custom attributes to add to every log
  customProps: (req, _res) => ({
    userId: req.session?.user?.id,
    sessionId: req.sessionID,
    userAgent: req.headers?.['user-agent']
  })
});

// Child logger factory for specific modules
const createModuleLogger = (moduleName) => {
  return logger.child({ module: moduleName });
};

// Specialized loggers for different concerns
const loggers = {
  // Database operations logger
  db: createModuleLogger('database'),

  // Authentication logger
  auth: createModuleLogger('auth'),

  // API logger
  api: createModuleLogger('api'),

  // Cache operations logger
  cache: createModuleLogger('cache'),

  // Business logic logger
  business: createModuleLogger('business'),

  // Security events logger
  security: createModuleLogger('security')
};

// Utility functions for common log patterns
const logUtils = {
  /**
   * Log a user action
   */
  userAction: (userId, action, details = {}) => {
    loggers.business.info({
      event: 'user_action',
      userId,
      action,
      ...details
    });
  },

  /**
   * Log a security event
   */
  securityEvent: (type, details = {}) => {
    loggers.security.warn({
      event: 'security_event',
      type,
      ...details
    });
  },

  /**
   * Log database query performance
   */
  dbQuery: (query, duration, details = {}) => {
    const level = duration > 1000 ? 'warn' : 'debug';
    loggers.db[level]({
      event: 'db_query',
      duration,
      slow: duration > 1000,
      query: query.substring(0, 200), // Truncate long queries
      ...details
    });
  },

  /**
   * Log cache operations
   */
  cacheOp: (operation, key, hit = null, details = {}) => {
    loggers.cache.debug({
      event: 'cache_operation',
      operation,
      key,
      hit,
      ...details
    });
  },

  /**
   * Log API calls to external services
   */
  externalApi: (service, endpoint, duration, statusCode, details = {}) => {
    const level = statusCode >= 400 ? 'error' : duration > 5000 ? 'warn' : 'info';
    loggers.api[level]({
      event: 'external_api_call',
      service,
      endpoint,
      duration,
      statusCode,
      slow: duration > 5000,
      ...details
    });
  },

  /**
   * Log authentication events
   */
  authEvent: (type, userId, success, details = {}) => {
    const level = success ? 'info' : 'warn';
    loggers.auth[level]({
      event: 'auth_event',
      type,
      userId,
      success,
      ...details
    });
  }
};

// Express middleware to attach logger to request
const attachLogger = (req, res, next) => {
  req.log = logger.child({ requestId: req.id });
  next();
};

module.exports = {
  logger,
  httpLogger,
  loggers,
  logUtils,
  attachLogger,
  createModuleLogger
};
