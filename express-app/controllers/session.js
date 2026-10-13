// HELPERS
const { loadTemplateContent, getRenderedTemplate } = require('../helpers/load-template-content');

// CONSTANTS
const LOGIN_REQUIRED_TEMPLATE_CONTENT = loadTemplateContent('login-required');

// Middleware: Login required
exports.loginRequired = (req, res, next) => {
  if (req.session.user) {
    next();
  } else {
    // If it was an ajax request return a JSON response
    if (req.query.ajax) {
      // Render the login required template
      const loginRequiredHTML = getRenderedTemplate(LOGIN_REQUIRED_TEMPLATE_CONTENT, res.locals);
      // Set response status to 401 (Unauthorized)
      res.status(401);
      return res.json({ renderedHTML: loginRequiredHTML });
    }
    // Set the response status to 401 (Unauthorized)
    res.status(401);
    // Render the login required template
    res.render('login-required.ejs');
  }
};

// Middleware: Login required for API calls
exports.loginRequiredAPI = (req, res, next) => {
  if (req.session.user) {
    next();
  } else {
    res.status(401);
    res.json({ error: 'Login required' });
  }
};

// Common function to redirect to the login page with an error message


// Middleware that allows access only to admins
exports.adminRequired = (req, res, next) => {
  if (isAdmin(req)) {
    next();
  } else {
    handleProhibitedRoute(res, 'admin');
  }
};

// Middleware that allows access to authors and admin
exports.adminOrAuthorRequired = (req, res, next) => {
  if (isAdmin(req) || req.test.userId === req.session.user.id) {
    next();
  } else {
    handleProhibitedRoute(res, 'admin or author');
  }
};

// Middleware that allows access to authors and admin
exports.adminOrExamineeRequired = (req, res, next) => {
  if (isAdmin(req) || req.result.userId === req.session.user.id) {
    next();
  } else {
    handleProhibitedRoute(res, 'admin or examinee');
  }
};

// Middleware that allows access to admins and editors
exports.adminOrEditorRequired = (req, res, next) => {
  if (isAdmin(req) || isEditor(req)) {
    next();
  } else {
    handleProhibitedRoute(res, 'admin or editor');
  }
};

// Middleware that allows access only to the user themselves
exports.myselfRequired = (req, res, next) => {
  if (isMyself(req)) {
    next();
  } else {
    handleProhibitedRoute(res, 'yourself');
  }
};

// Middleware that allows access to admins or the user themselves
exports.adminOrMyselfRequired = (req, res, next) => {
  if (isAdmin(req) || isMyself(req)) {
    next();
  } else {
    handleProhibitedRoute(res, 'admin or yourself');
  }
};

// Middleware that allows access to admins and not the user themselves
exports.adminAndNotMyselfRequired = (req, res, next) => {
  if (isAdmin(req) && !isMyself(req)) {
    next();
  } else {
    handleProhibitedRoute(res, 'admin and not yourself');
  }
};

// Helper function to check if the user is an admin
function isAdmin(req) {
  return !!req.session.user.isAdmin;
}

// Helper function to check if the user is an editor
function isEditor(req) {
  return !!req.session.user.isEditor;
}

// Helper function to check if the user is themselves
function isMyself(req) {
  return req.user.id === req.session.user.id;
}

// Helper function to handle prohibited routes
function handleProhibitedRoute(res, message) {
  console.log(`Prohibited route: the logged-in user is not ${message}.`);
  res.sendStatus(403);
}
