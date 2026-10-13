'use strict';

// Browser mutation requests carry Origin. Never infer the trusted origin from
// Host or forwarded headers, which can be controlled by clients.
function sameOrigin(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const expected = new URL(process.env.APP_URL || 'http://localhost:8080').origin;
  if (req.get('Origin') !== expected) {
    return res.status(403).json({ error: 'Request origin does not match APP_URL.' });
  }
  return next();
}

module.exports = { sameOrigin };
