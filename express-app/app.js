// BASIC REQUIRES
const express = require('express');
const path = require('path');
const process = require('process');

// Load environment variables from .env file (project root)
// In Docker, env vars are injected by compose, so file may not exist
const dotenvResult = require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
if (dotenvResult.error && dotenvResult.error.code !== 'ENOENT') {
  console.warn('Warning: Error loading .env file:', dotenvResult.error.message);
}

// Validate environment variables at startup
const { validateEnv, isProduction } = require('./helpers/validateEnv');
validateEnv(true); // Exit on error in production

const partials = require('express-partials');
const favicon = require('serve-favicon');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const session = require('express-session');
const methodOverride = require('method-override');

// Performance: GZIP compression
const compression = require('compression');

// ENVIRONMENT VARIABLES
const env = process.env.NODE_ENV || 'development';
// Print the current status of the environment
console.log(`Environment is set to ${env.toUpperCase()}`);
// Deactivate the console.time and console.timeEnd functions in production
if (env === 'production') {
  console.time = console.timeEnd = console.timeLog = () => {};
} else {
  console.time('Server started in');
}

// EXTRA REQUIRES
// Encryption library for generating random tokens
const crypto = require('crypto');

// Import security headers with Helmet
const helmet = require('helmet');

// Import cross-origin resource sharing (CORS) middleware to improve
// security by allowing only specific origins to make requests to the server

// Import rate limiting middleware
const { defaultLimiter  } = require('./middleware/rateLimiter');

// Import centralized error handling middleware
const { errorHandler } = require('./middleware/errorHandler');

// Import input validation/sanitization middleware


// Session store for Sequelize
const SequelizeStore = require('connect-session-sequelize')(session.Store);

// INNER REQUIRES
// Import routes from the routes folder (index.js)
const indexRouter = require('./routes/index');

// Import the database connection and models
const sequelize = require('./models');

// Import languages dictionary from the helpers folder
const languagesDict = require('./helpers/languages');

// Import faqs and tips list from the helpers folder
const { faqsList, tipsList } = require('./helpers/faq-and-tips');

// Import formatTimeLeft and formatTimeAgo functions
const { formatTimeLeft, formatTimeAgo } = require('./helpers/format-time');

const { sameOrigin } = require('./middleware/same-origin');
const { DEFAULT_SKILLS } = require('./helpers/skills');

// Import helmetDirectives from the helpers folder


// CONSTANTS
// Not found error HTML page
const NOT_FOUND_HTML = () => `<!DOCTYPE html><html lang="en"><head>
<title>404 - WiseSloth.open</title><meta name="robots" content="noindex"></head>
<body><h1>Page not found</h1><p><a href="/">Return to WiseSloth.open</a></p></body></html>`;


// INITIALIZE APP
// Create the express app and set it up
const app = express();
// Disable sharing app version with the public
app.disable('x-powered-by');
// Trust the reverse proxy (needed for secure cookies behind nginx)
app.set('trust proxy', process.env.TRUST_PROXY === '1' ? 1 : false);


app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

// Enable GZIP compression for all responses
// This significantly reduces response size and improves performance
app.use(compression({
  filter: (req, res) => {
    // Don't compress responses with this request header
    if (req.headers['x-no-compression']) {
      return false;
    }
    // Use compression filter function
    return compression.filter(req, res);
  },
  level: 6 // Balanced compression level (1-9, 6 is default)
}));

// Apply default rate limiting to all routes


// Content Security Policy (CSP) middleware with Helmet
// app.use(helmet.contentSecurityPolicy(
//   {
//     useDefaults: true,
//     directives: helmetDirectives
//   }
// ));

// Middleware to generate nonces
app.use((req, res, next) => {
  // Generate a base64 nonce
  res.locals.nonce = crypto.randomBytes(16).toString('base64');
  next();
});

// Apply the minifyHTML middleware to all routes


// View engine setup (EJS)
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Middleware setup (express)
app.use(favicon(path.join(__dirname, 'public', 'images/favicon.ico')));
// Use appropriate logging format based on environment
app.use(logger(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' })); // Add request size limit
app.use(express.urlencoded({ extended: false, limit: '10mb' }));
app.use(cookieParser());

// Apply input sanitization to all requests


// Health check endpoint for Docker and monitoring
// This should be early in the middleware chain for fast responses
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Readiness check - includes database connectivity
app.get('/ready', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.status(200).json({
      status: 'ready',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      database: 'disconnected',
      error: process.env.NODE_ENV === 'production' ? 'Database connection failed' : error.message
    });
  }
});

// Static files setup (public folder) with caching
// Set cache headers based on environment
const staticOptions = {
  etag: true, // Enable ETags for cache validation
  lastModified: true,
  maxAge: process.env.NODE_ENV === 'production'
    ? '1d' // Cache for 1 day in production
    : 0,   // No cache in development
  setHeaders: (res, filePath) => {
    // Versioned assets (?v=...) change URL on every update → safe to cache a year
    const reqUrl = res.req ? res.req.url : '';
    if (reqUrl.includes('v=')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // 1 year
    }
    // Set longer cache for immutable assets (fonts, images with hashes)
    else if (filePath.includes('/fonts/') || filePath.match(/\.[a-f0-9]{8}\./)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // 1 year
    }
    // Set medium cache for images
    else if (filePath.match(/\.(jpg|jpeg|png|gif|ico|svg|webp)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=604800'); // 1 week
    }
    // Set shorter cache for CSS/JS (may change more frequently)
    else if (filePath.match(/\.(css|js)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=604800'); // 1 week
    }
  }
};
app.use(express.static(path.join(__dirname, 'public'), staticOptions));

// Store session in the database
// Session duration: 7 days for "remember me", 24 hours for regular sessions
const SESSION_DURATION_REMEMBER = 7 * 24 * 60 * 60 * 1000; // 7 days
const SESSION_DURATION_DEFAULT = 24 * 60 * 60 * 1000; // 24 hours

const sessionStore = new SequelizeStore({
  db: sequelize,
  table: 'session',
  checkExpirationInterval: 15 * 60 * 1000, // The interval at which to cleanup expired sessions in milliseconds.
  expiration: SESSION_DURATION_REMEMBER, // Maximum possible session age
});

// Use sessionStore for session management
// Configure secure session with proper cookie settings
const isProductionEnv = process.env.NODE_ENV === 'production';

// Validate session secret in production
if (isProductionEnv && !process.env.SESSION_SECRET) {
  console.error('❌ CRITICAL: SESSION_SECRET must be set in production!');
  process.exit(1);
}

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'fallback-dev-secret-change-in-production',
    store: sessionStore,
    resave: false,
    saveUninitialized: false, // Don't create session until something stored (GDPR compliance)
    name: 'wisesloth.sid', // Custom session cookie name (don't use default 'connect.sid')
    rolling: true, // Reset cookie expiration on every response (extends session on activity)
    cookie: {
      secure: new URL(process.env.APP_URL || 'http://localhost:8080').protocol === 'https:', // Only send cookie over HTTPS in production
      httpOnly: true, // Prevent client-side JS from reading the cookie
      sameSite: 'lax', // CSRF protection
      maxAge: SESSION_DURATION_DEFAULT, // Default 24 hours (can be extended by "remember me")
      domain: undefined // Share across subdomains in production
    }
  })
);

app.use(defaultLimiter);

// Middleware to extend session for "remember me" users
app.use((req, res, next) => {
  // If user opted for "remember me", extend session to 7 days
  if (req.session && req.session.rememberMe) {
    req.session.cookie.maxAge = SESSION_DURATION_REMEMBER;
  }
  next();
});

// Set the chosen language and theme in the session
app.use((req, res, next) => {
  req.session.chosenLanguage = req.session.chosenLanguage || 'en';
  req.session.chosenTheme = req.session.chosenTheme || 'light';
  next();
});

// Page-asset flags: only load MathJax / Chart.js on pages that render quiz
// math or result charts. Home, community, help, etc. skip ~1.3 MB of scripts.
app.use((req, res, next) => {
  const p = req.path;
  const isTestPage = /^\/tests\/[^/]+\/(try|edit|edit-flashcards|flashcards)?$/.test(p) ||
    /^\/tests\/[^/]+$/.test(p) || // /tests/:id/ (show)
    p === '/tests' || p.startsWith('/tests?');
  const needsMath = isTestPage ||
    p.startsWith('/livebattle/') || // lobby renders test-quiz partial
    /^\/results\//.test(p) || // results show renders quiz text
    p.startsWith('/users/');
  const needsCharts = isTestPage || p.startsWith('/users/') ||
    p.startsWith('/livebattle/') || /^\/results\//.test(p);
  res.locals.needsMath = !!needsMath;
  res.locals.needsCharts = !!needsCharts;
  next();
});

// Refresh roles so other sessions cannot retain revoked admin privileges.
app.use(async (req, res, next) => {
  try {
    if (req.session.user) {
      const user = await sequelize.models.User.findByPk(req.session.user.id, {
        attributes: ['id', 'username', 'isAdmin', 'isEditor'],
      });
      if (!user || user.username.startsWith('deleted-')) req.session.user = null;
      else Object.assign(req.session.user, { username: user.username, isAdmin: user.isAdmin, isEditor: user.isEditor });
    }
    next();
  } catch (error) { next(error); }
});

// Dynamic Helpers setup
app.use((req, res, next) => {
  // Monthly tokens constants
  res.locals.appUrl = new URL(process.env.APP_URL || 'http://localhost:8080').origin;
  res.locals.safeJson = require('./helpers/safe-json').safeJson;

  // Default example skills for the creation view
  res.locals.DEFAULT_SKILLS = DEFAULT_SKILLS;

  // Languages dictionary (for the language dropdown and supported languages)
  res.locals.languagesDict = languagesDict;

  // FAQ and tips list
  res.locals.faqsList = faqsList;
  res.locals.tipsList = tipsList;

  // Format time functions (formatTimeLeft and formatTimeAgo)
  res.locals.formatTimeLeft = formatTimeLeft;
  res.locals.formatTimeAgo = formatTimeAgo;

  // Paginate control variables (for pagination)
  res.locals.paginateControl = {};

  // URL variables (for active links)
  res.locals.url = req.url;

  // Session variables
  res.locals.session = req.session;

  // User checks
  res.locals.isLoggedIn = !!req.session.user;
  res.locals.isAdmin = res.locals.isLoggedIn && req.session.user.isAdmin;

  // Language variables
  res.locals.lang = req.session.chosenLanguage;

  // Theme variables
  res.locals.theme = req.session.chosenTheme || 'light';

  // Environment flag for conditional script loading
  res.locals.isProduction = isProduction();

  // Print the size of the sesssion object req.session in bytes (for testing)
  // console.log(`Session: ${JSON.stringify(req.session)}`);
  // console.log(`Session size: ${Buffer.byteLength(JSON.stringify(req.session), 'utf8')} bytes`);
  next();
});

// Override with POST and GET
app.use(methodOverride('_method', { methods: ['POST'] }));
app.use(sameOrigin);

// Use partials for views (set some variables globally)
app.use(partials());

// Routes setup (index.js)
app.get('/uploads/:filename', async (req, res, next) => {
  try {
    const match = /^([a-f0-9-]{36})\.webp$/.exec(req.params.filename);
    if (!match) return res.sendStatus(404);
    const quiz = await sequelize.models.Quiz.findByPk(match[1], { attributes: ['testId'] });
    const test = quiz && await sequelize.models.Test.findByPk(quiz.testId, { attributes: ['userId', 'visibility'] });
    if (!test || !require('./helpers/test-access').canReadTest(test, req.session.user)) return res.sendStatus(404);
    return res.sendFile(req.params.filename, {
      root: process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads'),
      dotfiles: 'deny', headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) { return next(error); }
});

app.use('/', indexRouter);

// 404 error handling for non-existent routes
// should be fast and simple with emojis
// dont index this page
app.use(function (req, res) {
  res.status(404).send(NOT_FOUND_HTML(req));
});

// Centralized error handling middleware
// This handles all errors and provides consistent responses
app.use(errorHandler);

// Start the server on the specified port
const port = process.env.PORT || 8080; // Use the environment variable PORT or default to 8080

// Sync the database and start the server
const server = app.listen(port, () => {
  const startupTime = process.uptime().toFixed(2);
  const memUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

  console.log(`
🦥 WiseSloth.open Server Started Successfully!

🌐 URL:          http://localhost:${port}
🔧 Environment:  ${(process.env.NODE_ENV || 'development').toUpperCase()}
📦 Node.js:      ${process.version}
⏱️ Startup:      ${startupTime}s
💾 Memory:       ${memUsage} MB
📅 Started:      ${new Date().toLocaleString()}
`);
});

// Sync the database and start the server
console.timeEnd('Server started in');

// ============================================
// GRACEFUL SHUTDOWN HANDLING
// ============================================
// Handle process termination signals for clean shutdown
// This ensures connections are properly closed on deployment/restart

const gracefulShutdown = (signal) => {
  console.log(`\n⚠️  ${signal} received. Starting graceful shutdown...`);

  // Stop accepting new connections
  server.close((err) => {
    if (err) {
      console.error('❌ Error during server close:', err);
      process.exit(1);
    }

    console.log('✅ HTTP server closed');

    // Close database connections
    sequelize.close()
      .then(() => {
        console.log('✅ Database connections closed');
        console.log('👋 Graceful shutdown complete');
        process.exit(0);
      })
      .catch((dbErr) => {
        console.error('❌ Error closing database connections:', dbErr);
        process.exit(1);
      });
  });

  // Force shutdown after 30 seconds if graceful shutdown fails
  setTimeout(() => {
    console.error('❌ Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);
};

// Listen for termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM')); // Docker/Kubernetes stop
process.on('SIGINT', () => gracefulShutdown('SIGINT'));   // Ctrl+C

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  gracefulShutdown('uncaughtException');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit on unhandled rejections, just log them
});

module.exports = app;
