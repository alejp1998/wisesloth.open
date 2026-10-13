/**
 * Services Index
 * Exports all service modules for easy importing
 */

const userService = require('./user.service');
const userValidation = require('./user.validation');

module.exports = {
  userService,
  userValidation,
};
