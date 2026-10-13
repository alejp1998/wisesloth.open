'use strict';

// REQUIRES
const { Op } = require('sequelize');

// MODELS
const { models } = require('../models');
const { User, Test, Quiz, TestResult, QuizResult } = models;

// HELPERS
const { paginate } = require('../helpers/paginate');
const { getVisibilityConditions } = require('../helpers/visibility-conditions');
const { getPersonalityCountFromHitsAndFails } = require('../helpers/personality-count');

const { loadTemplateContent, getRenderedTemplate } = require('../helpers/load-template-content');
const cacheCtrl = require('../helpers/cache');

// CONSTANTS
const INDEX_RESULT_TEMPLATE_CONTENT = loadTemplateContent('result-index');
const SHOW_RESULT_TEMPLATE_CONTENT = loadTemplateContent('result-show');
const RESULT_NOT_FOUND_TEMPLATE_CONTENT = loadTemplateContent('result-not-found');


// AUXILIARY FUNCTIONS

// Get chosen options as a dictionary
function getChosenOptsDict(obj) {
  const chosenOptsDict = {};

  // Loop through indices from 0 to the number of elements in obj
  for (const key in obj) {
    const quizId = key.slice(11);
    if (Array.isArray(obj[key])) {
      chosenOptsDict[quizId] = obj[key].join(',');
    } else {
      chosenOptsDict[quizId] = obj[key];
    }
  }
  return chosenOptsDict;
}

// Check if answer is correct and give it a score
function checkCorrect(correctOpts, chosenOptions) {
  const correctSet = new Set(correctOpts);
  const chosenSet = new Set(chosenOptions);

  // Find the common elements between correctOpts and chosenOptions
  const commonElements = [...correctSet].filter((option) =>
    chosenSet.has(option)
  );

  // Calculate the number of incorrect chosen options
  const nCorrectChosenOpts = commonElements.length;
  const nIncorrectChosenOpts = chosenOptions.length - commonElements.length;

  // Determine the result based on correctness
  const isCorrect =
    nIncorrectChosenOpts === 0 && nCorrectChosenOpts === correctOpts.length;

  return { isCorrect, nCorrectChosenOpts, nIncorrectChosenOpts };
}

// Function to calculate quiz score
const checkQuizAndCalcScore = (quiz, chosenOptsStr, _nQuestions) => {
  try {
    const correctOpts = quiz.correct_opts.split(',');
    const chosenOpts = chosenOptsStr.split(',');
    const isCorrect = checkCorrect(correctOpts, chosenOpts).isCorrect;

    const score = isCorrect ? 1 : 0;

    return { isCorrect, score };
  } catch (error) {
    console.error('Error checking quiz:', error);
    return { isCorrect: false, score: 0 };
  }
};

// Get results count
exports.getResultsCount = async () => {
  try {
    return await TestResult.count();
  }
  catch (error) {
    console.error('Error getting results count:', error);
    return 0;
  }
};

// Get individual quiz questions answered count (QuizResults)
exports.getQuizResultsCount = async () => {
  try {
    return await QuizResult.count();
  }
  catch (error) {
    console.error('Error getting quiz results count:', error);
    return 0;
  }
};

// Get individual quiz questions created count (Quizzes)
exports.getQuizzesCount = async () => {
  try {
    return await Quiz.count();
  }
  catch (error) {
    console.error('Error getting quizzes count:', error);
    return 0;
  }
};

// GET /results
exports.index = async (req, res, next) => {
  try {
    let type = ['following', 'mine'].includes(req.query.type) ? req.query.type : 'all';
    let username = req.query.username || '';
    if (type === 'following') {
      username = '';
    }

    // If user not logged in set type to "all"
    if (!req.session.user) {
      type = 'all';
    }

    // If type is "mine" and user is not logged in, set type to "all"
    if (type === 'mine') {
      if (!req.session.user) {
        type = 'all';
      } else {
        username = req.session.user.username;
      }
    }

    // Initialize indexUser
    const indexUser = req.session.user;
    const indexUserId = indexUser ? indexUser.id : null;
    const isAdmin = indexUser ? indexUser.isAdmin : false;
    const isEditor = indexUser ? indexUser.isEditor : false;

    // Initialize followed users' ids
    let iFollowIds = [];
    if (indexUserId) {
      iFollowIds = indexUser.iFollowIds;
    }

    // Initialize conditions
    const conditions = [];
    if (!isAdmin && !isEditor) {
      // Get list of test ids passing visibility settings
      const visibleTestIds = await Test.findAll({
        attributes: ['id'],
        where: getVisibilityConditions(indexUser),
      }).then((tests) => tests.map((test) => test.id));

      // Add them to search conditions
      conditions.push({ testId: { [Op.in]: visibleTestIds } });
    }

    // Exclude tests results with score -1
    conditions.push({ score: { [Op.ne]: -1 } });

    // Consider type for search results
    if (type === 'following') {
      // Add user's followed users' tests to conditions
      conditions.push({ userId: { [Op.in]: iFollowIds } });
    }

    // Add username to conditions
    if (username) {
      // Get user by username
      const userByUsername = await User.findOne({ where: { username: username } });

      // If the user exists, add its id to conditions
      if (userByUsername) {
        conditions.push({ userId: userByUsername.id });
      } else {
        conditions.push({ userId: -1 });
      }
    }

    // Initialize countOptions with conditions
    const countOptions = {
      where: { [Op.and]: conditions },
    };

    // Count number of results satisfying the conditions
    console.time('Count results');
    const count = await TestResult.count(countOptions);
    console.timeEnd('Count results');

    // Pagination
    const pageItems = 50;
    let pageNo = Number(req.query.pageno) || 1;
    if (pageNo < 1 || (pageNo - 1) * pageItems >= count) {
      pageNo = 1;
    }
    const paginateControl = {
      html: paginate(count, pageItems, pageNo, req.url, false),
      totalItems: count,
      totalPages: Math.ceil(count / pageItems),
      pageFirstItemIndex: (pageNo - 1) * pageItems + 1,
      pageLastItemIndex: Math.min(pageNo * pageItems, count),
      pageNo: pageNo,
    };
    res.locals.paginateControl = paginateControl;

    // Build findOptions using countOptions
    const findOptions = {
      ...countOptions,
      offset: pageItems * (pageNo - 1),
      limit: pageItems,
      order: [['updatedAt', 'DESC']],
      include: [
        {
          model: Test,
          as: 'test',
          attributes: ['id', 'name', 'desc', 'topic', 'context'],
          include: [
            {
              model: Quiz,
              as: 'quizzes',
              attributes: ['id'],
            },
            {
              model: User,
              as: 'author',
              attributes: ['username'],
            },
          ],
        },
        {
          model: User,
          as: 'examinee',
          attributes: ['username'],
        },
      ],
    };

    // Find subset of results for this page
    console.time('Find results');
    const results = await TestResult.findAll(findOptions);
    console.timeEnd('Find results');

    // For each result, set result.test.type to "personality" if test.context === "personality"
    // otherwise set it to "knowledge"
    for (const result of results) {
      if (!result.test) {
        continue;
      }
      result.test.type = result.test.type || (result.test.context === 'personality' ? 'personality' : 'knowledge');
    }

    // Group results by test with same test id
    const groupedResults = {};
    for (const result of results) {
      if (!result.test) {
        continue;
      }
      const testId = result.test.id;

      if (!groupedResults[testId]) {
        groupedResults[testId] = {
          test: result.test,
          results: [],
        };
      }
      groupedResults[testId].results.push(result);
    }

    // If ajax request, send json response
    if (req.query.ajax === 'true') {
      return res.json({
        renderedHTML: getRenderedTemplate(INDEX_RESULT_TEMPLATE_CONTENT, res.locals, { type, groupedResults, username })
      });
    }
    // Render the index view
    res.render('results/index.ejs', { type, groupedResults, username });
  } catch (error) {
    next(error, req, res);
  }
};

// GET /results/:resultUUID
// Shows the result of a taken test
exports.showResult = async (req, res, next) => {
  const resultUUID = req.params.resultUUID;
  // Get pre-loaded result from session or fetch it from the DB
  let result = null;
  try {
    // Get the result from the session if possible
    if (req.session.result && req.session.result.id === resultUUID) {
      result = req.session.result;
    // Otherwise, get it from the DB
    } else {
      console.time('Fetch result from DB');
      result = await TestResult.findByPk(resultUUID, {
        include: [
          {
            model: Test,
            as: 'test',
            include: [
              {
                model: User,
                as: 'author',
                attributes: ['username'],
              },
            ],
          },
          {
            model: User,
            as: 'examinee',
            attributes: ['username'],
          },
        ],
      });

      // If result not found
      if (!result) {
        // If it was an ajax request
        if (req.query.ajax) {
          const renderedHTML = getRenderedTemplate(RESULT_NOT_FOUND_TEMPLATE_CONTENT, res.locals);
          // Set response status to 404 (Not Found)
          res.status(404);
          return res.json({ renderedHTML: renderedHTML });
        }
        // Set response status to 404 (Not Found)
        res.status(404);
        // If it was a regular request
        return res.render('results/result-not-found.ejs');
      }

      // Remove unnecessary sequelize metadata and keep just the raw objects
      // This should remove unnecessary data and make the object easier to work with
      // Make sure it is a sequelize object before calling get
      if (result && result.get) result = result.get({ plain: true });
      console.timeEnd('Fetch result from DB');

      // Fetch the quizzes and attach them to the result object
      let quizzes = cacheCtrl.getQuizzesFromCachedTest(result.test.id);
      if (!quizzes) {
        console.time('Fetch quizzes from DB');
        quizzes = await Quiz.findAll({
          where: { testId: result.test.id },
          attributes: ['id', 'number', 'question', 'opt1', 'opt2', 'opt3', 'opt4', 'opt5', 'opt6', 'correct_opts', 'image_url', 'updatedAt', 'createdAt'],
          order: [['number', 'ASC']],
        });
        console.timeEnd('Fetch quizzes from DB');
      } else {
        // Log that the quizzes were fetched from the cache
        // console.log("Fetched quizzes from cache");
      }
      // Attach the quizzes to the result object
      result.test.quizzes = quizzes;

      // Fetch the quiz results and attach them to the result object
      console.time('Fetch quiz results from DB');
      const quizResults = await QuizResult.findAll({
        where: { testResultId: result.id },
        attributes: ['quizId', 'number', 'score', 'result', 'orderOpts', 'chosenOpts', 'updatedAt', 'createdAt'],
      });
      // Order the quiz results by increasing number
      quizResults.sort((a, b) => a.number - b.number);
      // Attach the quiz results to the result object
      result.quizResults = quizResults;
      console.timeEnd('Fetch quiz results from DB');
    }

    const viewer = req.session.user;
    if (!viewer || (!viewer.isAdmin && viewer.id !== result.userId && viewer.id !== result.test.userId)) {
      return res.status(404).render('results/result-not-found.ejs');
    }

    // Modify result test quizzes to remove the metadata quiz
    result.test.metadataQuiz = result.test.quizzes.find((quiz) => quiz.id === result.test.id);
    result.test.quizzes = result.test.quizzes.filter((quiz) => quiz.number !== 0);

    // Set result.test.type (prefer the DB type column, fall back to context for legacy data)
    result.test.type = result.test.type || (result.test.context === 'personality' ? 'personality' : 'knowledge');

    // If the test is of type personality, then extract the number of times each personality
    // option was chosen from the result.score field
    if (result.test.type === 'personality') {
      // Set the test personalities to a dict with 1-6 keys from the opt1 to opt6 fields in metadataQuiz
      result.test.personalities = {};
      result.test.personalitiesDesc = {};
      for (let i = 1; i <= 6; i++) {
        result.test.personalities[i] = result.test.metadataQuiz['opt' + i].split('|')[0];
        if (result.test.personalities[i]) {
          result.test.personalitiesDesc[i] = result.test.metadataQuiz['opt' + i].split('|')[1];
        } else {
          result.test.personalitiesDesc[i] = '';
        }
      }
      const [personalitiesCount, orderedPersonalities] = getPersonalityCountFromHitsAndFails(result.hits, result.fails);
      result.personalitiesCount = personalitiesCount;
      result.orderedPersonalities = orderedPersonalities;
    }

    // SEO metadata: use the real quiz name so shared results show meaningful previews
    res.locals.pageTitle = `Result: ${result.test.name} | WiseSloth.open`;
    res.locals.pageDescription = `Result page for WiseSloth.open: learn from your errors in ${result.test.name}.`;
    // If ajax request, send json response
    if (req.query.ajax === 'true') return res.json({ renderedHTML: getRenderedTemplate(SHOW_RESULT_TEMPLATE_CONTENT, res.locals, { result }) });
    // Render the results view
    return res.render('results/show.ejs', { result, minimalFooter: true });
  } catch (error) {
    next(error, req, res);
  }
};

// POST /api/results/:resultUUID/check
// Handles the evaluation of test questions, marking them as correct, incorrect, or unanswered.
// Updates the statistics of the user, test, and quizzes (only if user is authenticated).
// Creates a result object (only if the user is authenticated).
exports.checkTestAndCreateResult = async (req, res, next) => {
  const resultId = req.params.resultUUID;


  try {
    // Get form data from request body
    const formData = req.body;
    // Get duration and chosen options from request body
    const nSeconds = Number(formData.nSeconds);
    const chosenOptsDict = getChosenOptsDict(formData);

    const user = req.session.user;
    if (!user) return res.status(401).json({ error: 'Sign in to save results.' });

    // Get user id
    const userId = user.id;

    // Check that there is a tryConfig for this result id in the session
    const tryConfig = cacheCtrl.getTryConfigFromCache(resultId, userId);
    if (!tryConfig) {
      return res.json({ success: false, error: 'No tryConfig found for result id: ' + resultId + ' and user id: ' + userId });
    }

    // Set try config user id
    if (!tryConfig.userId) cacheCtrl.setTryConfigUserId(resultId, req.session.user.id);

    // Get tryConfig from session
    const { testId, nQuestions, randomQuizIds, randomQuizzesOpts, quizzes } = tryConfig;
    const { testType, metadataQuiz } = tryConfig;

    // Check if there is a test result with this id already in the DB
    const existingResult = await TestResult.findByPk(resultId);
    if (existingResult) {
      // If the result already exists, get all its quiz results and make sure
      // that in case we have chosen opts for one of them we update the quiz result
      // with the new values in case its previous value was omitted
      // Also count total number of hits, fails, and omissions
      let hits = 0;
      let fails = 0;
      let omissions = 0;
      let score = 0;

      const quizResults = await QuizResult.findAll({ where: { testResultId: resultId } });
      const quizResultsToUpdate = [];
      for (const quizResult of quizResults) {
        const quizId = quizResult.quizId;
        const chosenOpts = chosenOptsDict[quizId];
        if ((quizResult.result === 'omitted') && (chosenOpts !== '0')) {
          // console.log("Quiz result omitted - When it has chosen opts:", chosenOpts);
          if (chosenOpts) {
            // Check the quiz and calculate the score
            const quiz = quizzes.find((quiz) => quiz.id === quizId);
            const checkedQuiz = checkQuizAndCalcScore(quiz, chosenOpts, nQuestions);
            const result = checkedQuiz.isCorrect ? 'correct' : 'incorrect';
            const score = checkedQuiz.score;
            // Update the quiz result object
            quizResult.score = score;
            quizResult.result = result;
            quizResult.chosenOpts = chosenOpts;
            quizResultsToUpdate.push(quizResult);
          }
        }
        // Update the counters
        score += Number(quizResult.score);
        if (quizResult.result === 'correct') {
          hits++;
        } else if (quizResult.result === 'incorrect') {
          fails++;
        } else {
          omissions++;
        }
      }

      // Update the quiz results in the DB
      await Promise.all(quizResultsToUpdate.map((quizResult) => quizResult.save()));

      // Update the test result object
      existingResult.hits = hits;
      existingResult.fails = fails;
      existingResult.omissions = omissions;
      existingResult.nSeconds = nSeconds;
      existingResult.score = score;
      await existingResult.save();

      // Remove the tryConfig from the cache
      cacheCtrl.removeTryConfigFromCache(resultId);

      return res.json({ success: true, href: '/results/' + resultId });
    }

    // Initialize quiz checking arrays and variables
    let testResult = null;
    let [testScore, hits, fails, omissions, number] = [0, 0, 0, 0, 0];
    const createQuizResultPromises = [];
    const quizResults = [];

    // If it is a test of type 'knowledge'
    if (testType === 'knowledge') {
      for (const quizId of randomQuizIds) {
        number++;
        const quiz = quizzes.find((quiz) => quiz.id === quizId);
        const chosenOpts = chosenOptsDict[quizId] || '0'; // Default to "0" if undefined
        const orderOpts = randomQuizzesOpts[quizId].join(',');

        // Check if the quiz was omitted (no answer or explicitly "0")
        const isOmitted = !chosenOptsDict[quizId] || chosenOptsDict[quizId] === '0';

        let result = '';
        let score = 0;
        // If it wasn't omitted, check if it's correct and calculate the score
        if (!isOmitted) {
          const checkedQuiz = checkQuizAndCalcScore(quiz, chosenOpts, nQuestions);
          if (checkedQuiz.isCorrect) {
            result = 'correct';
            hits++;
          } else {
            result = 'incorrect';
            fails++;
          }
          // Set quiz score and add to test score
          score = checkedQuiz.score;
          testScore += score;
        // Otherwise set as omitted
        } else {
          result = 'omitted';
          omissions++;
        }

        // Build the quiz result object
        const quizResult = {
          testResultId: resultId,
          quizId: quizId,
          testId: testId,
          userId: userId,
          number: number,
          score: score,
          result: result,
          orderOpts: orderOpts,
          chosenOpts: chosenOpts,
        };

        // Push the quiz result and the promise to the arrays
        quizResults.push(quizResult);
        createQuizResultPromises.push(QuizResult.create(quizResult));
      }

      // Build the test result object
      testResult = {
        id: resultId,
        testId: testId,
        userId: userId,
        score: testScore,
        hits: hits,
        fails: fails,
        omissions: omissions,
        nQuestions: nQuestions,
        nSeconds: nSeconds,
      };

    // If it is a test of type 'personality'
    } else if (testType === 'personality') {
      // Count the number of times each option is chosen
      const chosenOptsCount = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
      for (const quizId of randomQuizIds) {
        number++;
        const chosenOpts = chosenOptsDict[quizId] || '0'; // Default to "0" if undefined
        const orderOpts = randomQuizzesOpts[quizId].join(',');

        // Check if the quiz was omitted (no answer or explicitly "0")
        let chosenOptNumber = 0;
        let chosenPersonality = '';
        if (chosenOpts && chosenOpts !== '0') {
          chosenOptNumber = Number(chosenOpts);
          chosenPersonality = metadataQuiz['opt' + chosenOptNumber].split('|')[0];
          if (chosenOpts in chosenOptsCount) {
            chosenOptsCount[chosenOpts]++;
          } else {
            chosenOptsCount[chosenOpts] = 1;
          }
        } else {
          omissions++;
        }

        // Create the quiz result object
        const quizResult = {
          testResultId: resultId,
          quizId: quizId,
          testId: testId,
          userId: userId,
          number: number,
          score: -1,
          result: chosenPersonality,
          orderOpts: orderOpts,
          chosenOpts: chosenOpts,
        };

        // Push the quiz result and the promise to the arrays
        quizResults.push(quizResult);
        createQuizResultPromises.push(QuizResult.create(quizResult));
      }

      // Build the score string
      let testScoreStr1 = '';
      let testScoreStr2 = '';
      for (const [i, count] of Object.entries(chosenOptsCount)) {
        let countStr = '';
        if (count < 10) {
          countStr = `9${count}`;
        } else {
          countStr = `${count}`;
        }
        if (i <= 3) {
          testScoreStr1 += countStr;
        } else {
          testScoreStr2 += countStr;
        }
      }

      // Turn the score string into a number
      // console.log("Test score string:", testScoreStr);
      const testScore1 = Number(testScoreStr1);
      const testScore2 = Number(testScoreStr2);
      // console.log("Test score:", testScore);

      // Build the test result object
      testResult = {
        id: resultId,
        testId: testId,
        userId: userId,
        score: -1,
        hits: testScore1,
        fails: testScore2,
        omissions: omissions,
        nQuestions: nQuestions,
        nSeconds: nSeconds,
      };
    }

    // Check if not all are omits, if so, redirect to test
    if (omissions === nQuestions) {
      return res.json({ success: false, href: '/tests/' + testId });
    }

    // Save results in DB
    // Create the test result
    await TestResult.create(testResult);
    // Create the quizzes results
    await Promise.all(createQuizResultPromises);

    // Add testId to req.session.user.triedIds if not already there
    if (!req.session.user.triedIds.includes(testId)) {
      req.session.user.triedIds.push(testId);
    }

    // Remove the tryConfig from the cache
    cacheCtrl.removeTryConfigFromCache(resultId);
    // Wait for any potential session store save to complete
    await new Promise((resolve) => req.session.save(resolve));

    // Delete test results from cache
    cacheCtrl.removeTestResultsFromCachedTest(testId);
    // Delete quiz results from cache
    cacheCtrl.removeQuizResultsFromCachedTest(testId);

    // Redirect to show result view
    return res.json({ success: true, href: '/results/' + resultId });
  } catch (error) {
    // Log the error details
    console.error('Error creating result:', error.message);
    // You can also log the entire error object for more details
    console.error('Full error details:', error);

    // Process the error
    next(error, req, res);
  }
};

// POST /api/results/:resultUUID/checkquiz
// Handles the evaluation of a single quiz question.
// Should be used for AJAX requests.
// Must create a quizResult object in the DB and return a JSON response.
// Additionally, it must update the testResult object in the DB with the new score,
// hits, fails, and omissions, as well as latest nSeconds value.
exports.checkQuiz = async (req, res, _next) => {
  try {
    const resultId = req.params.resultUUID;

    // Get fingerprint string from request body

    if (!req.session.user) return res.status(401).json({ error: 'Sign in to save results.' });

    // Check that there is a tryConfig for this result id in the session
    const tryConfig = cacheCtrl.getTryConfigFromCache(resultId, req.session.user.id);
    if (!tryConfig) {
      return res.status(400).json({ success: false, error: 'Quiz session expired. Start the test again.' });
    }

    // Set try config user id
    if (!tryConfig.userId) cacheCtrl.setTryConfigUserId(resultId, req.session.user.id);

    // Get test settings from session
    const { testId, nQuestions, randomQuizIds, randomQuizzesOpts, quizzes } = tryConfig;

    // Get form data from request body
    const formData = req.body;
    const quizId = formData.quizId;
    const nSeconds = Number(formData.nSeconds);

    // Remove testId, quizId, and nSeconds from formData
    delete formData.testId;
    delete formData.quizId;
    delete formData.nSeconds;

    // Get the quiz object
    const quiz = quizzes.find((quiz) => quiz.id === quizId);

    // Generate the chosenOptsDict
    const chosenOptsDict = getChosenOptsDict(formData);
    const chosenOpts = chosenOptsDict[quizId];
    const orderOpts = randomQuizzesOpts[quizId].join(',');
    const correctOpts = quiz.correct_opts;

    // Check if the quiz was omitted
    const isOmitted = chosenOpts === '0';

    let result = '';
    let score = 0;
    if (!isOmitted) {
      const checkedQuiz = checkQuizAndCalcScore(quiz, chosenOpts, nQuestions);
      result = checkedQuiz.isCorrect ? 'correct' : 'incorrect';
      score = checkedQuiz.score;
    } else {
      result = 'omitted';
    }

    // Check if the test result exists
    let testResult = await TestResult.findByPk(resultId);
    if (!testResult) {
      // Create the test result object
      testResult = {
        id: resultId,
        testId: testId,
        userId: req.session.user.id,
        score: score,
        hits: result === 'correct' ? 1 : 0,
        fails: result === 'incorrect' ? 1 : 0,
        omissions: nQuestions - (result === 'omitted' ? 0 : 1),
        nQuestions: nQuestions,
        nSeconds: nSeconds,
      };
      // Create the test result in the DB
      TestResult.create(testResult); // removed await for speed reasons

      // Also create the quiz result for all the other quizzes in the try config
      // as if they were omitted for now
      const createQuizResultPromises = [];
      for (const otherQuizId of randomQuizIds) {
        if (otherQuizId !== quizId) {
          const otherQuizResultNumber = randomQuizIds.indexOf(otherQuizId) + 1;

          const otherOrderOpts = randomQuizzesOpts[otherQuizId].join(',');
          const otherQuizResult = {
            testResultId: resultId,
            quizId: otherQuizId,
            testId: testId,
            userId: req.session.user.id,
            number: otherQuizResultNumber,
            score: 0,
            result: 'omitted',
            orderOpts: otherOrderOpts,
            chosenOpts: '0',
          };
          createQuizResultPromises.push(QuizResult.create(otherQuizResult));
        }
      }

      // Wait for all the quiz results to be created
      Promise.all(createQuizResultPromises); // removed await for speed reasons
    } else {
      // Update the test result object
      testResult.score += score;
      testResult.hits += result === 'correct' ? 1 : 0;
      testResult.fails += result === 'incorrect' ? 1 : 0;
      testResult.omissions -= result === 'omitted' ? 0 : 1;
      testResult.nSeconds = nSeconds;
      // Update the test result in the DB
      testResult.save(); // removed await for speed reasons
    }

    // Add to user session triedIds if not already there
    if (!req.session.user.triedIds.includes(testId)) {
      req.session.user.triedIds.push(testId);
    }

    // The quiz result number must match the position of the quiz in the try config
    const quizResultNumber = randomQuizIds.indexOf(quizId) + 1;

    // Create the quiz result object
    const quizResult = {
      testResultId: resultId,
      quizId: quizId,
      testId: testId,
      userId: req.session.user.id,
      number: quizResultNumber,
      score: score,
      result: result,
      orderOpts: orderOpts,
      chosenOpts: chosenOpts,
    };

    // Try to find a quiz result with the same test result id and quiz id
    const existingQuizResult = await QuizResult.findOne({
      where: {
        testResultId: resultId,
        quizId: quizId,
      },
    });
    // If it exists, update it with the new values
    if (existingQuizResult) {
      existingQuizResult.score = score;
      existingQuizResult.result = result;
      existingQuizResult.chosenOpts = chosenOpts;
      existingQuizResult.save(); // removed await for speed reasons
    } else {
      // Otherwise, create a new quiz result
      QuizResult.create(quizResult); // removed await for speed reasons
    }

    // Delete test results from cache
    cacheCtrl.removeTestResultsFromCachedTest(testId);
    // Delete quiz results from cache
    cacheCtrl.removeQuizResultsFromCachedTest(testId);

    // Answer with a json response
    return res.json({ success: true, result, chosenOpts, correctOpts });
  } catch (error) {
    // Log the error details
    console.error('Error checking quiz:', error.message);
    // Return a json response with the error message
    return res.json({ success: false, error: error.message });
  }
};


// DELETE /results/:resultUUID
exports.deleteResult = async (req, res, _next) => {
  try {
    const resultUUID = req.params.resultUUID;

    // Get the test result to delete from the DB
    const testResult = await TestResult.findByPk(resultUUID, {
      include: [
        {
          model: Test,
          as: 'test',
        }
      ],
    });

    if (!testResult) {
      return res.status(404).send('Test result not found.');
    }

    // Get the test id
    const testId = testResult.test.id;

    // Check that user is either admin or the test author
    const user = req.session.user;
    if (!user || (!user.isAdmin && user.id !== testResult.test.userId)) {
      return res.status(403).send('You are not authorized to delete this result.');
    }

    // Delete the test result and associated quiz results
    await TestResult.destroy({ where: { id: resultUUID } });
    await QuizResult.destroy({ where: { testResultId: resultUUID } });

    // Delete test results from cache
    cacheCtrl.removeTestResultsFromCachedTest(testId);
    // Delete quiz results from cache
    cacheCtrl.removeQuizResultsFromCachedTest(testId);

    // Send test id to redirect to the test page
    return res.status(200).json({ testId: testResult.test.id });
  } catch (error) {
    const errorMessage = 'Error deleting the result: ' + error.message;
    return res.status(500).send(errorMessage);
  }
};
