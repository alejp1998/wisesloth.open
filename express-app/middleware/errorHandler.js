/**
 * Centralized Error Handling Middleware
 * Provides consistent error responses and logging across the application
 */

/**
 * Custom Application Error class
 * Use this to throw errors with specific status codes
 */
class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Simple logger for error tracking
 * In production, consider integrating with services like Sentry, LogRocket, etc.
 */
const logger = {
  error: (message, meta = {}) => {
    const logEntry = {
      level: 'error',
      timestamp: new Date().toISOString(),
      message,
      ...meta
    };
    console.error(JSON.stringify(logEntry));
  },
  warn: (message, meta = {}) => {
    const logEntry = {
      level: 'warn',
      timestamp: new Date().toISOString(),
      message,
      ...meta
    };
    console.warn(JSON.stringify(logEntry));
  },
  info: (message, meta = {}) => {
    const logEntry = {
      level: 'info',
      timestamp: new Date().toISOString(),
      message,
      ...meta
    };
    console.log(JSON.stringify(logEntry));
  }
};

/**
 * Error handler middleware
 * Logs errors and sends appropriate responses based on environment
 */
const errorHandler = (err, req, res, _next) => {
  // Default to 500 if no status code is set
  err.statusCode = err.statusCode || err.status || 500;

  // Log the error with context
  logger.error(err.message, {
    statusCode: err.statusCode,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userId: req.session?.user?.id || 'anonymous'
  });

  // Handle validation errors from express-validator
  if (err.array && typeof err.array === 'function') {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: err.array()
    });
  }

  // Handle Sequelize validation errors
  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: process.env.NODE_ENV === 'production'
        ? 'Invalid data provided'
        : err.errors?.map(e => e.message) || err.message
    });
  }

  // Handle Sequelize database errors
  if (err.name === 'SequelizeDatabaseError') {
    return res.status(500).json({
      success: false,
      error: process.env.NODE_ENV === 'production'
        ? 'Database error occurred'
        : err.message
    });
  }

  // If it was an AJAX request, return JSON
  if (req.xhr || req.query.ajax || req.headers.accept?.includes('application/json')) {
    return res.status(err.statusCode).json({
      success: false,
      error: process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
  }

  // For non-AJAX requests, render the error page
  res.locals.message = err.message;
  res.locals.error = process.env.NODE_ENV === 'development' ? err : {};
  res.status(err.statusCode);
  res.render('error');
};

/**
 * Async handler wrapper
 * Wraps async route handlers to catch errors and pass them to the error handler
 * Usage: router.get('/route', asyncHandler(async (req, res) => { ... }))
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Not found handler
 * Use as a catch-all for routes that don't exist
 */
const notFoundHandler = (req, res, next) => {
  const error = new AppError(`Route ${req.originalUrl} not found`, 404);
  next(error);
};

module.exports = {
  AppError,
  logger,
  errorHandler,
  asyncHandler,
  notFoundHandler
};
