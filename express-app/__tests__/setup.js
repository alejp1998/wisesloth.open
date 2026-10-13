/**
 * Jest Test Setup
 * Global configuration and utilities for all tests
 */

// Set test environment
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-session-secret';
process.env.CSRF_SECRET = 'test-csrf-secret';

// Increase timeout for database operations
jest.setTimeout(30000);

// Mock console methods to reduce noise in test output
const originalConsole = { ...console };

beforeAll(() => {
  // Silence console during tests (optional - comment out to see logs)
  console.log = jest.fn();
  console.info = jest.fn();
  console.time = jest.fn();
  console.timeEnd = jest.fn();
  console.timeLog = jest.fn();
  // Keep error and warn for debugging
  // console.error = jest.fn();
  // console.warn = jest.fn();
});

afterAll(() => {
  // Restore console
  console.log = originalConsole.log;
  console.info = originalConsole.info;
  console.error = originalConsole.error;
  console.warn = originalConsole.warn;
  console.time = originalConsole.time;
  console.timeEnd = originalConsole.timeEnd;
  console.timeLog = originalConsole.timeLog;
});

// Global test utilities
global.testUtils = {
  /**
   * Create a mock request object
   */
  mockRequest: (overrides = {}) => ({
    body: {},
    params: {},
    query: {},
    headers: {},
    session: {
      user: null,
      chosenLanguage: 'en',
      chosenTheme: 'light',
      save: jest.fn((cb) => cb && cb()),
    },
    cookies: {},
    ip: '127.0.0.1',
    method: 'GET',
    url: '/',
    originalUrl: '/',
    path: '/',
    ...overrides,
  }),

  /**
   * Create a mock response object
   */
  mockResponse: () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    res.render = jest.fn().mockReturnValue(res);
    res.redirect = jest.fn().mockReturnValue(res);
    res.cookie = jest.fn().mockReturnValue(res);
    res.clearCookie = jest.fn().mockReturnValue(res);
    res.setHeader = jest.fn().mockReturnValue(res);
    res.locals = {};
    return res;
  },

  /**
   * Create a mock next function
   */
  mockNext: () => jest.fn(),

  /**
   * Create a mock user object
   */
  mockUser: (overrides = {}) => ({
    id: 1,
    username: 'testuser',
    name: 'Test User',
    desc: 'A test user',
    email: 'test@example.com',
    isAdmin: false,
    isEditor: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  /**
   * Create a mock admin user
   */
  mockAdminUser: (overrides = {}) => ({
    id: 999,
    username: 'admin',
    name: 'Admin User',
    desc: 'An admin user',
    email: 'admin@example.com',
    isAdmin: true,
    isEditor: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  /**
   * Wait for a specified time
   */
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * Generate a random string
   */
  randomString: (length = 10) => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },
};

// Handle unhandled promise rejections in tests
process.on('unhandledRejection', (reason, _promise) => {
  console.error('Unhandled Rejection in test:', reason);
});
