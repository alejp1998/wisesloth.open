/**
 * Input Validation & Sanitization Middleware
 * Uses express-validator for request validation
 */

const { body, param, query, validationResult } = require('express-validator');

/**
 * Validation result handler
 * Checks for validation errors and returns them in a consistent format
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};

/**
 * Common sanitization rules
 */
const sanitizers = {
  // Sanitize string inputs - trim and escape HTML
  cleanString: (field) => body(field)
    .trim()
    .escape(),

  // Sanitize and validate email
  cleanEmail: (field = 'email') => body(field)
    .trim()
    .toLowerCase()
    .isEmail()
    .withMessage('Invalid email address')
    .normalizeEmail(),

  // Sanitize username - alphanumeric with underscores
  cleanUsername: (field = 'username') => body(field)
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),

  // Sanitize ID parameters
  cleanId: (field = 'id') => param(field)
    .isInt({ min: 1 })
    .withMessage('Invalid ID format')
    .toInt(),

  // Sanitize pagination parameters
  cleanPagination: () => [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer')
      .toInt(),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
      .toInt()
  ],

  // Sanitize search query
  cleanSearch: (field = 'q') => query(field)
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Search query too long')
    .escape()
};

/**
 * Common validation rules for different entities
 */
const validationRules = {
  // User registration validation
  userRegistration: [
    body('email')
      .trim()
      .toLowerCase()
      .isEmail()
      .withMessage('Please provide a valid email address')
      .normalizeEmail(),
    body('username')
      .trim()
      .isLength({ min: 3, max: 30 })
      .withMessage('Username must be between 3 and 30 characters')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username can only contain letters, numbers, and underscores'),
    body('password')
      .optional()
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long')
  ],

  // Test/Quiz creation validation
  testCreation: [
    body('title')
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage('Title must be between 1 and 200 characters')
      .escape(),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 2000 })
      .withMessage('Description cannot exceed 2000 characters'),
    body('language')
      .optional()
      .isIn(['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko'])
      .withMessage('Invalid language code'),
    body('visibility')
      .optional()
      .isIn(['public', 'private', 'unlisted'])
      .withMessage('Visibility must be public, private, or unlisted')
  ],

  // Test/Quiz answer submission
  answerSubmission: [
    body('answers')
      .isArray({ min: 1 })
      .withMessage('Answers must be a non-empty array'),
    body('answers.*.questionId')
      .isInt({ min: 1 })
      .withMessage('Invalid question ID'),
    body('answers.*.answer')
      .exists()
      .withMessage('Answer is required')
  ],

  // ID parameter validation
  idParam: [
    param('id')
      .isInt({ min: 1 })
      .withMessage('Invalid ID')
      .toInt()
  ],

  // Pagination validation
  pagination: [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .toInt()
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .toInt()
      .withMessage('Limit must be between 1 and 100')
  ]
};

/**
 * XSS protection - strips potentially dangerous HTML tags
 */
const stripDangerousTags = (value) => {
  if (typeof value !== 'string') return value;

  // Remove script tags and their content
  value = value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove event handlers
  value = value.replace(/\s*on\w+\s*=\s*(['"])[^'"]*\1/gi, '');

  // Remove javascript: URLs
  value = value.replace(/javascript:/gi, '');

  return value;
};

/**
 * Custom sanitizer middleware for request body
 * Recursively sanitizes all string values in the request body
 */
const sanitizeRequestBody = (req, res, next) => {
  const sanitizeValue = (value) => {
    if (typeof value === 'string') {
      return stripDangerousTags(value);
    }
    if (Array.isArray(value)) {
      return value.map(sanitizeValue);
    }
    if (typeof value === 'object' && value !== null) {
      const sanitized = {};
      for (const key in value) {
        // Use Object.prototype.hasOwnProperty.call so null-prototype objects
        // (produced by express.urlencoded with extended: false) don't crash
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          sanitized[key] = sanitizeValue(value[key]);
        }
      }
      return sanitized;
    }
    return value;
  };

  if (req.body) {
    req.body = sanitizeValue(req.body);
  }

  next();
};

module.exports = {
  validate,
  sanitizers,
  validationRules,
  sanitizeRequestBody,
  stripDangerousTags,
  // Re-export express-validator functions for convenience
  body,
  param,
  query,
  validationResult
};
