const express = require('express');
const multer = require('multer');
const router = express.Router();

const userCtrl = require('../controllers/user.js');
const userApiCtrl = require('../controllers/user-api.js');
const testsApiCtrl = require('../controllers/tests-api.js');
const testCtrl = require('../controllers/test.js');
const flashcardsCtrl = require('../controllers/flashcards.js');
const skillsApiCtrl = require('../controllers/skills-api.js');
const resultCtrl = require('../controllers/result.js');
const liveBattleCtrl = require('../controllers/livebattle.js');
const ssnCtrl = require('../controllers/session.js');

// Set up multer for handling FormData
const storage = multer.memoryStorage(); // You can customize storage options here
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 30, fieldSize: 150000 } });

// HELPERS
const { loadTemplateContent, getRenderedTemplate } = require('../helpers/load-template-content');

// LOAD TEMPLATES
const HOME_TEMPLATE_CONTENT = loadTemplateContent('home');
const COMMUNITY_TEMPLATE_CONTENT = loadTemplateContent('community');
const ABOUT_TEMPLATE_CONTENT = loadTemplateContent('about');
const HELP_TEMPLATE_CONTENT = loadTemplateContent('help');
const TIPS_TEMPLATE_CONTENT = loadTemplateContent('tips');
const FAQ_TEMPLATE_CONTENT = loadTemplateContent('faq');
const FROM_OLD_EXAM_TEMPLATE_CONTENT = loadTemplateContent('from-old-exam');
const FROM_NOTES_OR_TEXT_TEMPLATE_CONTENT = loadTemplateContent('from-notes-or-text');
const FROM_INSTRUCTIONS_TEMPLATE_CONTENT = loadTemplateContent('from-instructions');
const PRIVACY_POLICY_TEMPLATE_CONTENT = loadTemplateContent('privacy-policy');
const TERMS_OF_USE_TEMPLATE_CONTENT = loadTemplateContent('terms-of-use');

// Test, results and users count
let nTestsCreated = 0;
let nTestsTried = 0;
let nUsers = 0;
let nQuizQuestionsCreated = 0;
let nQuizQuestionsAnswered = 0;
let topTestsByLikes = [];
let topTestsByTries = [];
let topUsersByPublicTests = [];
let topUsersByTries = [];
let countUpdatedAt = new Date() - 1000 * 60 * 10;

// Get number of tests, test results and users every 10 minutes
async function updateCounts() {
  if (countUpdatedAt && new Date() - countUpdatedAt < 1000 * 60 * 10) return;
  nTestsCreated = await testCtrl.getTestsCount();
  nTestsTried = await resultCtrl.getResultsCount();
  nUsers = await userCtrl.getUsersCount();
  nQuizQuestionsCreated = await resultCtrl.getQuizzesCount();
  nQuizQuestionsAnswered = await resultCtrl.getQuizResultsCount();

  // Update top tests and top users
  await updateTopTests();
  await updateTopUsers();

  countUpdatedAt = new Date();
}

// Update top tests every 10 minutes
async function updateTopTests() {
  topTestsByLikes = await testCtrl.getTopTestsByLikes();
  topTestsByTries = await testCtrl.getTopTestsByTries();
}

// Update top users every 10 minutes
async function updateTopUsers() {
  topUsersByPublicTests = await userCtrl.getTopUsersByPublicTests();
  topUsersByTries = await userCtrl.getTopUsersByTries();
}

/*------- PARAMS MATCHERS --------*/
const userMatch = ':username([a-zA-Z0-9-]+)';
const testMatch = ':testUUID([a-zA-Z0-9-]+)';
const resultMatch = ':resultUUID([a-zA-Z0-9-]+)';
const liveBattleMatch = ':liveBattleId([a-zA-Z0-9-]+)';


/*------- AUTO-LOADS --------*/

// Auto-load for routes
router.param('username', userCtrl.load);
router.param('testUUID', testCtrl.load);


/*------- AUXILIARY ROUTES --------*/

// Redirect to the previous page or the root if no previous page is stored
router.get('/goback', (req, res) => {
  const backUrl = req.session.backUrl || '/';
  res.redirect(backUrl);
});

// Save routes to session backUrl
router.get(
  [
    '/',
    '/tests',
    '/users',
  ],
  (req, res, next) => {
    req.session.backUrl = req.url;
    next();
  }
);

/* ------- LANG ROUTES --------*/
// Change the language of the session
router.get('/lang/:lang', (req, res) => {
  try {
    const lang = req.params.lang;
    if (lang === 'en' || lang === 'es') {
      req.session.chosenLanguage = lang;
    } else {
      req.session.chosenLanguage = 'en';
    }
    // console.log("Language changed successfully to " + lang);
    // Reply with a 200 status code
    res.status(200).json({ message: 'Language changed successfully to ' + lang });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/* ------- THEME ROUTES --------*/
// Change the theme of the session
router.get('/theme/:theme', (req, res) => {
  try {
    const theme = req.params.theme;
    if (theme === 'light' || theme === 'dark') {
      req.session.chosenTheme = theme;
    } else {
      req.session.chosenTheme = 'light';
    }
    // console.log("Theme changed successfully to " + theme);
    // Reply with a 200 status code
    res.status(200).json({ message: 'Theme changed successfully to ' + theme });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/* ------- ADMIN ROUTES --------*/
// Create 2000 tests

// Delete 2000 tests

/*------- GENERAL ROUTES --------*/

// Get home view
router.get('/', async (req, res) => {
  // Update counts
  await updateCounts();

  // Set locals
  res.locals.nTestsCreated = nTestsCreated;
  res.locals.nTestsTried = nTestsTried;
  res.locals.nUsers = nUsers;
  res.locals.nQuizQuestionsCreated = nQuizQuestionsCreated;
  res.locals.nQuizQuestionsAnswered = nQuizQuestionsAnswered;
  res.locals.topTestsByLikes = topTestsByLikes;
  res.locals.topTestsByTries = topTestsByTries;
  res.locals.topUsersByPublicTests = topUsersByPublicTests;
  res.locals.topUsersByTries = topUsersByTries;

  // console.log("Top tests by likes:", topTestsByLikes);
  // console.log("Top tests by tries:", topTestsByTries);
  // console.log("Top users by public tests:", topUsersByPublicTests);
  // console.log("Top users by tries:", topUsersByTries);

  // If ajax request, send json response
  if (req.query.ajax === 'true') return res.json({ renderedHTML: getRenderedTemplate(HOME_TEMPLATE_CONTENT, res.locals) });
  // Render the home view
  res.render('general/home.ejs');
});

// Get community view
router.get('/community', async (req, res) => {
  // Update counts
  await updateCounts();

  // Set locals
  res.locals.nTestsCreated = nTestsCreated;
  res.locals.nTestsTried = nTestsTried;
  res.locals.nUsers = nUsers;
  res.locals.nQuizQuestionsCreated = nQuizQuestionsCreated;
  res.locals.nQuizQuestionsAnswered = nQuizQuestionsAnswered;
  res.locals.topTestsByLikes = topTestsByLikes;
  res.locals.topTestsByTries = topTestsByTries;
  res.locals.topUsersByPublicTests = topUsersByPublicTests;
  res.locals.topUsersByTries = topUsersByTries;

  // SEO metadata for this page
  res.locals.pageTitle = 'Community | WiseSloth.open';
  res.locals.pageDescription = 'Explore WiseSloth.open\'s community: top creators, most popular public quizzes, and live user/quiz/result stats.';

  // If ajax request, send json response
  if (req.query.ajax === 'true') return res.json({ renderedHTML: getRenderedTemplate(COMMUNITY_TEMPLATE_CONTENT, res.locals) });
  // Render the community view
  res.render('general/community.ejs');
});

// Get about view
router.get('/about', (req, res) => {
  // SEO metadata for this page
  res.locals.pageTitle = 'About | WiseSloth.open';
  res.locals.pageDescription = 'Learn about WiseSloth.open, the AI-powered platform that turns your notes, exams, and text into quizzes and live battles.';

  // If ajax request, send json response
  if (req.query.ajax === 'true') return res.json({ renderedHTML: getRenderedTemplate(ABOUT_TEMPLATE_CONTENT, res.locals) });
  // Render the about view
  res.render('general/about.ejs');
});


// Get help view
router.get('/help', (req, res) => {
  // SEO metadata for this page
  res.locals.pageTitle = 'Help | WiseSloth.open';
  res.locals.pageDescription = 'Get help with WiseSloth.open: how to create AI quizzes, run live battles, and get the most out of your studying.';

  // If ajax request, send json response
  if (req.query.ajax === 'true') return res.json({ renderedHTML: getRenderedTemplate(HELP_TEMPLATE_CONTENT, res.locals) });
  // Render the help view
  res.render('general/help.ejs');
});

// Get tips view
router.get('/tips', (req, res) => {
  // Set the data for the view
  const data = {
    isHelpModal: false
  };
  // SEO metadata for this page
  res.locals.pageTitle = 'Study Tips | WiseSloth.open';
  res.locals.pageDescription = 'Study smarter with these WiseSloth.open tips: get the most out of AI quizzes and live battles to master any subject faster.';

  // If ajax request, send json response
  if (req.query.ajax === 'true') return res.json({ renderedHTML: getRenderedTemplate(TIPS_TEMPLATE_CONTENT, res.locals, data) });
  // Render the tips view
  res.render('general/tips.ejs');
});

// Get faq view
router.get('/faq', (req, res) => {
  // Set the data for the view
  const data = {
    isHelpModal: false
  };
  // SEO metadata for this page
  res.locals.pageTitle = 'FAQ | WiseSloth.open';
  res.locals.pageDescription = 'Frequently asked questions about WiseSloth.open: quiz generation, live battles, accounts, tokens and more.';

  // If ajax request, send json response
  if (req.query.ajax === 'true') return res.json({ renderedHTML: getRenderedTemplate(FAQ_TEMPLATE_CONTENT, res.locals, data) });
  // Render the faq view
  res.render('general/faq.ejs');
});

// Show from-old-exam tutorial / guide
router.get('/from-old-exam', (req, res) => {
  // Set the data for the view
  const data = {
    isHelpModal: false
  };
  // If ajax request, send json response
  if (req.query.ajax === 'true') return res.json({ renderedHTML: getRenderedTemplate(FROM_OLD_EXAM_TEMPLATE_CONTENT, res.locals, data) });
  // Render the from-old-exam view
  res.render('general/from-old-exam.ejs');
});

// Show from-notes-or-text tutorial / guide
router.get('/from-notes-or-text', (req, res) => {
  // Set the data for the view
  const data = {
    isHelpModal: false
  };
  // If ajax request, send json response
  if (req.query.ajax === 'true') return res.json({ renderedHTML: getRenderedTemplate(FROM_NOTES_OR_TEXT_TEMPLATE_CONTENT, res.locals, data) });
  // Render the from-notes-or-text view
  res.render('general/from-notes-or-text.ejs');
});

// Show from-instructions tutorial / guide
router.get('/from-instructions', (req, res) => {
  // Set the data for the view
  const data = {
    isHelpModal: false
  };
  // If ajax request, send json response
  if (req.query.ajax === 'true') return res.json({ renderedHTML: getRenderedTemplate(FROM_INSTRUCTIONS_TEMPLATE_CONTENT, res.locals, data) });
  // Render the from-instructions view
  res.render('general/from-instructions.ejs');
});

// Show privacy policy
router.get('/privacy-policy', (req, res) => {
  // If ajax request, send json response
  if (req.query.ajax === 'true') return res.json({ renderedHTML: getRenderedTemplate(PRIVACY_POLICY_TEMPLATE_CONTENT, res.locals) });
  // Render the privacy policy view
  res.render('general/privacy-policy.ejs');
});

// Show terms of use
router.get('/terms-of-use', (req, res) => {
  // If ajax request, send json response
  if (req.query.ajax === 'true') return res.json({ renderedHTML: getRenderedTemplate(TERMS_OF_USE_TEMPLATE_CONTENT, res.locals) });
  // Render the terms of use view
  res.render('general/terms-of-use.ejs');
});


/*------- USERS API ROUTES --------*/

// Log out
router.post('/api/logout', ssnCtrl.loginRequiredAPI, userApiCtrl.logOut);

// Sign Up or Log In with Google
router.use(require('./self-hosted'));

// Follow / unfollow users
router.post('/api/users/' + userMatch + '/follow', ssnCtrl.loginRequiredAPI, userApiCtrl.followUser);
router.delete('/api/users/' + userMatch + '/unfollow', ssnCtrl.loginRequiredAPI, userApiCtrl.unfollowUser);

// Add / remove tests from favorites
router.post('/api/tests/' + testMatch + '/favorite', ssnCtrl.loginRequiredAPI, userApiCtrl.addTestToFavorites);
router.delete('/api/tests/' + testMatch + '/unfavorite', ssnCtrl.loginRequiredAPI, userApiCtrl.removeTestFromFavorites);

// ReCAPTCHA verification


// Preferences sync (for localStorage <-> server sync)
router.post('/api/preferences/sync', ssnCtrl.loginRequiredAPI, userApiCtrl.syncPreferences);
router.get('/api/user/session', userApiCtrl.getSessionUser);

// Skills / preferences (free text, used to tailor AI creation)
router.get('/api/skills', ssnCtrl.loginRequiredAPI, skillsApiCtrl.listSkills);
router.post('/api/skills', ssnCtrl.loginRequiredAPI, skillsApiCtrl.addSkill);
router.put('/api/skills/:id', ssnCtrl.loginRequiredAPI, skillsApiCtrl.updateSkill);
router.delete('/api/skills/:id', ssnCtrl.loginRequiredAPI, skillsApiCtrl.deleteSkill);
// Per-creation-type skill config (which skills apply to each type + always)
router.get('/api/skills/config', ssnCtrl.loginRequiredAPI, skillsApiCtrl.getSkillConfig);
router.put('/api/skills/config', ssnCtrl.loginRequiredAPI, skillsApiCtrl.updateSkillConfig);

/*------- USERS ROUTES --------*/

// Users index — the ranking (type=all + all orderbys) is public so logged-out
// visitors can browse it from the community page; following/followers lists
// need a session, so those keep the login gate.
router.get('/users', (req, res, next) => {
  if (['following', 'followers'].includes(req.query.type)) {
    return ssnCtrl.loginRequired(req, res, next);
  }
  next();
}, userCtrl.index);

// Show a user
router.get('/users/' + userMatch, userCtrl.show);

// Update a user from profile view
router.put('/api/users/update', ssnCtrl.loginRequiredAPI, userCtrl.updateUserAPI);

// Delete an user
router.delete('/users/' + userMatch, ssnCtrl.loginRequired, ssnCtrl.adminOrMyselfRequired, userCtrl.destroy);


/*------- FLASK API ROUTES --------*/

// Show form to create a new test
router.get('/tests/new', testsApiCtrl.newTestForm);

// Add an image to google cloud through the AI API
router.post('/api/tests/addimg', ssnCtrl.loginRequiredAPI, upload.any(), testsApiCtrl.addImageToQuiz);

// Create a test using the AI API
router.post('/api/tests/new', ssnCtrl.loginRequiredAPI, upload.none(), testsApiCtrl.addTest);

// Create flashcards using the AI API
router.post('/api/tests/new-flashcards', ssnCtrl.loginRequiredAPI, upload.none(), testsApiCtrl.addFlashcards);

// AI-edit a single quiz question
router.post('/api/tests/edit-quiz-ai', ssnCtrl.loginRequiredAPI, testCtrl.editQuizAI);

// AI-edit a single flashcard
router.post('/api/tests/edit-flashcard-ai', ssnCtrl.loginRequiredAPI, flashcardsCtrl.editFlashcardAI);

// General (whole-test/deck) AI edit: propose a diff, then apply it once reviewed
router.post('/api/tests/edit-test-ai', ssnCtrl.loginRequiredAPI, testCtrl.editTestAI);
router.post('/api/tests/apply-test-edit-ai', ssnCtrl.loginRequiredAPI, testCtrl.applyTestEditAI);

// Batch-save flashcards from the flashcard editor
router.post('/api/tests/update-flashcards', ssnCtrl.loginRequiredAPI, flashcardsCtrl.updateFlashcardsAPI);

/*------- TESTS ROUTES --------*/

// Tests index
router.get('/tests/', testCtrl.index);

// Show a test
router.get('/tests/' + testMatch, testCtrl.showTest);

// Try a test
router.get('/tests/' + testMatch + '/try', ssnCtrl.loginRequired, testCtrl.tryTest);

// Edit a test with an interactive view
router.get('/tests/' + testMatch + '/edit', ssnCtrl.loginRequired, ssnCtrl.adminOrAuthorRequired, testCtrl.editTest);

// Update a test from edit view
router.put('/api/tests/update-details', ssnCtrl.loginRequiredAPI, testCtrl.updateTestDetailsAPI);
router.post('/api/tests/update-quizzes', ssnCtrl.loginRequiredAPI, testCtrl.updateTestQuizzesAPI);

// Delete a test
router.delete('/tests/' + testMatch, ssnCtrl.loginRequiredAPI, ssnCtrl.adminOrAuthorRequired, testCtrl.deleteTest);


/*------- RESULTS ROUTES --------*/

// Results index
router.get('/results/', ssnCtrl.loginRequired, resultCtrl.index);

// Show a result
router.get('/results/' + resultMatch, resultCtrl.showResult);

// Check a test and create a result
router.post('/api/results/' + resultMatch + '/check', ssnCtrl.loginRequiredAPI, upload.none(), resultCtrl.checkTestAndCreateResult);

// Check a quiz
router.post('/api/results/' + resultMatch + '/checkquiz', ssnCtrl.loginRequiredAPI, upload.none(), resultCtrl.checkQuiz);

/*------- ISSUE REPORTS (floating widget — desktop only) --------*/
// Anonymous-allowed, rate-limited (5/h/IP), write-only: there is deliberately
// NO endpoint that returns stored reports. See controllers/issues.js.


// Delete a result
router.delete('/results/' + resultMatch, ssnCtrl.loginRequired, resultCtrl.deleteResult);


/*------- LIVE BATTLE ROUTES --------*/

// Start a live battle lobby
router.get('/tests/' + testMatch + '/livebattle', ssnCtrl.loginRequired, liveBattleCtrl.newLobby);

// Join a live battle lobby
router.get('/livebattle/' + liveBattleMatch, ssnCtrl.loginRequired, liveBattleCtrl.joinLobby);
router.post('/livebattle/' + liveBattleMatch, ssnCtrl.loginRequiredAPI, liveBattleCtrl.joinLobby);

// Get the current status of a live battle
router.get('/api/livebattle/' + liveBattleMatch + '/status', ssnCtrl.loginRequiredAPI, liveBattleCtrl.getLiveBattleStatus);

// Start a live battle
router.post('/api/livebattle/' + liveBattleMatch + '/start', ssnCtrl.loginRequiredAPI, liveBattleCtrl.startLiveBattle);

// Check an answer in a live battle
router.post('/api/livebattle/' + liveBattleMatch + '/answer', ssnCtrl.loginRequiredAPI, liveBattleCtrl.checkAnswer);


// Export routes module
module.exports = router;
