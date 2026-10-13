'use strict';

// GET VALUE OF ENV VARIABLE
const process = require('process');
const env = process.env.NODE_ENV || 'development';

// REQUIRES
const uuid = require('uuid');

// MODELS
const { models } = require('../models');
const { Test, Quiz, Flashcard } = models;

// HELPERS
const { appendSource } = require('../helpers/link-source');
const { checkUserCanCreate } = require('../helpers/ai-edit-usage');
const { loadTemplateContent, getRenderedTemplate } = require('../helpers/load-template-content');
const { randomFacts } = require('../helpers/dictionaries');
const { appendSkillsToFormData } = require('./skills-api');

// CONSTANTS
const NEW_TEST_TEMPLATE_CONTENT = loadTemplateContent('test-new');
const TEST_CARD_TEMPLATE_CONTENT = loadTemplateContent('test-card');

// AUXILIARY CONSTANTS
const API_URL = (process.env.AI_API_URL || 'http://fastapi-api:5000') + '/v1/';
const { fetchAI } = require('../helpers/ai-client');
const MAX_SIZE_IN_B = 2 * 1024 * 1024; // 2MB in bytes
const ALLOWED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/bmp',
  'image/webp',
  'image/svg+xml'
];


// AUXILIARY FUNCTIONS

// Acquire the per-session test creation lock
// Returns true if the lock was acquired, false if it is already active
async function acquireTestCreationLock(req) {
  const ssnUser = req.session.user;
  if (!ssnUser) return false;
  if (ssnUser.testCreationLock && Date.now() - ssnUser.testCreationLock < 120000) return false;
  ssnUser.testCreationLock = Date.now();
  await new Promise((resolve) => req.session.save(resolve));
  return true;
}

// Release the per-session test creation lock (safe to call in error paths)
async function releaseTestCreationLock(req) {
  const ssnUser = req.session.user;
  if (!ssnUser) return;
  ssnUser.testCreationLock = false;
  try {
    await new Promise((resolve) => req.session.save(resolve));
  } catch (sessionError) {
    console.error('Failed to save session after error:', sessionError);
  }
}


// GET /tests/new/
// Form to create a new test uploading file or text
exports.newTestForm = (req, res, next) => {
  try {
    // If ajax request, send json response
    if (req.query.ajax === 'true') return res.json({ renderedHTML: getRenderedTemplate(NEW_TEST_TEMPLATE_CONTENT, res.locals, { randomFacts, minimalFooter: true }) });
    // Render the new test form view
    return res.render('tests/new.ejs', { randomFacts, minimalFooter: true });
  } catch (error) {
    next(error, req, res);
  }
};

// POST /api/tests/addimg/
// Communicate with API to upload a quiz image to Google Cloud Storage
exports.addImageToQuiz = async (req, res, _next) => {
  // Initialize file variable
  let file = null;
  if (req.files && req.files.length > 0) {
    const uploadedFile = req.files[0];
    const newFileName = req.body.newFileName;

    // Check that newFileName is not empty and it is a valid UUID
    if (!newFileName || !uuid.validate(newFileName.split('.')[0])) {
      return res.status(400).json({ success: false, error: 'Invalid newFileName parameter' });
    }

    // Only the author (or an admin) of the quiz's test can add an image
    try {
      const ssnUser = req.session.user;
      const quiz = await Quiz.findByPk(newFileName.split('.')[0]);
      if (!quiz) {
        return res.status(404).json({ success: false, error: 'Quiz not found' });
      }
      const test = await Test.findByPk(quiz.testId);
      if (!test) {
        return res.status(404).json({ success: false, error: 'Test not found' });
      }
      const isAuthor = ssnUser && test.userId === ssnUser.id;
      const isAdmin = ssnUser && !!ssnUser.isAdmin;
      if (!isAuthor && !isAdmin) {
        return res.status(403).json({ success: false, error: 'Only the author or an admin can add images to this question' });
      }
    } catch (error) {
      return res.status(500).json({ success: false, error: 'Internal server error: ' + error });
    }

    // Check if file is under 2MB and is an image
    if (uploadedFile.size <= MAX_SIZE_IN_B && ALLOWED_TYPES.includes(uploadedFile.mimetype)) {
      file = new File([uploadedFile.buffer], newFileName, { type: uploadedFile.mimetype });
    } else {
      // Too big or invalid file error
      return res.status(500).json({ success: false, error: 'File exceeds 2MB, or its type is invalid' });
    }
  } else {
    // No image to upload error
    return res.status(500).json({ success: false, error: 'No image to upload' });
  }

  // Build form data
  const formData = new FormData();
  formData.append('file', file);
  formData.append('newFileName', req.body.newFileName);
  try {
    // Send a POST request to API
    const response = await fetch(API_URL + 'images/quiz/add', {
      method: 'POST',
      body: formData,
    });

    // Assuming your response data is in JSON format
    const responseData = await response.json();
    const imageUrl = responseData.imageUrl;

    // Respond with a success message
    return res.status(200).json({ success: true, imageUrl: imageUrl });
  } catch (error) {
    // Handle other types of errors
    return res.status(500).json({ success: false, error: 'Internal server error: ' + error });
  }
};

// POST /api/tests/new/
// Communicate with API to parse pdf and extract questions and their answers
// to create an interactive test automatically
exports.addTest = async (req, res, _next) => {
  const reqType = req.body.type;


  try {
    // Require an existing signed-in account.
    const tokenCheck = await checkUserCanCreate(req);
    if (!tokenCheck.ok) {
      return res.status(tokenCheck.status).json({ success: false, error: tokenCheck.error });
    }
    const user = tokenCheck.user;
    const userId = user.id;

    await appendSource(req.body);
    req.body.instructions ||= '';

    // Validate body parameters
    if (reqType === 'old-exam') {
      if (!req.body.text) {
        return res.status(400).json({ success: false, error: 'Text parameter is required' });
      }
      if (req.body.text.length < 100 || req.body.text.length > 50000) {
        return res.status(400).json({ success: false, error: 'Text length must be between 100 and 50000 characters. Current lenght is ' + req.body.text.length + ' characters.' });
      }
    } else if (reqType === 'notes') {
      if (!req.body.nQuestions || !req.body.nOptions) {
        return res.status(400).json({ success: false, error: 'nQuestions and nOptions parameters are required' });
      }
      if (req.body.nQuestions < 1 || req.body.nQuestions > 50) {
        return res.status(400).json({ success: false, error: 'nQuestions parameter must be between 1 and 50' });
      }
      if (req.body.nOptions < 2 || req.body.nOptions > 6) {
        return res.status(400).json({ success: false, error: 'nOptions parameter must be between 2 and 6' });
      }
      if (!req.body.difficulty || !['not-specified', 'beginner', 'elementary', 'intermediate', 'advanced', 'expert'].includes(req.body.difficulty)) {
        return res.status(400).json({ success: false, error: 'Invalid difficulty parameter: either not-specified, beginner, elementary, intermediate, advanced or expert' });
      }
      if (req.body.instructions.length > 1000) {
        return res.status(400).json({ success: false, error: 'Extra guidelines length must be less than 1000 characters. Current lenght is ' + req.body.instructions.length + ' characters.' });
      }
      if (!req.body.text) {
        return res.status(400).json({ success: false, error: 'Text parameter is required' });
      }
      if (req.body.text.length < 100 || req.body.text.length > 50000) {
        return res.status(400).json({ success: false, error: 'Text length must be between 100 and 50000 characters. Current lenght is ' + req.body.text.length + ' characters.' });
      }
    } else if (reqType === 'instructions') {
      if (!req.body.language || !req.body.nQuestions || !req.body.nOptions || !req.body.instructions) {
        return res.status(400).json({ success: false, error: 'Language, nQuestions, nOptions, and instructions parameters are required' });
      }
      if (req.body.nQuestions < 1 || req.body.nQuestions > 50) {
        return res.status(400).json({ success: false, error: 'nQuestions parameter must be between 1 and 50' });
      }
      if (req.body.nOptions < 2 || req.body.nOptions > 5) {
        return res.status(400).json({ success: false, error: 'nOptions parameter must be between 2 and 5' });
      }
      if (!req.body.difficulty || !['not-specified', 'beginner', 'elementary', 'intermediate', 'advanced', 'expert'].includes(req.body.difficulty)) {
        return res.status(400).json({ success: false, error: 'Invalid difficulty parameter: either not-specified, beginner, elementary, intermediate, advanced or expert' });
      }
      if (req.body.instructions.length < 10 || req.body.instructions.length > 3000) {
        return res.status(400).json({ success: false, error: 'Instructions length must be between 10 and 3000 characters. Current lenght is ' + req.body.instructions.length + ' characters. Create a test from notes instead if you need more space.' });
      }
    } else if (reqType === 'personality') {
      if (!req.body.language || !req.body.nQuestions || !req.body.nOptions || !req.body.instructions) {
        return res.status(400).json({ success: false, error: 'Language, nQuestions, nOptions, and instructions parameters are required' });
      }
      if (req.body.nQuestions < 1 || req.body.nQuestions > 50) {
        return res.status(400).json({ success: false, error: 'nQuestions parameter must be between 1 and 50' });
      }
      if (req.body.nOptions < 2 || req.body.nOptions > 6) {
        return res.status(400).json({ success: false, error: 'nPersonalities parameter must be between 2 and 6' });
      }
      if (req.body.instructions.length < 10 || req.body.instructions.length > 5000) {
        return res.status(400).json({ success: false, error: 'Instructions length must be between 10 and 5000 characters. Current lenght is ' + req.body.instructions.length + ' characters.' });
      }
    } else {
      return res.status(400).json({ success: false, error: 'Invalid type parameter: either old-exam, notes, instructions or personality' });
    }

    // Check if the session user has a test creation lock active
    const lockAcquired = await acquireTestCreationLock(req);
    if (!lockAcquired) {
      return res.status(400).json({ success: false, error: 'You can only create one test at a time, please wait until the current test is created' });
    }

    // Build form data
    const formData = new FormData();
    if (reqType === 'old-exam') {
      formData.append('text', req.body.text);
    } else if (reqType === 'notes') {
      formData.append('nQuestions', req.body.nQuestions);
      formData.append('nOptions', req.body.nOptions);
      formData.append('difficulty', req.body.difficulty);
      formData.append('instructions', req.body.instructions);
      formData.append('text', req.body.text);
    } else if (reqType === 'instructions') {
      formData.append('language', req.body.language);
      formData.append('nQuestions', req.body.nQuestions);
      formData.append('nOptions', req.body.nOptions);
      formData.append('difficulty', req.body.difficulty);
      formData.append('instructions', req.body.instructions);
      formData.append('useEnhancedGrounding', req.body.useEnhancedGrounding || 'false');
    } else if (reqType === 'personality') {
      formData.append('language', req.body.language);
      formData.append('nQuestions', req.body.nQuestions);
      formData.append('nOptions', req.body.nOptions);
      formData.append('instructions', req.body.instructions);
      formData.append('useEnhancedGrounding', req.body.useEnhancedGrounding || 'false');
    }

    // Form data admin param
    formData.append('isAdmin', user.isAdmin);

    // Append the user's selected skills/preferences (tailors the AI output)
    appendSkillsToFormData(req, formData);

    // Send a POST request to API
    // console.log('Sending request to API to create test');
    const response = await fetchAI(req, API_URL + 'tests/' + reqType, {
      method: 'POST',
      body: formData,
    });

    // Assuming your response data is in JSON format
    const responseData = await response.json();
    if (responseData.browserAIPlan) {
      await releaseTestCreationLock(req);
      return res.json(responseData);
    }

    // Check if the response is successful (responseData.success === true)
    if (!responseData.success) {
      // Release the test creation lock
      await releaseTestCreationLock(req);
      // Send the error message in the response if in development
      if (env === 'development') {
        return res.status(400).json({ success: false, error: responseData.error });
      } else {
        return res.status(400).json({ success: false, error: responseData.error || 'AI generation failed. Check your provider key in Settings.' });
      }
    }

    // Destructure data from the response
    const completion = responseData.completion;
    // console.log(completion);

    const tokensUsed = completion.tokens;
    const { lang, name, topic, desc, context, quizzes } = completion.content;
    let testContext = context || '';
    // console.log(quizzes);

    // If if it is a personality text set the context to "personality"
    const nQuestions = req.body.nQuestions || 0;
    const nOptions = req.body.nOptions || 0;
    const difficulty = req.body.difficulty || 'not-specified';
    let instructions = req.body.instructions || '';
    // Remove or replace any characters from the first 1000 of the instructions that could break the JSON
    instructions = instructions.slice(0, 1000).replace(/[\n\r]/g, ' ').replace(/"/g, '\'');
    if (reqType === 'personality') {
      testContext = 'personality';
    } else {
      testContext = JSON.stringify({ type: reqType, difficulty, nQuestions: Number(nQuestions), nOptions: Number(nOptions), instructions });
    }

    // Create test id
    // console.log('Creating and saving test instance');
    const testId = uuid.v4();

    // Build and save test instance
    const test = await Test.build({
      id: testId,
      userId: userId,
      language: lang || 'en',
      name: name || 'Untitled',
      topic: topic || 'not-defined-topic',
      desc: desc || 'No description',
      context: testContext,
      type: reqType === 'personality' ? 'personality' : 'knowledge',
      // Save the source content and creation guidelines for future AI-assisted edits
      creationContent: (req.body.text || req.body.notes || '').slice(0, 100000),
      creationGuidelines: (req.body.instructions || '').slice(0, 5000),
      // promptTokens: tokensUsed.input,
      // completionTokens: tokensUsed.output,
      promptTokens: tokensUsed.prompt,
      completionTokens: tokensUsed.completion,
      visibility: 'private',
      hideAnswers: true,
    });
    await test.save();

    // Create and save quizzes from response
    // console.log('Creating and saving quizzes');
    const new_quizzes = [];

    // If personality test create metadata quiz with number 0 containing possible personalities
    if (reqType === 'personality') {
      // Get personalities and their descriptions
      const personalities = completion.content.personalities;
      const personalitiesDesc = completion.content.personalities_desc;
      // Create personalities quiz
      const new_quiz = {
        id: testId,
        testId: testId,
        userId: userId,
        number: 0,
        question: 'Metadata quiz',
        correct_opts: '-1',
        opt1: personalities['1'] ? (personalities['1'] + '|' + personalitiesDesc['1']) : ('Personality A' + '|' + 'Description A'),
        opt2: personalities['2'] ? (personalities['2'] + '|' + personalitiesDesc['2']) : ('Personality B' + '|' + 'Description B'),
        opt3: personalities['3'] ? (personalities['3'] + '|' + personalitiesDesc['3']) : (''),
        opt4: personalities['4'] ? (personalities['4'] + '|' + personalitiesDesc['4']) : (''),
        opt5: personalities['5'] ? (personalities['5'] + '|' + personalitiesDesc['5']) : (''),
        opt6: personalities['6'] ? (personalities['6'] + '|' + personalitiesDesc['6']) : (''),
      };
      // console.log('Metadata quiz: ', new_quiz);
      new_quizzes.push(new_quiz);
    }

    // Create quizzes from response
    // Note: quizzes is now an array, so we use forEach with 1-based numbering
    quizzes.forEach((quiz, index) => {
      const quizNumber = index + 1; // 1-based numbering for quiz questions

      let correct_opts = '';
      if (reqType !== 'personality') {
        // Parse correct options if not personality test
        // Add 1 to all elements in quiz.correctOpts and turn into comma separated string
        // correct_opts = quiz.correctOpts.map((opt) => (Number(opt))).join(",");

        // Turn the letter 'a' into 1, 'b' into 2, 'c' into 3, 'd' into 4, 'e' into 5, 'f' into 6
        // Also 'A' into 1, 'B' into 2, 'C' into 3, 'D' into 4, 'E' into 5, 'F' into 6
        // And create a comma separated string with the correct options
        correct_opts = quiz.correctOpts.map((opt) => {
          if (opt.match(/^[aA]$/)) { return 1; }
          if (opt.match(/^[bB]$/)) { return 2; }
          if (opt.match(/^[cC]$/)) { return 3; }
          if (opt.match(/^[dD]$/)) { return 4; }
          if (opt.match(/^[eE]$/)) { return 5; }
          if (opt.match(/^[fF]$/)) { return 6; }
          return -1;
        }).join(',');

        // console.log(correct_opts);
      } else {
        // Write a -1 as correct options
        correct_opts = '-1';
      }

      // Build quiz options iterating from a to f or from opt1 to opt6 in the quiz object
      const maxNOptions = 6;
      quiz.opts = [];

      // Iterate from 'a' to 'f' if the type is not personality
      if (reqType !== 'personality') {
        if (quiz.a) { quiz.opts.push(quiz.a); }
        if (quiz.b) { quiz.opts.push(quiz.b); }
        if (quiz.c) { quiz.opts.push(quiz.c); }
        if (quiz.d) { quiz.opts.push(quiz.d); }
        if (quiz.e) { quiz.opts.push(quiz.e); }
        if (quiz.f) { quiz.opts.push(quiz.f); }
      // Iterate from opt1 to opt6 if the type is personality
      } else {
        for (let i = 1; i <= maxNOptions; i++) {
          if (quiz[`opt${i}`]) {
            quiz.opts.push(quiz[`opt${i}`]);
          }
        }
      }

      // console.log(quiz.opts);
      // For each existing option, check if they start by a A to F letter followed by a dot or a parenthesis
      // Also check if they start by a number followed by a dot or a parenthesis
      quiz.opts = quiz.opts.map((opt) => {
        // If they do, remove the letter and the dot or parenthesis plus any space after them
        if (opt.match(/^[a-f]\.|^[a-f]\)/)) {
          return opt.replace(/^[a-f]\.|^[a-f]\)/, '').trim();
        }
        // Do not replace numbers followed by dots since it will cause problems with numbers like "1.5"
        // if (opt.match(/^[0-9]\.|^[0-9]\)/)) {
        //   return opt.replace(/^[0-9]\.|^[0-9]\)/, "").trim();
        // }
        return opt;
      });

      // Shuffle for req_type notes and instructions
      let indexes = [];
      let shuffledIndexes = [];
      let shuffledOpts = [];
      let newCorrectOpts = '';
      // Dont shuffle options since there might be issues with options like "All of the above" or "Both A and B"...
      // Also check that the options dont include uppercase characters from A to F (reference other options) or "all" or "both" ("todas", "ambas", ...)
      const forbiddenChars = ['A', 'B', 'C', 'D', 'E', 'F'];
      const forbiddenStrs = ['Both', 'all', 'both', 'Todas', 'Ambas', 'todas', 'ambas', 'Todo', 'Ambos', 'todo', 'ambos'];
      const hasForbiddenChars = quiz.opts.some((opt) => forbiddenChars.some((char) => opt.slice(1).includes(char)));
      const hasForbiddenStrs = quiz.opts.some((opt) => forbiddenStrs.some((str) => opt.includes(str)));
      if ((reqType === 'notes' || reqType === 'instructions') && !hasForbiddenChars && !hasForbiddenStrs) {
        // Create an array with the indexes of the options [0, 1, 2, 3, 4, 5] (up to quiz.opts.length)
        indexes = Array.from({ length: quiz.opts.length }, (_, i) => i);
        // Shuffle the indexes into a new array
        shuffledIndexes = indexes.map((index) => [Math.random(), index]).sort().map((pair) => pair[1]);
        // Create a new array with the shuffled options
        shuffledOpts = shuffledIndexes.map((index) => quiz.opts[index]);
        // Change the correct options from their original index to the shuffled index
        newCorrectOpts = correct_opts.split(',').map((opt) => shuffledIndexes.indexOf(Number(opt) - 1) + 1).join(',');
      } else {
        shuffledOpts = quiz.opts;
        newCorrectOpts = correct_opts;
      }

      // Create new quiz instance
      const new_quiz = {
        id: uuid.v4(),
        testId: test.id,
        userId: userId,
        number: quizNumber,
        question: quiz.q || 'No question',
        correct_opts: newCorrectOpts || '1',
        opt1: shuffledOpts[0] || 'Option A',
        opt2: shuffledOpts[1] || 'Option B',
        opt3: shuffledOpts[2] || '',
        opt4: shuffledOpts[3] || '',
        opt5: shuffledOpts[4] || '',
        opt6: quiz.exp ? '[Exp]' + quiz.exp : (shuffledOpts[5] || ''),
      };
      new_quizzes.push(new_quiz);
    });
    await Quiz.bulkCreate(new_quizzes);

    // Release the test creation lock
    await releaseTestCreationLock(req);

    // Build test card data
    // console.log('Building test card data');
    test.author = user;
    // Test metadata quiz is the first quiz with number 0
    test.metadataQuiz = new_quizzes.find((quiz) => quiz.number === 0);
    // Test quizzes are all quizzes with number !== 0
    test.quizzes = new_quizzes.filter((quiz) => quiz.number !== 0);
    const testCardData = { test, viewType: 'EDIT' };

    // Add difficulty to the test card data
    if (reqType === 'notes' || reqType === 'instructions') {
      testCardData.test.creationData = { 'type': reqType, 'difficulty': difficulty, 'nQuestions': nQuestions, 'nOptions': nOptions, 'instructions': instructions };
    }
    // console.log(testCardData);

    // Render new test card html
    const testCardHTML = getRenderedTemplate(TEST_CARD_TEMPLATE_CONTENT, res.locals, testCardData);

    // Build the response data
    const data = {
      testId: test.id,
      testName: name,
      nQuestions: nQuestions,
      testCardHTML: testCardHTML,
      tokensUsed: tokensUsed.total,
      costUsd: req.aiUsage?.costUsd || 0
    };
    // Respond with a success message
    // console.log('Responding with success message');
    return res.status(200).json({
      success: true,
      ...data
    });
  } catch (error) {
    // Release the test creation lock
    await releaseTestCreationLock(req);
    if (error.status) return res.status(error.status).json({ success: false, error: error.message });
    // Always log the real error so production failures are diagnosable
    console.error('addTest error:', error);
    // Check if the error is a Sequelize validation error and env is development
    if (env === 'development') {
      if (error.name === 'SequelizeValidationError') {
        // Extract validation errors from Sequelize error
        const validationErrors = error.errors.map((err) => err.message);
        // Respond with a validation error message
        return res.status(400).json({ success: false, error: 'Validation errors: ' + validationErrors.join(', ') });
      } else {
        // Handle other types of errors
        return res.status(500).json({ success: false, error: 'Internal server error: ' + error });
      }
    } else {
      // Handle other types of errors
      return res.status(500).json({ success: false, error: 'There was an unexpected error, please try again :)' });
    }
  }
};

// POST /api/tests/new-flashcards/
// Communicate with API to generate flashcards from notes/text
// and create a flashcard set (a Test of type "flashcards") automatically
exports.addFlashcards = async (req, res, _next) => {


  try {
    // Require an existing signed-in account.
    const tokenCheck = await checkUserCanCreate(req, 'flashcards');
    if (!tokenCheck.ok) {
      return res.status(tokenCheck.status).json({ success: false, error: tokenCheck.error });
    }
    const user = tokenCheck.user;
    const userId = user.id;

    await appendSource(req.body);
    req.body.instructions ||= '';

    // Validate body parameters
    if (!req.body.nCards) {
      return res.status(400).json({ success: false, error: 'nCards parameter is required' });
    }
    if (req.body.nCards < 1 || req.body.nCards > 100) {
      return res.status(400).json({ success: false, error: 'nCards parameter must be between 1 and 100' });
    }
    if (req.body.instructions && req.body.instructions.length > 1000) {
      return res.status(400).json({ success: false, error: 'Extra guidelines length must be less than 1000 characters. Current lenght is ' + req.body.instructions.length + ' characters.' });
    }
    if (!req.body.text) {
      return res.status(400).json({ success: false, error: 'Text parameter is required' });
    }
    if (req.body.text.length < 100 || req.body.text.length > 50000) {
      return res.status(400).json({ success: false, error: 'Text length must be between 100 and 50000 characters. Current lenght is ' + req.body.text.length + ' characters.' });
    }

    // Check if the session user has a test creation lock active
    const lockAcquired = await acquireTestCreationLock(req);
    if (!lockAcquired) {
      return res.status(400).json({ success: false, error: 'You can only create one test at a time, please wait until the current test is created' });
    }

    // Build form data
    const formData = new FormData();
    formData.append('text', req.body.text);
    formData.append('nCards', req.body.nCards);
    formData.append('language', req.body.language || '');
    formData.append('instructions', req.body.instructions || '');
    formData.append('isAdmin', user.isAdmin);

    // Append the user's selected skills/preferences (tailors the AI output)
    appendSkillsToFormData(req, formData);

    // Send a POST request to API
    const response = await fetchAI(req, API_URL + 'tests/flashcards', {
      method: 'POST',
      body: formData,
    });
    const responseData = await response.json();
    if (responseData.browserAIPlan) {
      await releaseTestCreationLock(req);
      return res.json(responseData);
    }

    if (!responseData.success) {
      await releaseTestCreationLock(req);
      if (env === 'development') {
        return res.status(400).json({ success: false, error: responseData.error });
      } else {
        return res.status(400).json({ success: false, error: responseData.error || 'AI generation failed. Check your provider key in Settings.' });
      }
    }

    // Destructure data from the response
    const completion = responseData.completion;

    const tokensUsed = completion.tokens;
    const { lang, name, topic, desc, cards } = completion.content;
    const nCards = req.body.nCards || cards.length;
    let instructions = req.body.instructions || '';
    instructions = instructions.slice(0, 1000).replace(/[\n\r]/g, ' ').replace(/"/g, '\'');
    const testContext = JSON.stringify({ type: 'flashcards', nCards: Number(nCards), instructions });

    // Create test id
    const testId = uuid.v4();

    // Build and save test instance
    const test = await Test.build({
      id: testId,
      userId: userId,
      language: lang || 'en',
      name: name || 'Untitled',
      topic: topic || 'not-defined-topic',
      desc: desc || 'No description',
      context: testContext,
      type: 'flashcards',
      // Save the source content and creation guidelines for future AI-assisted edits
      creationContent: (req.body.text || '').slice(0, 100000),
      creationGuidelines: (req.body.instructions || '').slice(0, 5000),
      promptTokens: tokensUsed.prompt,
      completionTokens: tokensUsed.completion,
      visibility: 'private',
      hideAnswers: true,
    });
    await test.save();

    // Create and save flashcards from response
    const new_flashcards = [];
    (cards || []).forEach((card, index) => {
      new_flashcards.push({
        id: uuid.v4(),
        testId: test.id,
        userId: userId,
        number: index + 1,
        front: (card.front || 'No front').trim(),
        back: (card.back || 'No back').trim(),
        image_url: '',
      });
    });
    await Flashcard.bulkCreate(new_flashcards);

    // Release the test creation lock
    await releaseTestCreationLock(req);

    // Build test card data
    test.author = user;
    test.flashcards = new_flashcards;
    test.quizzes = new_flashcards;
    const testCardData = { test, viewType: 'EDIT' };

    // Render new test card html
    const testCardHTML = getRenderedTemplate(TEST_CARD_TEMPLATE_CONTENT, res.locals, testCardData);

    // Build the response data
    const data = {
      testId: test.id,
      testName: name,
      nQuestions: nCards,
      testCardHTML: testCardHTML,
      tokensUsed: tokensUsed.total,
      costUsd: req.aiUsage?.costUsd || 0
    };
    return res.status(200).json({
      success: true,
      ...data
    });
  } catch (error) {
    // Release the test creation lock
    await releaseTestCreationLock(req);
    if (error.status) return res.status(error.status).json({ success: false, error: error.message });
    // Always log the real error so production failures are diagnosable
    console.error('addFlashcards error:', error);
    if (env === 'development') {
      if (error.name === 'SequelizeValidationError') {
        const validationErrors = error.errors.map((err) => err.message);
        return res.status(400).json({ success: false, error: 'Validation errors: ' + validationErrors.join(', ') });
      } else {
        return res.status(500).json({ success: false, error: 'Internal server error: ' + error });
      }
    } else {
      return res.status(500).json({ success: false, error: 'There was an unexpected error, please try again :)' });
    }
  }
};
