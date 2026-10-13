/**
 * User Validation Module
 * Contains all validation logic for user-related operations
 */

'use strict';

const { models } = require('../models');
const { User } = models;

// Constants
const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 15;
const NAME_MAX_LENGTH = 50;
const DESC_MAX_LENGTH = 300;

const FORBIDDEN_WORDS = [
  'temp', 'deleted', 'admin', 'editor', 'root',
  'superuser', 'moderator', 'mod', 'administrator'
];

const FORBIDDEN_PREFIXES = ['t-', 'temp-', 'deleted-'];

/**
 * Validate username format and availability
 * @param {string} username - Username to validate
 * @param {string} [currentUsername] - Current username (for update validation)
 * @returns {Promise<{isValid: boolean, errors: string[]}>}
 */
async function validateUsername(username, currentUsername = null) {
  const errors = [];

  // Skip validation if username hasn't changed
  if (currentUsername && username === currentUsername) {
    return { isValid: true, errors: [] };
  }

  // Check length
  if (username.length < USERNAME_MIN_LENGTH || username.length > USERNAME_MAX_LENGTH) {
    errors.push(`Username must be between ${USERNAME_MIN_LENGTH} and ${USERNAME_MAX_LENGTH} characters long.`);
  }

  // Check for valid characters (lowercase alphanumeric and dashes only)
  const pattern = /^[a-z0-9-]+$/;
  if (!pattern.test(username)) {
    errors.push('Username can only contain lowercase letters, numbers, and dashes.');
  }

  // Check for forbidden words
  if (FORBIDDEN_WORDS.some((word) => username.includes(word))) {
    errors.push('Username cannot contain reserved words like \'admin\', \'deleted\', \'moderator\', etc.');
  }

  // Check dash positioning
  if (username.startsWith('-') || username.endsWith('-')) {
    errors.push('Username cannot start or end with a dash.');
  }

  // Check forbidden prefixes
  if (FORBIDDEN_PREFIXES.some((prefix) => username.startsWith(prefix))) {
    errors.push('Username cannot start with reserved prefixes like \'t-\', \'temp-\', or \'deleted-\'.');
  }

  // Check availability in database
  if (errors.length === 0) {
    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      errors.push('Username is already in use.');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate user name
 * @param {string} name - Name to validate
 * @returns {{isValid: boolean, errors: string[]}}
 */
function validateName(name) {
  const errors = [];

  if (name && name.length > NAME_MAX_LENGTH) {
    errors.push(`Name must be under ${NAME_MAX_LENGTH} characters long.`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate user description
 * @param {string} desc - Description to validate
 * @returns {{isValid: boolean, errors: string[]}}
 */
function validateDescription(desc) {
  const errors = [];

  if (desc && desc.length > DESC_MAX_LENGTH) {
    errors.push(`Description must be under ${DESC_MAX_LENGTH} characters long.`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate complete user update payload
 * @param {Object} userData - User data to validate
 * @param {string} [currentUsername] - Current username (for update)
 * @returns {Promise<{isValid: boolean, errors: string[]}>}
 */
async function validateUserUpdate(userData, currentUsername = null) {
  const allErrors = [];

  // Validate username if provided
  if (userData.username !== undefined) {
    const usernameResult = await validateUsername(userData.username, currentUsername);
    allErrors.push(...usernameResult.errors);
  }

  // Validate name if provided
  if (userData.name !== undefined) {
    const nameResult = validateName(userData.name);
    allErrors.push(...nameResult.errors);
  }

  // Validate description if provided
  if (userData.desc !== undefined) {
    const descResult = validateDescription(userData.desc);
    allErrors.push(...descResult.errors);
  }

  return {
    isValid: allErrors.length === 0,
    errors: allErrors
  };
}

/**
 * Check if user has permission to modify target user
 * @param {Object} sessionUser - Current session user
 * @param {string} targetUsername - Target user's username
 * @returns {{allowed: boolean, reason: string|null}}
 */
function checkUserPermission(sessionUser, targetUsername) {
  if (!sessionUser) {
    return { allowed: false, reason: 'Authentication required.' };
  }

  const isOwner = sessionUser.username === targetUsername;
  const isAdmin = sessionUser.isAdmin === true;

  if (!isOwner && !isAdmin) {
    return { allowed: false, reason: 'You are not authorized to modify this user.' };
  }


  return { allowed: true, reason: null };
}

module.exports = {
  validateUsername,
  validateName,
  validateDescription,
  validateUserUpdate,
  checkUserPermission,
  // Export constants for testing
  USERNAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  NAME_MAX_LENGTH,
  DESC_MAX_LENGTH,
  FORBIDDEN_WORDS,
  FORBIDDEN_PREFIXES
};
