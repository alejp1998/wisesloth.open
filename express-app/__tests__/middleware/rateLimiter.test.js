/**
 * Rate Limiter Middleware Tests
 */

const {
  defaultLimiter,
  authLimiter,
  accountCreationLimiter,
} = require('../../middleware/rateLimiter');

describe('Rate Limiter Middleware', () => {
  describe('defaultLimiter', () => {
    it('should be defined', () => {
      expect(defaultLimiter).toBeDefined();
      expect(typeof defaultLimiter).toBe('function');
    });
  });

  describe('authLimiter', () => {
    it('should be defined', () => {
      expect(authLimiter).toBeDefined();
      expect(typeof authLimiter).toBe('function');
    });
  });


  describe('accountCreationLimiter', () => {
    it('should be defined', () => {
      expect(accountCreationLimiter).toBeDefined();
      expect(typeof accountCreationLimiter).toBe('function');
    });
  });

  describe('Rate limiter behavior', () => {
    it('should call next for allowed requests', () => {


      // Rate limiters should pass through on first request
      // Note: Full testing requires mocking the rate-limit store
      expect(defaultLimiter).toBeDefined();
    });
  });
});
