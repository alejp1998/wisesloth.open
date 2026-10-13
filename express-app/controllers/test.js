'use strict';

// REQUIRES
const { Op } = require('sequelize');
const uuid = require('uuid');

// MODELS
const { models } = require('../models');
const { User, Test, Quiz, Flashcard, TestResult, QuizResult, Favorite } = models;

// HELPERS
const { paginate } = require('../helpers/paginate');
const { getVisibilityConditions } = require('../helpers/visibility-conditions');
const { getPersonalityCountFromHitsAndFails } = require('../helpers/personality-count');
const { deleteQuiz, deleteQuizzesByTest } = require('../helpers/delete-quiz');
const { mapQuizToAIQuestion, mapAIQuestionToQuiz } = require('../helpers/quiz-mapping');
const { checkUserCanCreate, recordAiUsage } = require('../helpers/ai-edit-usage');
const { loadTemplateContent, getRenderedTemplate } = require('../helpers/load-template-content');
const languagesDict = require('../helpers/languages');
const cacheCtrl = require('../helpers/cache');
const { canReadTest } = require('../helpers/test-access');

// CONSTANTS
const INDEX_TEMPLATE_CONTENT = loadTemplateContent('test-index');
const SHOW_TEMPLATE_CONTENT = loadTemplateContent('test-show');
const EDIT_TEMPLATE_CONTENT = loadTemplateContent('test-edit');
const TRY_TEMPLATE_CONTENT = loadTemplateContent('test-try');
const TEST_NOT_FOUND_TEMPLATE_CONTENT = loadTemplateContent('test-not-found');
const FLASHCARDS_TEMPLATE_CONTENT = loadTemplateContent('flashcards-show');
const FLASHCARDS_EDIT_TEMPLATE_CONTENT = loadTemplateContent('flashcards-edit');

// AI service API base URL (FastAPI)
const API_URL = (process.env.AI_API_URL || 'http://fastapi-api:5000') + '/v1/';
const { fetchAI } = require('../helpers/ai-client');


// AUXILIARY VARIABLES

// AUXILIARY FUNCTIONS

// Load flashcards for a test ordered by number
async function loadFlashcards(testId) {
  const flashcardsFromDB = await Flashcard.findAll({
    where: { testId },
    attributes: ['id', 'number', 'front', 'back', 'image_url', 'updatedAt', 'createdAt'],
    order: [['number', 'ASC']],
  });
  return flashcardsFromDB.map((flashcard) => flashcard.get({ plain: true }));
}

// Count non-empty quiz options
function countNonEmptyOptions(quiz) {
  const optionAttrs = ['opt1', 'opt2', 'opt3', 'opt4', 'opt5', 'opt6'];
  return optionAttrs.reduce((count, option) => {
    const isOptionEmpty = (quiz[option] === '' || quiz[option].startsWith('[Exp]'));
    return count + (isOptionEmpty ? 0 : 1);
  }, 0);
}

// Build test stats dict
const buildTestStatsDict = (userId, testNQuestions, testResults, type = 'knowledge') => {
  let statsDict = {};
  let nSecondsPerQuestion = 0;
  if (type === 'knowledge') {
    statsDict = {
      nTries: testResults.length,
      nSeconds: 0,
      totalHits: 0,
      totalFails: 0,
      totalOmissions: 0,
      userHits: 0,
      userFails: 0,
      userOmissions: 0,
    };

    // Iterate through testResults
    testResults.forEach((testResult) => {
      // Add time to nSecondsPerQuestion
      nSecondsPerQuestion += testResult.nSeconds / testResult.nQuestions;

      // Add up totals
      statsDict.totalHits += testResult.hits;
      statsDict.totalFails += testResult.fails;
      statsDict.totalOmissions += testResult.omissions;

      // Add up totals specific to the target userIds
      if (testResult.userId === userId) {
        statsDict.userHits += testResult.hits;
        statsDict.userFails += testResult.fails;
        statsDict.userOmissions += testResult.omissions;
      }
    });
  } else if (type === 'personality') {
    statsDict = {
      nTries: testResults.length,
      nSeconds: 0,
    };

    // Iterate through testResults
    testResults.forEach((testResult) => {
      // Add time to nSecondsPerQuestion
      nSecondsPerQuestion += testResult.nSeconds / testResult.nQuestions;
    });
  }

  // Adjust nSeconds depending on total nQuestions
  statsDict.nSeconds = (nSecondsPerQuestion * testNQuestions) / statsDict.nTries || 0;

  return statsDict;
};

// Build quiz stats dict
const buildQuizStatsDict = (quizId, quizUpdatedAt, userId, testQuizResults, type = 'knowledge') => {
  let statsDict = {};
  if (type === 'knowledge') {
    statsDict = {
      totalHits: 0,
      totalFails: 0,
      totalOmissions: 0,
      userHits: 0,
      userFails: 0,
      userOmissions: 0,
    };
  }

  // Initialize un1, un2, un3, un4, un5, un6, tn1, tn2, tn3, tn4, tn5, tn6 to 0
  for (let i = 1; i <= 6; i++) {
    statsDict['un' + i] = 0;
    statsDict['tn' + i] = 0;
  }

  // Get quiz results with the target quizId and after the quiz was modified
  testQuizResults = testQuizResults.filter(
    (quizResult) => quizResult.quizId === quizId && quizResult.updatedAt > quizUpdatedAt
  );

  // Iterate through testResults
  testQuizResults.forEach((quizResult) => {
    // Split the string into an array of numbers
    const chosenOpts = quizResult.chosenOpts.split(',').map(Number);

    if (type === 'knowledge') {
      const isHit =
        quizResult.result === 'correct' && quizResult.quizId === quizId;
      const isFail =
        quizResult.result === 'incorrect' && quizResult.quizId === quizId;
      const isOmission =
        quizResult.result === 'omitted' && quizResult.quizId === quizId;


      // Add up totals
      statsDict.totalHits += isHit;
      statsDict.totalFails += isFail;
      statsDict.totalOmissions += isOmission;

      // Add up totals specific to the target userIds
      if (quizResult.userId === userId) {
        statsDict.userHits += isHit;
        statsDict.userFails += isFail;
        statsDict.userOmissions += isOmission;
      }

      // Loop through the numbers and update the corresponding property in the stats object
      chosenOpts.forEach((num) => {
        if (num === 0) return;
        statsDict['tn' + num]++;
        if (quizResult.userId === userId) {
          statsDict['un' + num]++;
        }
      });
    } else if (type === 'personality') {
      // Get the personality number chosen by the user
      const chosenPersonality = chosenOpts[0];
      if (chosenPersonality === 0) return;

      // Update the corresponding property in the stats object
      statsDict['tn' + chosenPersonality]++;
      if (quizResult.userId === userId) {
        statsDict['un' + chosenPersonality]++;
      }
    }
  });

  return statsDict;
};

// Get tests count
exports.getTestsCount = async (_req, _res, _next) => {
  try {
    return await Test.count();
  } catch (error) {
    console.error('Error getting tests count:', error);
    return 0;
  }
};

// Get top 5 tests by number of favorites
exports.getTopTestsByLikes = async (_req, _res, _next) => {
  try {
    // Get tests with favoritedBy
    let tests = await Test.findAll({
      where: { visibility: 'public' },
      include: [
        {
          model: User,
          as: 'favoritedBy',
          attributes: ['id'],
        },
        {
          model: User,
          as: 'author',
          attributes: ['username'],
        }
      ],
    });

    // Limit each test object to just : id, name, nFavorites, author
    tests = tests.map((test) => {
      return {
        id: test.id,
        name: test.name,
        nFavorites: test.favoritedBy.length,
        author: test.author.username,
      };
    });

    // Sort tests by number of favorites
    tests.sort((a, b) => b.nFavorites - a.nFavorites);

    // Get the top 5 tests
    return tests.slice(0, 5);
  } catch (error) {
    console.error('Error getting top tests:', error);
    return [];
  }
};

// Get top 5 tests by number of tries
exports.getTopTestsByTries = async (_req, _res, _next) => {
  try {
    // Get tests with testResults
    let tests = await Test.findAll({
      where: { visibility: 'public' },
      include: [
        {
          model: TestResult,
          as: 'testResults',
          attributes: ['id'],
        },
        {
          model: User,
          as: 'author',
          attributes: ['username'],
        }
      ],
    });

    // Limit each test object to just : id, name, nTestResults, author
    tests = tests.map((test) => {
      return {
        id: test.id,
        name: test.name,
        nTestResults: test.testResults.length,
        author: test.author.username,
      };
    });

    // Sort tests by number of test results
    tests.sort((a, b) => b.nTestResults - a.nTestResults);

    // Get the top 5 tests
    return tests.slice(0, 5);
  } catch (error) {
    console.error('Error getting top tried tests:', error);
    return [];
  }
};

// Auto-load test associated with :testUUID
exports.load = async (req, res, next, testUUID) => {
  try {
    // Recheck against the database before using cached content: changing a
    // public quiz to private must revoke access immediately.
    const accessTest = await Test.findByPk(testUUID, { attributes: ['id', 'userId', 'visibility'] });
    if (!accessTest || !canReadTest(accessTest, req.session.user)) {
      return res.status(404).render('tests/test-not-found.ejs');
    }
    // Try to get test from cache
    let test = cacheCtrl.getTestFromCachedTest(testUUID);
    if (!test) {
      console.time('DB test query time');
      const testFromDB = await Test.findByPk(testUUID, {
        include: [
          {
            model: User,
            as: 'author',
            attributes: ['id', 'username'],
          },
        ],
      });
      console.timeEnd('DB test query time');

      // If the test is not found, return an error
      if (!testFromDB) {
        // If it was an ajax request
        if (req.query.ajax) {
          const renderedHTML = getRenderedTemplate(TEST_NOT_FOUND_TEMPLATE_CONTENT, res.locals);
          // Set response status to 404 (Not Found)
          res.status(404);
          return res.json({ renderedHTML: renderedHTML });
        }
        // Set the response status to 404 (Not Found)
        res.status(404);
        // If it was a regular request
        return res.render('tests/test-not-found.ejs');
      }

      // Remove unnecessary sequelize metadata and keep just the raw objects
      // This should remove unnecessary data and make the object easier to work with
      // Make sure it is a sequelize object before calling get
      test = testFromDB.get ? testFromDB.get({ plain: true }) : testFromDB;
      // console.log(test.author);

      // Save the test to the cache
      cacheCtrl.addTestToCache(test);
    } else {
      // Log that we are loading the test from the cache
      // console.log("Test loaded from cache");
    }

    // Fetch quizzes, test results and quiz results in parallel (from cache or DB)
    const [quizzes, testResults, quizResults] = await Promise.all([
      (async () => {
        const cached = cacheCtrl.getQuizzesFromCachedTest(testUUID);
        if (cached) return cached;
        console.time('DB quizzes query time');
        const quizzesFromDB = await Quiz.findAll({
          where: { testId: testUUID },
          attributes: [
            'id',
            'number',
            'question',
            'correct_opts',
            'image_url',
            'opt1',
            'opt2',
            'opt3',
            'opt4',
            'opt5',
            'opt6',
            'updatedAt',
            'createdAt',
          ],
        });
        console.timeEnd('DB quizzes query time');
        // Remove unnecessary sequelize metadata and keep just the raw objects
        const plain = quizzesFromDB.map((quiz) => quiz.get({ plain: true }));
        // Add the quizzes to the cache
        cacheCtrl.addQuizzesToCachedTest(testUUID, plain);
        return plain;
      })(),
      (async () => {
        const cached = cacheCtrl.getTestResultsFromCachedTest(testUUID);
        if (cached) return cached;
        console.time('DB test results query time');
        const testResultsFromDB = await TestResult.findAll({
          where: { testId: testUUID },
          attributes: [
            'id',
            'userId',
            'score',
            'nQuestions',
            'nSeconds',
            'hits',
            'fails',
            'omissions',
            'createdAt',
            'updatedAt',
          ],
          include: [
            {
              model: User,
              as: 'examinee',
              attributes: ['username'],
            },
          ],
        });
        console.timeEnd('DB test results query time');
        // Remove unnecessary sequelize metadata and keep just the raw objects
        const plain = testResultsFromDB.map((testResult) => testResult.get({ plain: true }));
        // Add the test results to the cache
        cacheCtrl.addTestResultsToCachedTest(testUUID, plain);
        return plain;
      })(),
      (async () => {
        const cached = cacheCtrl.getQuizResultsFromCachedTest(testUUID);
        if (cached) return cached;
        console.time('DB quiz results query time');
        const testQuizResultsFromDB = await QuizResult.findAll({
          where: { testId: testUUID },
          attributes: ['quizId', 'userId', 'result', 'chosenOpts', 'createdAt', 'updatedAt'],
        });
        console.timeEnd('DB quiz results query time');
        // Remove unnecessary sequelize metadata and keep just the raw objects
        const plain = testQuizResultsFromDB.map((quizResult) => quizResult.get({ plain: true }));
        // Add the quiz results to the cache
        cacheCtrl.addQuizResultsToCachedTest(testUUID, plain);
        return plain;
      })(),
    ]);
    // Set the quizzes in the test object
    test.quizzes = quizzes;
    // Set the test results in the test object
    test.testResults = testResults;
    // Set the quiz results in the test object
    test.testQuizResults = quizResults;

    // Try to parse text context value from JSON
    try {
      // console.log("Parsing context JSON: ", test.context);
      test.creationData = JSON.parse(test.context);
      // console.log("Parsed context into creationData: ", test.creationData);
    } catch (error) {
      test.parsedContext = {};
      // console.error("Error parsing context JSON:", error);
    }

    // Replace the topic by the same topic without accents
    test.topic = test.topic.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Set test type (prefer the DB type column, fall back to context for legacy data)
    if (!test.type) {
      if (test.context === 'personality') {
        test.type = 'personality';
      } else if (test.creationData && test.creationData.type === 'flashcards') {
        test.type = 'flashcards';
      } else {
        test.type = 'knowledge';
      }
    }

    // Remove quiz with number = 0 from the quizzes array and set it as test.metadataQuiz
    test.metadataQuiz = test.quizzes.find((quiz) => quiz.id === test.id);
    test.quizzes = test.quizzes.filter((quiz) => quiz.number !== 0);

    // console.log('Metadata Quiz:', test.metadataQuiz);
    // console.log('Quizzes:', test.quizzes);

    // Get the latest quiz updatedAt date
    if (test.metadataQuiz) {
      test.latestQuizUpdatedAt = test.metadataQuiz.updatedAt;
    } else {
      test.latestQuizUpdatedAt = test.quizzes.reduce((latest, quiz) => {
        return quiz.updatedAt > latest ? quiz.updatedAt : latest;
      }, (test.quizzes.length > 0) ? test.quizzes[0].updatedAt : new Date(0));
    }
    // console.log('Latest Quiz Updated At:', test.latestQuizUpdatedAt);

    // Get userId
    const userId = req.session.user ? req.session.user.id : null;

    console.time('Counting favorites time');
    // Count number of favorites for the test
    test.nFavorites = await Favorite.count({ where: { testId: test.id } });
    console.timeEnd('Counting favorites time');

    if (test.type === 'knowledge') {
      console.time('Building test stats time');
      // Build test stats dict
      test.stats = buildTestStatsDict(userId, test.quizzes.length, test.testResults);
      console.timeEnd('Building test stats time');

      console.time('Building quiz stats time');
      // Build stats for each quiz
      test.quizzes = test.quizzes.map((quiz) => {
        quiz.stats = buildQuizStatsDict(quiz.id, quiz.updatedAt, userId, test.testQuizResults);
        return quiz;
      });
      console.timeEnd('Building quiz stats time');

      // Sort the quizzes by number
      test.quizzes.sort((a, b) => a.number - b.number);

      // Get the 25 latest results from test.testResults
      test.testResults.sort((a, b) => b.updatedAt - a.updatedAt);
      test.latestResults = test.testResults.slice(0, 25);

      console.time('Getting best results time');
      // Get the 25 best test results from test.testResults
      // Only take into account test results whose updatedAt is after the latest quiz was modified
      // and whose number of questions is equal to the number of quizzes
      test.bestResults = test.testResults.filter((testResult) =>
        (testResult.updatedAt > test.latestQuizUpdatedAt) && (testResult.nQuestions === test.quizzes.length)
      );
      // To order result from best to worse, use weighted sum of lower duration, higher score and higher number of questions
      test.bestResults = test.bestResults.sort((a, b) => {
        const weightedSumA = 100000 * (a.score / a.nQuestions) + 50 * a.nQuestions - a.nSeconds;
        const weightedSumB = 100000 * (b.score / b.nQuestions) + 50 * b.nQuestions - b.nSeconds;
        return weightedSumB - weightedSumA;
      }).slice(0, 25);
      console.timeEnd('Getting best results time');

      if (userId) {
        console.time('Getting user results time');
        // Get the 25 results from test.testResults for the current user
        test.userResults = test.testResults.filter(
          (testResult) => testResult.userId === userId
        );
        test.userResults.sort((a, b) => b.updatedAt - a.updatedAt);
        test.userResults = test.userResults.slice(0, 25);
        console.timeEnd('Getting user results time');
      }
    } else if (test.type === 'personality') {
      console.time('Building test stats time');
      // Build test stats dict
      test.stats = buildTestStatsDict(userId, test.quizzes.length, test.testResults, 'personality');
      console.timeEnd('Building test stats time');

      // Set the test personalities to a dict with 1-6 keys from the opt1 to opt6 fields in metadataQuiz
      test.personalities = {};
      test.personalitiesDesc = {};
      for (let i = 1; i <= 6; i++) {
        test.personalities[i] = test.metadataQuiz['opt' + i].split('|')[0];
        if (test.personalities[i]) {
          test.personalitiesDesc[i] = test.metadataQuiz['opt' + i].split('|')[1];
        } else {
          test.personalitiesDesc[i] = '';
        }
      }

      console.time('Building quiz stats time');
      // Build stats for each quiz
      const quizzesWithStats = [];
      for (const quiz of test.quizzes) {
        const quizWithStats = quiz;
        quizWithStats.stats = buildQuizStatsDict(quiz.id, quiz.updatedAt, userId, test.testQuizResults, 'personality');
        quizzesWithStats.push(quizWithStats);
      }
      test.quizzes = quizzesWithStats;
      console.timeEnd('Building quiz stats time');

      // Sort the quizzes by number
      test.quizzes.sort((a, b) => a.number - b.number);

      // For the latest results, get personalities count
      const tns = { 1:0, 2:0, 3:0, 4:0, 5:0, 6:0 };
      for (const testResult of test.testResults) {
        const [personalitiesCount] = getPersonalityCountFromHitsAndFails(testResult.hits, testResult.fails);
        Object.keys(tns).forEach(key => {
          if (Object.prototype.hasOwnProperty.call(personalitiesCount, key)) {
            tns[key] += personalitiesCount[key];
          }
        });
      }
      test.latestResults = test.testResults.slice(0, 25);
      const uns = { 1:0, 2:0, 3:0, 4:0, 5:0, 6:0 };
      if (userId) {
        console.time('Getting user results time');
        test.userResults = test.testResults.filter(
          (testResult) => testResult.userId === userId
        );
        for (const testResult of test.userResults) {
          const [personalitiesCount] = getPersonalityCountFromHitsAndFails(testResult.hits, testResult.fails);
          Object.keys(uns).forEach(key => {
            if (Object.prototype.hasOwnProperty.call(uns, key)) {
              uns[key] += personalitiesCount[key];
            }
          });
        }
        test.userResults = test.userResults.slice(0, 25);
        console.timeEnd('Getting user results time');
      }

      // Build test stats dict
      test.stats = {
        un1: uns[1], un2: uns[2], un3: uns[3], un4: uns[4], un5: uns[5], un6: uns[6],
        tn1: tns[1], tn2: tns[2], tn3: tns[3], tn4: tns[4], tn5: tns[5], tn6: tns[6],
        ...test.stats
      };
    } else if (test.type === 'flashcards') {
      // Flashcards have no quizzes/results stats - keep minimal metadata
      test.stats = { nTries: 0, nSeconds: 0, totalHits: 0, totalFails: 0, totalOmissions: 0 };
      test.latestResults = [];
      test.bestResults = [];
      test.userResults = [];
      test.latestQuizUpdatedAt = test.updatedAt || new Date();
      // Flashcard tests have no quiz rows; quizzes is empty
      test.metadataQuiz = undefined;
      test.quizzes = [];
    }

    // Delete the test results from the object
    delete test.testResults;
    delete test.testQuizResults;

    // Store the test in the request object
    req.test = test;

    return next();
  } catch (error) {
    next(error, req, res);
  }
};

// GET /tests
exports.index = async (req, res, next) => {
  try {
    const visibility = ['public', 'followers', 'private'].includes(req.query.visibility) ? req.query.visibility : 'all';
    let type = ['liked', 'tried', 'mine', 'following'].includes(req.query.type) ? req.query.type : 'all';
    const search = req.query.search || '';
    const indexLang = req.query.lang || 'all';
    let username = req.query.username || '';
    const topic = req.query.topic || '';
    const orderby = ['date', 'likes', 'questions', 'tries', 'duration'].includes(req.query.orderby) ? req.query.orderby : 'date';
    const orderdir = req.query.orderdir === 'asc' ? 'asc' : 'desc';

    console.time('Build count options');

    // If user not logged in set type to "all"
    if (!req.session.user) {
      type = 'all';
    }

    // If type is "mine" or "tried" and user is not logged in, set type to "all"
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

    // Initialize favorites and followed users' ids
    let favoriteIds = [];
    let iFollowIds = [];
    let triedIds = [];
    if (indexUserId) {
      favoriteIds = indexUser.favoriteIds;
      iFollowIds = indexUser.iFollowIds;
      triedIds = indexUser.triedIds;
    }

    // Initialize search conditions with visibility settings
    let conditions = [];
    if (isAdmin && (visibility !== 'all')) {
      conditions.push({ visibility: visibility });
    } else {
      conditions = getVisibilityConditions(indexUser);
      if (visibility !== 'all') {
        conditions.push({ visibility: visibility });
      }
    }

    // Exclude personality tests by discarding tests whose context is "personality"
    // conditions.push({ context: { [Op.ne]: "personality" } });

    // Consider type for search results
    if (type === 'liked') {
      // Add user's favorite tests to conditions
      conditions.push({ id: { [Op.in]: favoriteIds } });
    } else if (type === 'following') {
      // Add user's followed users' tests to conditions
      conditions.push({ userId: { [Op.in]: iFollowIds } });
    } else if (type === 'tried') {
      // Add user's tried tests to conditions
      conditions.push({ id: { [Op.in]: triedIds } });
    }

    // Add topic to conditions
    if (topic) {
      // Ensure the topic starts exactly with the search term
      const searchLike = `${topic.toString().replace(/ +/g, '%')}%`;
      // Push to conditions and modify title to start with the search term
      conditions.push({ topic: { [Op.or]: {
        [Op.eq]: topic,
        [Op.like]: searchLike
      } } });
    }

    // Add username to conditions
    if (username) {
      // Get user by username
      const userByUsername = await User.findOne({ where: { username: username } });
      // Push to conditions and modify title
      if (userByUsername) {
        conditions.push({ userId: userByUsername.id });
      } else {
        conditions.push({ userId: -1 });
      }
    }

    // Add search to conditions
    if (search) {
      // Normalize text by replacing spaces with %
      const searchLike = `%${search.toString().replace(/ +/g, '%')}%`;
      // Push to conditions
      conditions.push({
        [Op.or]: [
          { name: { [Op.like]: searchLike } },
          { topic: { [Op.like]: searchLike } },
          { desc: { [Op.like]: searchLike } },
        ],
      });
    }

    // Get all distinct languages with conditions
    const distinctLanguages = await Test.aggregate('language', 'DISTINCT', {
      plain: false,
      where: { [Op.and]: conditions },
    });
    // Get unique language codes
    const languageCodes = distinctLanguages.map((indexLang) => indexLang.DISTINCT);
    // Remove language codes not in languagesDict and sort the remaining codes by name
    const languageCodesFiltered = languageCodes.filter((code) => code in languagesDict);
    // Create an ordered list of language codes by the alphabetical order of the language name
    const languageCodesOrdered = languageCodesFiltered.sort((a, b) => languagesDict[a]['name'].localeCompare(languagesDict[b]['name']));

    // Add index language to conditions
    if (indexLang && indexLang !== 'all') {
      conditions.push({ language: indexLang });
    }

    // Get all distinct topics with conditions (dont take accents into account)
    // so that instrumentacion and instrumentación are considered the same topic
    const distinctTopics = await Test.aggregate('topic', 'DISTINCT', {
      plain: false,
      where: { [Op.and]: conditions },
    });
    // Get only distinct topics
    let topics = distinctTopics.map((indexTopic) => indexTopic.DISTINCT);
    if (topic) {
      // Remove the start of the topic from the topics
      // If the topic is a subword of another topic, remove the rest of the word
      topics = topics.map((indexTopic) => {
        indexTopic = indexTopic.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        // If there is a dash right after the topic, get the first word before the next dash
        if (indexTopic.slice(topic.length, topic.length + 1) === '-') {
          return indexTopic.slice(topic.length + 1).split('-')[0];
        }
        // If there is a dash after the topic, get the first word after the dash
        const slicedTopic = indexTopic.slice(topic.length);
        const nextDashIndex = slicedTopic.indexOf('-');
        if (nextDashIndex !== -1) {
          if (nextDashIndex === 0) {
            return slicedTopic.split('-')[1];
          } else {
            return slicedTopic.split('-')[0] + '-' + slicedTopic.split('-')[1];
          }
        } else {
          return '';
        }
      });
    } else {
      // Just keep first word before the dash in the topics
      topics = topics.map((indexTopic) => indexTopic.split('-')[0]);
    }
    // Remove duplicates or empty topics
    topics = topics.filter((indexTopic, index) => topics.indexOf(indexTopic) === index && indexTopic !== '');
    // Sort topics
    topics = topics.sort();

    // Initialize countOptions with conditions
    const countOptions = {
      where: { [Op.and]: conditions },
    };

    console.timeEnd('Build count options');
    console.time('Count tests');

    // Count number of tests satisfying the conditions
    const count = await Test.count(countOptions);

    // Pagination
    const pageItems = 10;
    let pageNo = Number(req.query.pageno) || 1;
    // Check if the page number is valid, if not set it to 1
    if (pageNo < 1 || (pageNo - 1) * pageItems >= count) {
      pageNo = 1;
    }
    const totalPages = Math.ceil(count / pageItems);
    const pageFirstItemIndex = (pageNo - 1) * pageItems + 1;
    const pageLastItemIndex = Math.min(pageNo * pageItems, count);
    const paginateControl = {
      html: paginate(count, pageItems, pageNo, req.url, false),
      totalItems: count,
      totalPages: totalPages,
      pageFirstItemIndex: pageFirstItemIndex,
      pageLastItemIndex: pageLastItemIndex,
      pageNo: pageNo,
    };
    res.locals.paginateControl = paginateControl;

    console.timeEnd('Count tests');
    console.time('Build find options');

    // Initialize findOptions
    const findOptions = {
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['username'],
        },
        {
          model: User,
          as: 'favoritedBy',
          attributes: ['id', 'username'],
        },
      ],
    };

    // Initialize paginatedTestIds
    let paginatedTestIds = [];
    if (orderby === 'date') {
      // Set findOptions where to countOptions where
      findOptions.where = countOptions.where;
      // Set other findOptions parameters
      findOptions.offset = pageItems * (pageNo - 1);
      findOptions.limit = pageItems;
      findOptions.order = [['createdAt', orderdir.toUpperCase()]];
    } else if (orderby === 'likes') {
      // Get test ids satisfying countOptions
      const likesOptions = {
        where: countOptions.where,
        attributes: ['id'],
        include: [
          {
            model: User,
            as: 'favoritedBy',
            attributes: ['id'],
          },
        ]
      };
      // Get tests with favoritedBy
      const testsWithFavorites = await Test.findAll(likesOptions);
      // Sort tests by number of favorites
      if (orderdir === 'asc') {
        testsWithFavorites.sort((a, b) => a.favoritedBy.length - b.favoritedBy.length);
      } else {
        testsWithFavorites.sort((a, b) => b.favoritedBy.length - a.favoritedBy.length);
      }
      // Get the ids of the sorted tests
      const sortedTestIds = testsWithFavorites.map((test) => test.id);
      // Get subset of test ids from pagination offset and limit
      paginatedTestIds = sortedTestIds.slice(pageItems * (pageNo - 1), pageItems * pageNo);
      // Set findOptions where to test ids in paginatedTestIds
      findOptions.where = { id: { [Op.in]: paginatedTestIds } };
    } else if (orderby === 'questions') {
      // Build nquestions options
      const questionsOptions = {
        ...countOptions,
        attributes: ['id'],
        include: [
          {
            model: Quiz,
            as: 'quizzes',
            attributes: ['id'],
          },
        ]
      };
      // Get tests with quizzes
      const testsWithQuizzes = await Test.findAll(questionsOptions);
      // Sort tests by number of quizzes
      if (orderdir === 'asc') {
        testsWithQuizzes.sort((a, b) => a.quizzes.length - b.quizzes.length);
      } else {
        testsWithQuizzes.sort((a, b) => b.quizzes.length - a.quizzes.length);
      }
      // Get the ids of the sorted tests
      const sortedTestIds = testsWithQuizzes.map((test) => test.id);
      // Get subset of test ids from pagination offset and limit
      paginatedTestIds = sortedTestIds.slice(pageItems * (pageNo - 1), pageItems * pageNo);
      // Set findOptions where to test ids in paginatedTestIds
      findOptions.where = { id: { [Op.in]: paginatedTestIds } };
    } else if (orderby === 'tries') {
      // Build ntries options
      const triesOptions = {
        ...countOptions,
        attributes: ['id'],
        include: [
          {
            model: TestResult,
            as: 'testResults',
            attributes: ['id'],
          },
        ]
      };
      // Get tests with testResults
      const testsWithTestResults = await Test.findAll(triesOptions);
      // Sort tests by number of test results
      if (orderdir === 'asc') {
        testsWithTestResults.sort((a, b) => a.testResults.length - b.testResults.length);
      } else {
        testsWithTestResults.sort((a, b) => b.testResults.length - a.testResults.length);
      }
      // Get the ids of the sorted tests
      const sortedTestIds = testsWithTestResults.map((test) => test.id);
      // Get subset of test ids from pagination offset and limit
      paginatedTestIds = sortedTestIds.slice(pageItems * (pageNo - 1), pageItems * pageNo);
      // Set findOptions where to test ids in paginatedTestIds
      findOptions.where = { id: { [Op.in]: paginatedTestIds } };
    } else if (orderby === 'duration') {
      // Build nSeconds options
      const durationOptions = {
        ...countOptions,
        attributes: ['id'],
        include: [
          {
            model: TestResult,
            as: 'testResults',
            attributes: ['id','nSeconds', 'nQuestions'],
          },
          {
            model: Quiz,
            as: 'quizzes',
            attributes: ['id'],
          }
        ]
      };
      // Get tests with testResults
      const testsWithTestResults = await Test.findAll(durationOptions);
      // Calculate average time per question for each test
      testsWithTestResults.forEach((test) => {
        test.avgTime = test.testResults.length > 0 ? test.testResults.reduce((acc, testResult) => acc + testResult.nSeconds / testResult.nQuestions, 0) / test.testResults.length : 0;
        test.avgTime = test.avgTime * test.quizzes.length;
      });
      // Sort tests by average time per question (if no test results, set avgTime to 0)
      testsWithTestResults.sort((a, b) => b.avgTime - a.avgTime);
      // Get the ids of the sorted tests
      const sortedTestIds = testsWithTestResults.map((test) => test.id);
      // Get subset of test ids from pagination offset and limit
      paginatedTestIds = sortedTestIds.slice(pageItems * (pageNo - 1), pageItems * pageNo);
      // Print paginated test ids with their avgTime
      // console.log(paginatedTestIds.map((testId) => {
      //   const test = testsWithTestResults.find((test) => test.id === testId);
      //   return { id: test.id, avgTime: test.avgTime };
      // }));
      // Set findOptions where to test ids in paginatedTestIds
      findOptions.where = { id: { [Op.in]: paginatedTestIds } };
    }

    console.timeEnd('Build find options');
    console.time('Find tests');

    // Find subset of tests for this page
    let tests = await Test.findAll(findOptions);
    // Remove unnecessary sequelize metadata and keep just the raw objects
    tests = tests.map((test) => test.get({ plain: true }));
    // If paginated test ids is empty, set it to the ids of the tests
    if (paginatedTestIds.length === 0) {
      paginatedTestIds = tests.map((test) => test.id);
    }
    console.timeEnd('Find tests');

    // Find the quizzes for paginatedTestIds
    console.time('Find quizzes');
    const quizzes = await Quiz.findAll({
      where: { testId: { [Op.in]: paginatedTestIds } },
      attributes: ['id', 'testId', 'number', 'question', 'correct_opts', 'image_url', 'opt1', 'opt2', 'opt3', 'opt4', 'opt5', 'opt6', 'updatedAt', 'createdAt'],
    });
    console.timeEnd('Find quizzes');

    // Find the flashcards for paginatedTestIds (flashcard tests)
    console.time('Find flashcards');
    const flashcards = await Flashcard.findAll({
      where: { testId: { [Op.in]: paginatedTestIds } },
      attributes: ['id', 'testId', 'number'],
    });
    console.timeEnd('Find flashcards');

    // Find the test results for paginatedTestIds
    console.time('Find test results');
    const testResults = await TestResult.findAll({
      where: { testId: { [Op.in]: paginatedTestIds } },
      attributes: ['id', 'testId', 'userId', 'score', 'nQuestions', 'nSeconds', 'hits', 'fails', 'omissions', 'createdAt', 'updatedAt'],
    });
    console.timeEnd('Find test results');
    console.time('Tests processing');

    tests.forEach((test) => {
      // Attach quizzes and test results to the tests
      test.quizzes = quizzes.filter((quiz) => quiz.testId === test.id);
      test.testResults = testResults.filter((testResult) => testResult.testId === test.id);
      // Set the type (prefer the DB type column, fall back to context for legacy data)
      if (!test.type) {
        if (test.context === 'personality') {
          test.type = 'personality';
        } else {
          // Try to parse text context value from JSON
          try {
            test.creationData = JSON.parse(test.context);
          } catch (error) {
            test.parsedContext = {};
            // console.error("Error parsing context JSON:", error);
          }
          test.type = (test.creationData && test.creationData.type === 'flashcards') ? 'flashcards' : 'knowledge';
        }
      }
      // Replace the topic by the same topic without accents
      test.topic = test.topic.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      // For flashcards, use the flashcard rows as the "quizzes" so counts display correctly
      if (test.type === 'flashcards') {
        test.quizzes = flashcards.filter((fc) => fc.testId === test.id);
      }
    });

    // If paginatedTestIds is not empty, sort the tests by the order of paginatedTestIds
    if (paginatedTestIds.length > 0) {
      tests.sort((a, b) => paginatedTestIds.indexOf(a.id) - paginatedTestIds.indexOf(b.id));
    }

    console.timeEnd('Tests processing');
    console.time('Build test stats');

    // Build test stats for the current user if logged in
    const userId = indexUser ? indexUser.id : null;
    tests.forEach((test) => {
      test.metadataQuiz = test.quizzes.find((quiz) => quiz.id === test.id);
      test.quizzes = test.quizzes.filter((quiz) => quiz.number !== 0);
      test.nFavorites = test.favoritedBy.length;

      if (test.type === 'knowledge') {
        // Build test stats dict
        test.stats = buildTestStatsDict(userId, test.quizzes.length, test.testResults);
      } else if (test.type === 'flashcards') {
        // Flashcards have no results stats - show minimal stats
        test.stats = { nTries: 0, nSeconds: 0, totalHits: 0, totalFails: 0, totalOmissions: 0 };
      } else if (test.type === 'personality') {
        // Build test stats dict
        test.stats = buildTestStatsDict(userId, test.quizzes.length, test.testResults, 'personality');

        // Get test.personalities to a dict with 1-6 keys from the opt1 to opt6 fields in metadataQuiz
        test.personalities = {};
        test.personalitiesDesc = {};
        for (let i = 1; i <= 6; i++) {
          test.personalities[i] = test.metadataQuiz['opt' + i].split('|')[0];
          if (test.personalities[i]) {
            test.personalitiesDesc[i] = test.metadataQuiz['opt' + i].split('|')[1];
          } else {
            test.personalitiesDesc[i] = '';
          }
        }

        // Build tn and un stats for the test
        const tns = { 1:0, 2:0, 3:0, 4:0, 5:0, 6:0 };
        const uns = { 1:0, 2:0, 3:0, 4:0, 5:0, 6:0 };
        for (const testResult of test.testResults) {
          const [personalitiesCount] = getPersonalityCountFromHitsAndFails(testResult.hits, testResult.fails);
          Object.keys(tns).forEach(key => {
            if (Object.prototype.hasOwnProperty.call(personalitiesCount, key)) {
              tns[key] += personalitiesCount[key];
            }
          });
          if (testResult.userId === userId) {
            Object.keys(uns).forEach(key => {
              if (Object.prototype.hasOwnProperty.call(personalitiesCount, key)) {
                uns[key] += personalitiesCount[key];
              }
            });
          }
        }
        test.stats = {
          un1: uns[1], un2: uns[2], un3: uns[3], un4: uns[4], un5: uns[5], un6: uns[6],
          tn1: tns[1], tn2: tns[2], tn3: tns[3], tn4: tns[4], tn5: tns[5], tn6: tns[6],
          ...test.stats
        };
      }
    });

    console.timeEnd('Build test stats');

    // Create the data object to pass to the view
    const data = {
      indexLang,
      type,
      tests,
      topics,
      languages: languageCodesOrdered,
      topic,
      username,
      search,
      orderby,
      orderdir,
    };

    // SEO metadata for the quizzes explore/listing page
    res.locals.pageTitle = 'Explore Quizzes | WiseSloth.open';
    res.locals.pageDescription = 'Browse public AI-generated quizzes from the WiseSloth.open community. Filter by topic, language, and popularity to find your next challenge.';

    // If ajax request, send json response
    if (req.query.ajax === 'true') {return res.json({
      renderedHTML: getRenderedTemplate(INDEX_TEMPLATE_CONTENT, res.locals, data)
    });}
    // Render the index view
    return res.render('tests/index.ejs', data);
  } catch (error) {
    next(error, req, res);
  }
};

// GET /tests/:testUUID/try
exports.tryTest = async (req, res, next) => {
  try {
    // Get the test from the request object
    const test = req.test;

    // Flashcards cannot be "tried" (no quiz flow) - send the user to the study view
    if (test.type === 'flashcards') {
      return res.redirect(`/tests/${test.id}`);
    }

    // Get the query parameters
    let nQuestions = req.query.n || test.quizzes.length;
    let randomizeOptions = req.query.rOpts === 'true';
    const randomizeQuestions = req.query.rQs === 'true';
    const sequentialQuestions = req.query.seq === 'true';

    // If test is a personality test, set randomizeOptions to true
    if (test.context === 'personality') {
      randomizeOptions = true;
    }

    // If nQuestions is not a number, set it to the number of quizzes in the test
    if (isNaN(nQuestions)) {
      nQuestions = test.quizzes.length;
    // If nQuestions is greater than the number of quizzes in the test, set it to the number of quizzes in the test
    } else if (nQuestions > test.quizzes.length) {
      nQuestions = test.quizzes.length;
    // If nQuestions is less than 5, set it to the number of quizzes in the test if it is smaller than 5, otherwise set it to 5
    } else if (nQuestions < 5) {
      nQuestions = Math.min(test.quizzes.length, 5);
    }

    // Get a list of the test quizzes ids
    const randomQuizIds = test.quizzes.map((quiz) => quiz.id);

    // Shuffle the indexes if randomizeQuestions is true
    if (randomizeQuestions) {
      randomQuizIds.sort(() => Math.random() - 0.5);
    }

    // Get the first nQuestions from the shuffled list
    randomQuizIds.splice(nQuestions);

    // Create a list for each quiz with randomized option indexes
    const randomQuizzesOpts = {};
    for (const quizId of randomQuizIds) {
      const quiz = test.quizzes.find((quiz) => quiz.id === quizId);
      const numberOfOptions = countNonEmptyOptions(quiz);
      const randomQuizOpts = Array.from(
        { length: numberOfOptions },
        (_, index) => index + 1
      );

      // Shuffle the option indexes if randomizeOptions is true
      if (randomizeOptions) {
        randomQuizOpts.sort(() => Math.random() - 0.5);
      }
      randomQuizzesOpts[quizId] = randomQuizOpts;
    }

    // Store the values in the session for use in the try.ejs template
    const resultQuizzes = test.quizzes.filter((quiz) => randomQuizIds.includes(quiz.id));
    // Delete stats attribute from quizzes
    resultQuizzes.forEach((quiz) => delete quiz.stats);
    const resultId = uuid.v4();
    const tryConfig = {
      testId: test.id,
      testType: test.type,
      metadataQuiz: test.metadataQuiz,
      quizzes: resultQuizzes,
      nQuestions,
      randomQuizIds,
      randomQuizzesOpts,
      sequentialQuestions,
    };
    // Add try config to the cache
    cacheCtrl.addTryConfigToCache(resultId, tryConfig);

    // SEO metadata: use the real quiz name so shared links and crawlers see meaningful previews
    res.locals.pageTitle = `Try: ${test.name} | WiseSloth.open`;
    res.locals.pageDescription = `Try page for WiseSloth.open: answer the questions, try to do your best in ${test.name}.`;
    // If ajax request, send json response
    if (req.query.ajax === 'true') return res.json({ renderedHTML: getRenderedTemplate(TRY_TEMPLATE_CONTENT, res.locals, { test, resultId, tryConfig }) });
    // Render the try.ejs template with the test and settings
    return res.render('tests/try.ejs', { test, resultId, tryConfig, minimalFooter: true });
  } catch (error) {
    //const errorMessage = "Error trying test: " + error.message;
    next(error, req, res);
  }
};

// GET /tests/:testUUID/
// Loads the test with its correct answers.
exports.showTest = async (req, res, next) => {
  const test = structuredClone(req.test);
  if (!req.session.user?.isAdmin && req.session.user?.id !== test.userId) {
    delete test.creationContent;
    delete test.creationGuidelines;
    delete test.creationData;
    test.context = '';
  }
  try {
    // SEO metadata: use the real quiz name/description so shared links and crawlers see meaningful previews
    res.locals.pageTitle = `${test.name} | WiseSloth.open`;
    res.locals.pageDescription = test.desc || `Test page for WiseSloth.open: details, result scoreboards and more in ${test.name}.`;

    // Flashcards: load the cards and render the study view
    if (test.type === 'flashcards') {
      test.flashcards = await loadFlashcards(test.id);
      // Reuse test.quizzes to show the card count in the shared test card partial
      test.quizzes = test.flashcards;
      if (req.query.ajax === 'true') return res.json({ renderedHTML: getRenderedTemplate(FLASHCARDS_TEMPLATE_CONTENT, res.locals, { test }) });
      return res.render('tests/flashcards.ejs', { test });
    }

    // If ajax request, send json response
    if (req.query.ajax === 'true') return res.json({ renderedHTML: getRenderedTemplate(SHOW_TEMPLATE_CONTENT, res.locals, { test }) });
    // Render the show view
    return res.render('tests/show.ejs', { test });
  } catch (error) {
    next(error, req, res);
  }
};

// GET /tests/:testUUID/edit
// Returns the form for editing the test.
exports.editTest = async (req, res, next) => {
  const test = req.test;
  try {
    // Flashcards: render the flashcard editor
    if (test.type === 'flashcards') {
      test.flashcards = await loadFlashcards(test.id);
      test.quizzes = test.flashcards;
      if (req.query.ajax === 'true') return res.json({ renderedHTML: getRenderedTemplate(FLASHCARDS_EDIT_TEMPLATE_CONTENT, res.locals, { test }) });
      return res.render('tests/edit-flashcards.ejs', { test, minimalFooter: true });
    }

    // If ajax request, send json response
    if (req.query.ajax === 'true') return res.json({ renderedHTML: getRenderedTemplate(EDIT_TEMPLATE_CONTENT, res.locals, { test }) });
    // Render the edit view
    return res.render('tests/edit.ejs', { test, minimalFooter: true });
  } catch (error) {
    next(error, req, res);
  }
};

// POST /api/tests/edit-quiz-ai
// Applies an AI edit to a single quiz question (returns edited fields for review)
exports.editQuizAI = async (req, res, _next) => {
  const { testId, quizId, instruction } = req.body;
  // Optional: current editor state of the question (overrides DB values so the AI
  // edits what the user currently sees in the modal, including unsaved changes)
  const quizPayload = req.body.quiz || {};
  const ssnUser = req.session.user;

  try {
    if (!testId || !quizId || !instruction) {
      return res.status(400).json({ success: false, error: 'testId, quizId and instruction parameters are required' });
    }
    if (typeof instruction !== 'string' || instruction.length > 500) {
      return res.status(400).json({ success: false, error: 'Instruction must be a string of at most 500 characters' });
    }

    // Require an existing signed-in account.
    const tokenCheck = await checkUserCanCreate(req, 'an AI edit');
    if (!tokenCheck.ok) {
      return res.status(tokenCheck.status).json({ success: false, error: tokenCheck.error });
    }

    // Load the quiz and test
    const quiz = await Quiz.findByPk(quizId);
    if (!quiz || quiz.testId !== testId) {
      return res.status(404).json({ success: false, error: 'Question not found' });
    }
    const test = await Test.findByPk(testId);
    if (!test) {
      return res.status(404).json({ success: false, error: 'Test not found' });
    }

    // Only the author or an admin can edit questions
    const isAuthor = test.userId === ssnUser.id;
    const isAdmin = !!ssnUser.isAdmin;
    if (!isAuthor && !isAdmin) {
      return res.status(403).json({ success: false, error: 'Only the author or an admin can edit this question' });
    }

    // Build the question payload in DB shape (prefer the current editor state)
    const question = mapQuizToAIQuestion({
      question: quizPayload.question || quiz.question,
      opt1: quizPayload.opt1 || quiz.opt1, opt2: quizPayload.opt2 || quiz.opt2,
      opt3: quizPayload.opt3 || quiz.opt3, opt4: quizPayload.opt4 || quiz.opt4,
      opt5: quizPayload.opt5 || quiz.opt5, opt6: quizPayload.opt6 || quiz.opt6,
      correct_opts: quizPayload.correct_opts || quiz.correct_opts,
    });

    // Call the FastAPI quiz-edit endpoint
    const formData = new FormData();
    formData.append('question', JSON.stringify(question));
    formData.append('instruction', instruction);
    formData.append('language', test.language || '');

    const response = await fetchAI(req, API_URL + 'tests/quiz-edit', {
      method: 'POST',
      body: formData,
    });
    const responseData = await response.json();
    if (responseData.browserAIPlan) return res.json(responseData);

    if (!responseData.success) {
      return res.status(400).json({ success: false, error: responseData.error });
    }

    // Map the LLM shape ({q, a..e, exp, correctOpts}) back to DB shape
    const content = responseData.completion.content;
    const updatedQuiz = mapAIQuestionToQuiz(content, question);

    // Return usage already recorded by the AI client.
    const usage = await recordAiUsage({
      user: tokenCheck.user,
      ssnUser,
      testId,
      action: 'quiz_edit',
      tokensUsed: responseData.completion.tokens,
      model: responseData.completion.model,
    });

    return res.json({ success: true, quiz: updatedQuiz, tokensUsed: usage.tokensUsed, costUsd: req.aiUsage?.costUsd || 0 });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, error: error.message });
    console.error('Error in editQuizAI:', error);
    return res.status(500).json({ success: false, error: 'Internal server error: ' + error });
  }
};

// POST /api/tests/edit-test-ai
// Applies a general, whole-test/deck AI edit (e.g. "add 2 more questions", "remove
// question 3", "change the description") and returns a PROPOSED diff for review.
// Nothing is written to the DB here - the user approves the diff via applyTestEditAI.
exports.editTestAI = async (req, res, _next) => {
  const { testId, instruction } = req.body;
  const ssnUser = req.session.user;

  try {
    if (!testId || !instruction) {
      return res.status(400).json({ success: false, error: 'testId and instruction parameters are required' });
    }
    if (typeof instruction !== 'string' || instruction.length > 500) {
      return res.status(400).json({ success: false, error: 'Instruction must be a string of at most 500 characters' });
    }

    // Require an existing signed-in account.
    const tokenCheck = await checkUserCanCreate(req, 'an AI edit');
    if (!tokenCheck.ok) {
      return res.status(tokenCheck.status).json({ success: false, error: tokenCheck.error });
    }

    const test = await Test.findByPk(testId);
    if (!test) {
      return res.status(404).json({ success: false, error: 'Test not found' });
    }
    if (test.type !== 'knowledge' && test.type !== 'flashcards') {
      return res.status(400).json({ success: false, error: 'General AI edit is only available for knowledge tests and flashcard decks' });
    }

    // Only the author or an admin can edit
    const isAuthor = test.userId === ssnUser.id;
    const isAdmin = !!ssnUser.isAdmin;
    if (!isAuthor && !isAdmin) {
      return res.status(403).json({ success: false, error: 'Only the author or an admin can edit this test' });
    }

    // Build the current items list (DB-shaped) to send as context, plus the instruction
    const formData = new FormData();
    formData.append('instruction', instruction);
    formData.append('language', test.language || '');
    formData.append('test_meta', JSON.stringify({ name: test.name, topic: test.topic, desc: test.desc }));

    let items;
    if (test.type === 'flashcards') {
      const cards = await Flashcard.findAll({ where: { testId }, order: [['number', 'ASC']] });
      items = cards.map((c) => ({ id: c.id, number: c.number, front: c.front, back: c.back }));
      formData.append('test_type', 'flashcards');
    } else {
      const quizzes = await Quiz.findAll({ where: { testId, number: { [Op.ne]: 0 } }, order: [['number', 'ASC']] });
      items = quizzes.map((q) => ({ id: q.id, number: q.number, ...mapQuizToAIQuestion(q) }));
      formData.append('test_type', 'knowledge');
    }
    formData.append('items', JSON.stringify(items));

    // A general edit can touch many items at once, so give it more time than the default timeout
    const response = await fetchAI(req, API_URL + 'tests/general-edit', {
      method: 'POST',
      body: formData,
    }, 90000);
    const responseData = await response.json();
    if (responseData.browserAIPlan) return res.json(responseData);

    if (!responseData.success) {
      return res.status(400).json({ success: false, error: responseData.error });
    }

    const content = responseData.completion.content;

    // Return usage already recorded by the AI client..
    // This is charged whether or not the user ends up applying the diff below - the AI
    // call itself already cost tokens.
    const usage = await recordAiUsage({
      user: tokenCheck.user,
      ssnUser,
      testId,
      action: 'test_edit',
      tokensUsed: responseData.completion.tokens,
      model: responseData.completion.model,
    });

    // Normalize into a review-friendly diff (added/updated items mapped back to DB shape
    // for knowledge tests; flashcards are already DB-shaped)
    let diff;
    if (test.type === 'flashcards') {
      diff = {
        testUpdates: content.test_updates || {},
        added: (content.cards_to_add || []).map((c) => ({ front: c.front || '', back: c.back || '' })),
        removedIds: content.cards_to_remove_ids || [],
        updated: (content.cards_to_update || []).map((c) => ({ id: c.id, front: c.front || '', back: c.back || '' })),
      };
    } else {
      diff = {
        testUpdates: content.test_updates || {},
        added: (content.quizzes_to_add || []).map((q) => mapAIQuestionToQuiz(q)),
        removedIds: content.quizzes_to_remove_ids || [],
        updated: (content.quizzes_to_update || []).map((q) => ({ id: q.id, ...mapAIQuestionToQuiz(q) })),
      };
    }

    return res.json({
      success: true,
      testType: test.type,
      summary: content.summary || '',
      diff,
      tokensUsed: usage.tokensUsed,
      costUsd: req.aiUsage?.costUsd || 0,
    });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, error: error.message });
    console.error('Error in editTestAI:', error);
    return res.status(500).json({ success: false, error: 'Internal server error: ' + error });
  }
};

// POST /api/tests/apply-test-edit-ai
// Applies a diff previously returned by editTestAI to the DB. Makes no AI call itself
// (and so has no token cost) - it purely persists what the user reviewed and approved.
exports.applyTestEditAI = async (req, res, _next) => {
  const { testId, diff } = req.body;
  const ssnUser = req.session.user;

  try {
    if (!ssnUser) {
      return res.status(401).json({ success: false, error: 'You must log in to apply this edit' });
    }
    if (!testId || !diff || typeof diff !== 'object') {
      return res.status(400).json({ success: false, error: 'testId and diff parameters are required' });
    }

    const test = await Test.findByPk(testId);
    if (!test) {
      return res.status(404).json({ success: false, error: 'Test not found' });
    }

    const isAuthor = test.userId === ssnUser.id;
    const isAdmin = !!ssnUser.isAdmin;
    if (!isAuthor && !isAdmin) {
      return res.status(403).json({ success: false, error: 'Only the author or an admin can edit this test' });
    }

    // Apply test-level metadata changes (only fields that actually changed)
    const testUpdates = diff.testUpdates || {};
    const testChanges = {};
    if (testUpdates.name && testUpdates.name !== test.name) testChanges.name = testUpdates.name;
    if (testUpdates.topic && testUpdates.topic !== test.topic) testChanges.topic = testUpdates.topic;
    if (testUpdates.desc && testUpdates.desc !== test.desc) testChanges.desc = testUpdates.desc;
    if (Object.keys(testChanges).length > 0) {
      await test.update(testChanges);
    }

    if (test.type === 'flashcards') {
      // Delete removed cards (scoped to this test, so a tampered id can't touch other tests)
      if (Array.isArray(diff.removedIds) && diff.removedIds.length > 0) {
        await Flashcard.destroy({ where: { id: { [Op.in]: diff.removedIds }, testId } });
      }
      // Update existing cards
      for (const card of (diff.updated || [])) {
        if (!card.id) continue;
        await Flashcard.update(
          { front: (card.front || '').trim(), back: (card.back || '').trim() },
          { where: { id: card.id, testId } }
        );
      }
      // Create new cards
      const newCards = (diff.added || []).filter((c) => c.front && c.back);
      if (newCards.length > 0) {
        await Flashcard.bulkCreate(newCards.map((c) => ({
          id: uuid.v4(), testId, userId: test.userId, number: 1,
          front: c.front.trim(), back: c.back.trim(), image_url: '',
        })));
      }
      // Renumber all remaining cards: existing ones keep their relative order (their
      // original createdAt), newly created ones land at the end
      const remaining = await Flashcard.findAll({ where: { testId }, order: [['createdAt', 'ASC']] });
      await Promise.all(remaining.map((c, i) => c.update({ number: i + 1 })));
    } else {
      // Delete removed quizzes (also cleans up any GCS image)
      if (Array.isArray(diff.removedIds) && diff.removedIds.length > 0) {
        for (const id of diff.removedIds) {
          const quiz = await Quiz.findByPk(id);
          if (quiz && quiz.testId === testId) await deleteQuiz(id);
        }
      }
      // Update existing quizzes
      for (const quiz of (diff.updated || [])) {
        if (!quiz.id) continue;
        await Quiz.update(
          {
            question: quiz.question, opt1: quiz.opt1, opt2: quiz.opt2, opt3: quiz.opt3,
            opt4: quiz.opt4, opt5: quiz.opt5, opt6: quiz.opt6, correct_opts: quiz.correct_opts,
          },
          { where: { id: quiz.id, testId } }
        );
      }
      // Create new quizzes
      const newQuizzes = (diff.added || []).filter((q) => q.question);
      if (newQuizzes.length > 0) {
        await Quiz.bulkCreate(newQuizzes.map((q) => ({
          id: uuid.v4(), testId, userId: test.userId, number: 1,
          question: q.question, opt1: q.opt1 || '', opt2: q.opt2 || '', opt3: q.opt3 || '',
          opt4: q.opt4 || '', opt5: q.opt5 || '', opt6: q.opt6 || '', correct_opts: q.correct_opts || '1',
        })));
      }
      // Renumber all remaining questions (skip the personality metadata quiz, number 0 -
      // not relevant here since general edit excludes personality tests, kept for safety)
      const remaining = await Quiz.findAll({ where: { testId, number: { [Op.ne]: 0 } }, order: [['createdAt', 'ASC']] });
      await Promise.all(remaining.map((q, i) => q.update({ number: i + 1 })));

      // Invalidate the in-memory quiz cache (showTest/editTest serve from it) - without
      // this the show/edit pages kept rendering the pre-edit quiz list (stale count vs.
      // actual DB rows) until the cache happened to be evicted or the process restarted.
      cacheCtrl.removeQuizzesFromCachedTest(testId);
    }

    // Invalidate the cached test record too if any metadata changed
    if (Object.keys(testChanges).length > 0) {
      cacheCtrl.removeTestFromCachedTest(testId);
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Error in applyTestEditAI:', error);
    return res.status(500).json({ success: false, error: 'Internal server error: ' + error });
  }
};

// PUT /api/tests/update-details
// API endpoint to update a user in the DB
exports.updateTestDetailsAPI = async (req, res, _next) => {
  const { id, name, topic, desc, context, hideAnswers, visibility } = req.body;

  // Validate the fields
  const errors = [];
  if (!name || !topic || !desc || !visibility) {
    errors.push('All fields are required.');
  }
  if (typeof hideAnswers !== 'boolean') {
    errors.push('The hideAnswers field must be a boolean.');
  }
  if (visibility !== 'public' && visibility !== 'private' && visibility !== 'followers') {
    errors.push('The visibility field must be either \'public\', \'private\', or \'followers\'.');
  }
  if (typeof name !== 'string' || name.length > 70) {
    errors.push('The name must be less than 70 characters.');
  }
  if (typeof topic !== 'string' || topic.length > 50) {
    errors.push('The topic must be less than 50 characters.');
  }
  if (typeof desc !== 'string' || desc.length > 500) {
    errors.push('The description must be less than 500 characters.');
  }
  if (context && (typeof context !== 'string' || context.length > 5000)) {
    errors.push('The context must be less than 5000 characters.');
  }

  if (errors.length > 0) {
    return res.json({ success: false, error: errors.join(' ') });
  }

  try {
    // Only the author or an admin can update the test details
    const ssnUser = req.session.user;
    const dbTest = await Test.findByPk(id);
    if (!dbTest) {
      return res.status(404).json({ success: false, error: 'Test not found' });
    }
    const isAuthor = ssnUser && dbTest.userId === ssnUser.id;
    const isAdmin = ssnUser && !!ssnUser.isAdmin;
    if (!isAuthor && !isAdmin) {
      return res.status(403).json({ success: false, error: 'Only the author or an admin can edit this test' });
    }

    // Update the test details
    await Test.update(
      { name, topic, desc, context, hideAnswers, visibility },
      { where: { id: id } }
    );

    // Remove the test from the cached test
    cacheCtrl.removeTestFromCachedTest(id);

    // Respond with a success message
    return res.json({ success: true });
  } catch (error) {
    // Respond with an error message
    return res.json({ success: false, error: error });
  }
};

// POST /api/tests/update-quizzes
// API endpoint to update a test object and its quizzes in the DB
exports.updateTestQuizzesAPI = async (req, res, _next) => {
  let { newQuizzesIds, changedQuizzesIds } = req.body;
  const { deletedQuizzesIds } = req.body;
  const { test } = req.body;
  const { quizzes } = test;

  try {
    // Only the author or an admin can edit the test's questions
    const ssnUser = req.session.user;
    const dbTest = await Test.findByPk(test.id);
    if (!dbTest) {
      return res.status(404).json({ success: false, error: 'Test not found' });
    }
    const isAuthor = ssnUser && dbTest.userId === ssnUser.id;
    const isAdmin = ssnUser && !!ssnUser.isAdmin;
    if (!isAuthor && !isAdmin) {
      return res.status(403).json({ success: false, error: 'Only the author or an admin can edit this test' });
    }
  } catch (error) {
    return res.status(500).json({ success: false, error: error });
  }

  // Debug logging
  console.log('Update quizzes request:');
  console.log('  newQuizzesIds:', newQuizzesIds);
  console.log('  changedQuizzesIds:', changedQuizzesIds);
  console.log('  deletedQuizzesIds:', deletedQuizzesIds);
  // Log image_url for each quiz
  quizzes.forEach(q => {
    if (q.image_url) console.log(`  Quiz ${q.id} has image_url: ${q.image_url}`);
  });

  // Remove elements from changedQuizzesIds that are present in newQuizzesIds
  changedQuizzesIds = changedQuizzesIds.filter(
    (changedQuizId) => !newQuizzesIds.includes(changedQuizId)
  );

  // Remove elements from changedQuizzesIds that are present in deletedQuizzesIds
  changedQuizzesIds = changedQuizzesIds.filter(
    (changedQuizId) => !deletedQuizzesIds.includes(changedQuizId)
  );

  // Remove elements from newQuizzesIds that are present in deletedQuizzesIds
  newQuizzesIds = newQuizzesIds.filter(
    (newQuizId) => !deletedQuizzesIds.includes(newQuizId)
  );

  try {
    // If any of the id lists is not empty, create or modify metadata quiz number 0
    if (newQuizzesIds.length > 0 || changedQuizzesIds.length > 0 || deletedQuizzesIds.length > 0) {
      // console.log("New quizzes:", newQuizzesIds);
      // console.log("Changed quizzes:", changedQuizzesIds);
      // console.log("Deleted quizzes:", deletedQuizzesIds);
      // Create or update the metadata quiz with id "metadata-" + test.id
      await Quiz.upsert({
        id: test.id,
        testId: test.id,
        userId: test.userId,
        number: 0,
        question: 'Metadata quiz',
        correct_opts: '1',
        opt1: 'Option A',
        opt2: 'Option B',
        opt3: '',
        opt4: '',
        opt5: '',
        opt6: '',
      });
    }

    // Parallelize database operations
    await Promise.all([
      // Loop through new quizzes and create them individually
      ...newQuizzesIds.map(async (quizId) => {
        const q = quizzes.find((quiz) => quiz.id === quizId);

        // Create a new quiz
        await Quiz.create({
          id: quizId,
          testId: test.id,
          userId: test.userId,
          number: q.number,
          question: q.question,
          correct_opts: q.correct_opts,
          image_url: q.image_url || '',
          opt1: q.opt1 || '',
          opt2: q.opt2 || '',
          opt3: q.opt3 || '',
          opt4: q.opt4 || '',
          opt5: q.opt5 || '',
          opt6: q.opt6 || '',
        });
      }),

      // Loop through changed quizzes and update them individually
      ...changedQuizzesIds.map(async (quizId) => {
        const q = quizzes.find((quiz) => quiz.id === quizId);
        // If only the number changed, use the same updatedAt date for the quiz
        let hasSameQuestionsAndOptions = false;
        let prevQuiz = null;
        if (q.number !== q.prevNumber) {
          // Check if any other field changed
          prevQuiz = await Quiz.findByPk(quizId);
          hasSameQuestionsAndOptions = ((prevQuiz.question === q.question) && (prevQuiz.correct_opts === q.correct_opts) &&
            (prevQuiz.opt1 === q.opt1) && (prevQuiz.opt2 === q.opt2) && (prevQuiz.opt3 === q.opt3) &&
            (prevQuiz.opt4 === q.opt4) && (prevQuiz.opt5 === q.opt5) && (prevQuiz.opt6 === q.opt6) && (prevQuiz.image_url === q.image_url)
          );
        }

        // Update the quiz directly with a where clause
        if (hasSameQuestionsAndOptions) {
          await Quiz.update({
            number: q.number,
          }, {
            where: { id: quizId },
            silent: true,
          });
        } else {
          await Quiz.update({
            number: q.number,
            question: q.question,
            correct_opts: q.correct_opts,
            image_url: q.image_url || '',
            opt1: q.opt1 || '',
            opt2: q.opt2 || '',
            opt3: q.opt3 || '',
            opt4: q.opt4 || '',
            opt5: q.opt5 || '',
            opt6: q.opt6 || '',
          }, {
            where: { id: quizId }
          });
        }
      }),

      // Loop through deleted quizzes and delete them individually
      ...deletedQuizzesIds.map(async (quizId) => {
        // console.log("Deleting quiz with id:", quizId);
        await deleteQuiz(quizId);
      }),
    ]);

    // Remove the test from the cache
    if (newQuizzesIds.length > 0 || changedQuizzesIds.length > 0 || deletedQuizzesIds.length > 0) {
      cacheCtrl.removeQuizzesFromCachedTest(test.id);
    }

    // Respond with a success message
    return res.json({ success: true });
  } catch (error) {
    // Respond with an error message
    return res.json({ success: false, error: error });
  }
};

// DELETE /tests/:testUUID
exports.deleteTest = async (req, res, _next) => {
  try {
    const testUUID = req.params.testUUID;

    // Delete the test and associated quizzes, test results, quiz results and flashcards
    await Promise.all([
      Test.destroy({ where: { id: testUUID } }),
      deleteQuizzesByTest(testUUID),
      Flashcard.destroy({ where: { testId: testUUID } }),
      TestResult.destroy({ where: { testId: testUUID } }),
      QuizResult.destroy({ where: { testId: testUUID } }),
    ]);

    // Remove the test from the cache
    cacheCtrl.removeTestFromCache(testUUID);

    return res.status(200).send('Test deleted successfully.');
  } catch (error) {
    const errorMessage = 'Error deleting the test: ' + error.message;
    return res.status(500).send(errorMessage);
  }
};
