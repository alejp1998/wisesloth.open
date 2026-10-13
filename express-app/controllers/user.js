'use strict';

// MODULES REQUIRED
const { Op, fn } = require('sequelize');

// MODELS
const { models } = require('../models');
const { User, Test, TestResult, QuizResult, Favorite, Follower } = models;

// HELPERS
const { paginate } = require('../helpers/paginate');
const { getVisibilityConditions } = require('../helpers/visibility-conditions');
const { loadTemplateContent, getRenderedTemplate } = require('../helpers/load-template-content');
const cacheCtrl = require('../helpers/cache');

// CONSTANTS
const INDEX_USER_TEMPLATE_CONTENT = loadTemplateContent('user-index');
const SHOW_USER_TEMPLATE_CONTENT = loadTemplateContent('user-show');
const USER_NOT_FOUND_TEMPLATE_CONTENT = loadTemplateContent('user-not-found');

// AUXILIARY FUNCTIONS
// Validate username function
async function validateUsername(username) {
  let usernameError = '';

  // Check if the username is between 3 and 15 characters long
  if (username.length < 3 || username.length > 15) {
    usernameError += 'Username must be between 3 and 15 characters long. ';
  }

  // Check if the username contains only alphanumeric characters and dashes
  const pattern = /^[a-z0-9-]+$/;
  if (!pattern.test(username)) {
    usernameError += 'Username can only contain lowercase letters, numbers, and dashes. ';
  }

  // Check if it already used by another user
  const user = await User.findOne({ where: { username: username } });
  if (user) {
    usernameError += 'Username already in use. ';
  }

  // Username should not contain words like deleted, admin, editor, etc.
  const forbiddenWords = ['temp', 'deleted', 'admin', 'editor', 'root', 'superuser', 'moderator', 'mod', 'administrator'];
  if (forbiddenWords.some((word) => username.includes(word))) {
    usernameError += 'Username cannot contain words like \'temp\', \'deleted\', \'admin\', \'editor\', \'root\', \'superuser\', etc. ';
  }

  // Check that username does not start or end with a dash
  if (username.startsWith('-') || username.endsWith('-')) {
    usernameError += 'Username cannot start or end with a dash. ';
  }

  // Check that username does not start with "t-" or "temp-" or "deleted-"
  if (username.startsWith('t-') || username.startsWith('temp-') || username.startsWith('deleted-')) {
    usernameError += 'Username cannot start with \'t-\', \'temp-\', or \'deleted-\'. ';
  }

  return usernameError;
}

// Build user stats dict
const buildUserStatsDict = (testResults) => {
  const statsDict = {
    nTries: testResults.length,
    nSeconds: 0,
    userHits: 0,
    userFails: 0,
    userOmissions: 0,
  };

  // Iterate through testResults
  testResults.forEach((testResult) => {
    // Skip personality test results (score === -1)
    if (testResult.score === -1) return;

    // Add time to nSeconds
    statsDict.nSeconds += testResult.nSeconds;

    // Add up totals
    statsDict.userHits += testResult.hits;
    statsDict.userFails += testResult.fails;
    statsDict.userOmissions += testResult.omissions;
  });

  return statsDict;
};

// Comparator function for sorting by date
function dateComparator(field) {
  return (a, b) => new Date(b[field].createdAt) - new Date(a[field].createdAt);
}

// Get sorted user data
async function getSortedUserData(username, ssnUser) {
  const isMyself = ssnUser && ssnUser.username === username;
  const isAdmin = ssnUser && ssnUser.isAdmin;

  // Initialize includeList
  const includeList = [
    {
      model: User,
      as: 'iFollow',
      attributes: ['username'],
      through: { attributes: ['createdAt'] },
    },
    {
      model: User,
      as: 'followMe',
      attributes: ['username'],
      through: { attributes: ['createdAt'] },
    },
  ];

  // Initialize testResultsIncludeList
  const testResultsIncludeList = [];

  // If user is myself, include favorite tests and test results
  if (isMyself || isAdmin) {
    includeList.push(
      {
        model: Test,
        as: 'favoriteTests',
        attributes: ['id', 'name'],
        through: { attributes: ['createdAt'] },
      },
    );

    // Add test data to testResultsIncludeList
    testResultsIncludeList.push({
      model: Test,
      as: 'test',
      attributes: ['id', 'name'],
    });
  }

  // Retrieve user data with includes from DB
  console.time('DB query');
  let user = await User.findOne({
    where: { username: username },
    include: includeList
  });
  // If the user was not found, return null
  if (!user) return null;
  // Remove unnecessary fields and metadata
  user = user.get ? user.get({ plain: true }) : user;
  console.timeEnd('DB query');

  // Get test results
  console.time('Test results query');
  let testResults = await TestResult.findAll({
    attributes: ['id', 'score', 'nQuestions', 'createdAt', 'nSeconds', 'hits', 'fails', 'omissions', 'updatedAt'],
    where: { userId: user.id },
    include: testResultsIncludeList
  });
  // Remove unnecessary fields and metadata
  testResults = testResults.map((testResult) => testResult.get({ plain: true }));
  // Attach test results to user object
  user.testResults = testResults;
  console.timeEnd('Test results query');

  // Get authored tests
  console.time('Authored tests query');
  user.authoredTests = await Test.findAll({
    attributes: ['id', 'name', 'visibility', 'createdAt'],
    where: {
      [Op.and]: [
        { userId: user.id },
        getVisibilityConditions(ssnUser)
      ]
    }
  });
  console.timeEnd('Authored tests query');

  // Get the length of each of the included lists
  user.authoredTestsCount = user.authoredTests.length;
  // Calculate number of authored tests that are public
  user.publicAuthoredTestsCount = user.authoredTests.filter((test) => test.visibility === 'public').length;
  user.iFollowCount = user.iFollow.length;
  user.followMeCount = user.followMe.length;

  // Pre-sort all the arrays
  console.time('Sorting arrays');
  user.iFollow.sort(dateComparator('followers'));
  user.followMe.sort(dateComparator('followers'));
  user.authoredTests.sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
  console.timeEnd('Sorting arrays');

  // Get only the first 5 elements of each list
  user.authoredTests = user.authoredTests.slice(0, 5);
  user.iFollow = user.iFollow.slice(0, 5);
  user.followMe = user.followMe.slice(0, 5);

  // Compute user stats
  console.time('Building user stats');
  user.stats = buildUserStatsDict(user.testResults);
  console.timeEnd('Building user stats');

  if (isMyself || isAdmin) {
    // Remove test results whose score is -1
    user.testResults = user.testResults.filter(result => result.score !== -1);
    // Remove test results whose test is null or undefined (deleted tests)
    user.testResults = user.testResults.filter(result => result.test !== null && result.test !== undefined);
    // Get favorite tests and test results
    user.favoriteTestsCount = user.favoriteTests.length;
    user.testResultsCount = user.testResults.length;

    // Pre-sort favorite tests and test results
    console.time('Sorting favorite tests and test results');
    user.favoriteTests.sort(dateComparator('favorites'));
    user.testResults.sort(
      (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
    );
    console.timeEnd('Sorting favorite tests and test results');

    // Get only the first 5 favorite tests and 10 test results
    user.favoriteTests = user.favoriteTests.slice(0, 5);
    user.testResults = user.testResults.slice(0, 10);
  }

  return user;
}

// Get users count (non-temporary ones)
exports.getUsersCount = async () => {
  try {
    // Get count of users that are not temporary and not containing the word "deleted-"
    return await User.count({
      where: {
        [Op.and]: [
          { username: { [Op.notLike]: '%deleted-%' } },
        ],
      },
    });
  } catch (error) {
    console.error('Error getting users count: ', error);
    return 0;
  }
};

// Get top 5 users with most authored tests
exports.getTopUsersByTests = async () => {
  try {
    // Get tests and count how many times each userId appears
    const testCounts = await Test.findAll({
      attributes: ['userId', [fn('COUNT', 'userId'), 'nTests']],
      group: ['userId'],
    });

    // Sort testCounts by nTests
    testCounts.sort((a, b) => b.dataValues.nTests - a.dataValues.nTests);

    // Get the top 20 userIds
    const topUserIds = testCounts.slice(0, 5).map((testCount) => testCount.dataValues.userId);

    // Get the subset of top users that are not temporary and not containing the word "deleted-"
    let users = await User.findAll({
      where: {
        [Op.and]: [
          { id: { [Op.in]: topUserIds } },
          { username: { [Op.notLike]: '%deleted-%' } },
        ],
      },
      attributes: ['id', 'username', 'name'],
    });

    // Limit each user object to just: username, nAuthoredTests
    users = users.map((user) => {
      return {
        username: user.username,
        nAuthoredTests: testCounts.find((testCount) => testCount.dataValues.userId === user.id).dataValues.nTests,
      };
    });

    // Sort users by number of authored tests
    users.sort((a, b) => b.nAuthoredTests - a.nAuthoredTests);

    // Return the top 5 users
    return users.slice(0, 5);
  } catch (error) {
    console.error('Error getting top users by tests: ', error);
    return [];
  }
};

// Get top 5 users with most public authored tests
exports.getTopUsersByPublicTests = async () => {
  try {
    // Get public tests and count how many times each userId appears
    const publicTestCounts = await Test.findAll({
      attributes: ['userId', [fn('COUNT', 'userId'), 'nPublicTests']],
      where: { visibility: 'public' },
      group: ['userId'],
    });

    // Sort publicTestCounts by nPublicTests
    publicTestCounts.sort((a, b) => b.dataValues.nPublicTests - a.dataValues.nPublicTests);

    // Get the top 20 userIds
    const topUserIds = publicTestCounts.slice(0, 20).map((publicTestCount) => publicTestCount.dataValues.userId);

    // Get the subset of top users that are not temporary and not containing the word "deleted-"
    let users = await User.findAll({
      where: {
        [Op.and]: [
          { id: { [Op.in]: topUserIds } },
          { username: { [Op.notLike]: '%deleted-%' } },
        ],
      },
      attributes: ['id', 'username', 'name'],
    });

    // Limit each user object to just: username, nPublicAuthoredTests
    users = users.map((user) => {
      return {
        username: user.username,
        nPublicTests: publicTestCounts.find((publicTestCount) => publicTestCount.dataValues.userId === user.id).dataValues.nPublicTests,
      };
    });

    // Sort users by number of public authored tests
    users.sort((a, b) => b.nPublicTests - a.nPublicTests);

    // Return the top 5 users
    return users.slice(0, 5);
  } catch (error) {
    console.error('Error getting top users by public tests: ', error);
    return [];
  }
};

// Get top 5 users with most test tries
exports.getTopUsersByTries = async () => {
  try {
    // Get test results and count how many times each userId appears
    const testResults = await TestResult.findAll({
      attributes: ['userId'],
    });

    // Create a dictionary to store the total number of test tries for each user
    const userTries = {};
    testResults.forEach((testResult) => {
      if (!userTries[testResult.userId]) {
        userTries[testResult.userId] = 0;
      }
      userTries[testResult.userId]++;
    });

    // Get the top 20 userIds
    const topUserIds = Object.keys(userTries).sort((a, b) => userTries[b] - userTries[a]).slice(0, 20);

    // Get the subset of top users that are not temporary and not containing the word "deleted-"
    let users = await User.findAll({
      where: {
        [Op.and]: [
          { id: { [Op.in]: topUserIds } },
          { username: { [Op.notLike]: '%deleted-%' } },
        ],
      },
      attributes: ['id', 'username', 'name'],
    });

    // Limit each user object to just: username, nTries
    users = users.map((user) => {
      return {
        username: user.username,
        nTries: testResults.filter((testResult) => testResult.userId === user.id).length,
      };
    });

    // Sort users by number of test tries
    users.sort((a, b) => b.nTries - a.nTries);

    // Return the top 5 users
    return users.slice(0, 5);
  } catch (error) {
    console.error('Error getting top users by tries: ', error);
    return [];
  }
};

// Get top 5 users with most time spent on tests
exports.getTopUsersByDuration = async () => {
  try {
    // Get test results with nSeconds and userId
    const testResults = await TestResult.findAll({
      attributes: ['userId', 'nSeconds'],
    });

    // Create a dictionary to store the total time spent on tests for each user
    const userDurations = {};
    testResults.forEach((testResult) => {
      if (!userDurations[testResult.userId]) {
        userDurations[testResult.userId] = 0;
      }
      userDurations[testResult.userId] += testResult.nSeconds;
    });

    // Get the top 20 userIds
    const topUserIds = Object.keys(userDurations).sort((a, b) => userDurations[b] - userDurations[a]).slice(0, 20);

    // Get the subset of top users that are not temporary and not containing the word "deleted-"
    let users = await User.findAll({
      where: {
        [Op.and]: [
          { id: { [Op.in]: topUserIds } },
          { username: { [Op.notLike]: '%deleted-%' } },
        ],
      },
      attributes: ['id', 'username', 'name'],
    });

    // Limit each user object to just: username, nSeconds
    users = users.map((user) => {
      return {
        username: user.username,
        nSeconds: user.testResults.reduce((acc, testResult) => acc + testResult.nSeconds, 0),
      };
    });

    // Sort users by nSeconds
    users.sort((a, b) => b.nSeconds - a.nSeconds);

    // Return the top 5 users
    return users.slice(0, 5);
  } catch (error) {
    console.error('Error getting top users by duration: ', error);
    return [];
  }
};

// Auto-load the user with id equals to :username
exports.load = async (req, res, next) => {
  // Load username params
  const username = req.params.username;
  const ssnUser = req.session.user;
  try {
    // Get sorted user data
    const user = await getSortedUserData(username, ssnUser);

    // Check if user was found
    if (!user) {
      // If it was an ajax request
      if (req.query.ajax) {
        const renderedHTML = getRenderedTemplate(USER_NOT_FOUND_TEMPLATE_CONTENT, res.locals);
        // Set the response status to 404 (Not Found)
        res.status(404);
        return res.json({ renderedHTML: renderedHTML });
      }
      // If it was a regular request
      // Set the response status to 404 (Not Found)
      res.status(404);
      return res.render('users/user-not-found.ejs');
    }

    // Save user data in req object
    req.user = user;
    next();
  } catch (error) {
    next(error, req, res);
  }
};

// GET /users
exports.index = async (req, res, next) => {
  try {
    console.time('Index execution time');

    let type = ['following', 'followers', 'supporters'].includes(req.query.type) ? req.query.type : 'all';
    const search = req.query.search || '';
    const orderby = ['date', 'tests', 'public', 'tries', 'duration'].includes(req.query.orderby) ? req.query.orderby : 'date';
    const orderdir = req.query.orderdir === 'asc' ? 'asc' : 'desc';
    let username = req.query.username || '';

    // Supporters filter is admin-only
    if (type === 'supporters' && (!req.session.user || !req.session.user.isAdmin)) {
      type = 'all';
    }

    // If type is following or followers, and username is not provided, use session user
    // (route-level gate keeps these types login-required; the guard is defense-in-depth)
    if (['following', 'followers'].includes(type) && !username && req.session.user) {
      username = req.session.user.username;
    }

    // Initialize indexUser
    const indexUser = req.session.user;

    // Initialize following and followers users' ids
    let usernameUser = null;
    let iFollowIds = [];
    let followMeIds = [];
    if (username) {
      usernameUser = await User.findOne({
        where: { username },
        include: [
          {
            model: User,
            as: 'iFollow', // Include followed users
            attributes: ['id'],
            through: { attributes: [] },
          },
          {
            model: User,
            as: 'followMe', // Include followers users
            attributes: ['id'],
            through: { attributes: [] },
          },
        ],
      });

      // If the username user is found
      if (usernameUser) {
        iFollowIds = usernameUser.iFollow.map((user) => user.id);
        followMeIds = usernameUser.followMe.map((user) => user.id);
      }
    } else if (!username && indexUser) {
      iFollowIds = indexUser.iFollowIds;
      followMeIds = indexUser.followMeIds;
    }

    // Initialize search conditions
    const conditions = [];

    // Do not show temporary users or deleted users to non-admins
    if (!indexUser || !indexUser.isAdmin) {
      conditions.push({
        [Op.and]: [
          { username: { [Op.notLike]: '%deleted-%' } },
        ],
      });
    }

    // Consider type for search results
    if (type === 'following') {
      // Add user's favorite tests to conditions
      conditions.push({ id: { [Op.in]: iFollowIds } });
    } else if (type === 'followers') {
      // Add user's followed users' tests to conditions
      conditions.push({ id: { [Op.in]: followMeIds } });

    }

    // Add search to conditions
    if (search) {
      // Normalize text by replacing spaces with %
      const searchLike = `%${search.toString().replace(/ +/g, '%')}%`;
      // Push to conditions
      conditions.push({
        [Op.or]: [
          { username: { [Op.like]: searchLike } },
          { name: { [Op.like]: searchLike } },
          { desc: { [Op.like]: searchLike } },
        ],
      });
    }

    // Initialize countOptions with conditions
    const countOptions = {
      where: { [Op.and]: conditions },
    };

    // Count number of users satisfying conditions
    console.time('Count users');
    const count = await User.count(countOptions);
    console.timeEnd('Count users');

    // Pagination
    const pageItems = 10;
    let pageNo = Number(req.query.pageno) || 1;
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

    // Initialize findOptions
    const findOptions = {};

    // Only select the fields the index view/cards render — never email,
    // ipAddress, birthDate, tokens etc. (defense-in-depth for the public route)
    findOptions.attributes = ['id', 'username', 'name', 'desc', 'isAdmin', 'isEditor', 'createdAt'];

    // Initialize paginatedUserIds
    let paginatedUserIds = [];
    if (orderby === 'date') {
      // Set findOptions where to countOptions where
      findOptions.where = countOptions.where;
      // Set other findOptions parameters
      findOptions.offset = pageItems * (pageNo - 1);
      findOptions.limit = pageItems;
      findOptions.order = [['createdAt', orderdir.toUpperCase()]];
    } else if (orderby === 'tests' || orderby === 'public') {
      // Build nquestions options
      const testsOptions = {
        ...countOptions,
        attributes: ['id'],
        include: [
          {
            model: Test,
            as: 'authoredTests',
            attributes: ['id', 'visibility'],
          },
        ]
      };
      // Get users with authored tests
      console.time('Get users with authored tests');
      const usersWithTests = await User.findAll(testsOptions);
      console.timeEnd('Get users with authored tests');
      if (orderby === 'tests') {
        // Sort tests by number of quizzes
        if (orderdir === 'asc') {
          usersWithTests.sort((a, b) => a.authoredTests.length - b.authoredTests.length);
        } else {
          usersWithTests.sort((a, b) => b.authoredTests.length - a.authoredTests.length);
        }
      } else if (orderby === 'public') {
        // Sort tests by number of public quizzes
        usersWithTests.sort((a, b) => {
          const publicTestsA = a.authoredTests.filter((test) => test.visibility === 'public').length;
          const publicTestsB = b.authoredTests.filter((test) => test.visibility === 'public').length;
          return orderdir === 'asc' ? publicTestsA - publicTestsB : publicTestsB - publicTestsA;
        });
      }
      // Get the ids of the sorted users
      const sortedUserIds = usersWithTests.map((user) => user.id);
      // Get subset of user ids from pagination offset and limit
      paginatedUserIds = sortedUserIds.slice(pageItems * (pageNo - 1), pageItems * pageNo);
      // Set findOptions where to user ids in paginatedUserIds
      findOptions.where = { id: { [Op.in]: paginatedUserIds } };
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
      // Get users with most test tries
      console.time('Get users with most test tries');
      const usersWithTestResults = await User.findAll(triesOptions);
      console.timeEnd('Get users with most test tries');
      // Sort users by number of test results
      if (orderdir === 'asc') {
        usersWithTestResults.sort((a, b) => a.testResults.length - b.testResults.length);
      } else {
        usersWithTestResults.sort((a, b) => b.testResults.length - a.testResults.length);
      }
      // Get the ids of the sorted users
      const sortedUserIds = usersWithTestResults.map((user) => user.id);
      // Get subset of user ids from pagination offset and limit
      paginatedUserIds = sortedUserIds.slice(pageItems * (pageNo - 1), pageItems * pageNo);
      // Set findOptions where to user ids in paginatedUserIds
      findOptions.where = { id: { [Op.in]: paginatedUserIds } };
    } else if (orderby === 'duration') {
      // Build nseconds options
      const durationOptions = {
        ...countOptions,
        attributes: ['id'],
        include: [
          {
            model: TestResult,
            as: 'testResults',
            attributes: ['id','nSeconds'],
          },
        ]
      };
      // Get users with most time spent on tests
      console.time('Get users with most time spent on tests');
      const usersWithTestResults = await User.findAll(durationOptions);
      console.timeEnd('Get users with most time spent on tests');
      // Sort users by sum of test results nSeconds
      usersWithTestResults.sort((a, b) => {
        const nSecondsA = a.testResults.reduce((acc, testResult) => acc + testResult.nSeconds, 0);
        const nSecondsB = b.testResults.reduce((acc, testResult) => acc + testResult.nSeconds, 0);
        return orderdir === 'asc' ? nSecondsA - nSecondsB : nSecondsB - nSecondsA;
      });
      // Get the ids of the sorted users
      const sortedUserIds = usersWithTestResults.map((user) => user.id);
      // Get subset of user ids from pagination offset and limit
      paginatedUserIds = sortedUserIds.slice(pageItems * (pageNo - 1), pageItems * pageNo);
      // Set findOptions where to user ids in paginatedUserIds
      findOptions.where = { id: { [Op.in]: paginatedUserIds } };
    }

    // Find subset of users for this page
    console.time('Find users');
    let users = await User.findAll(findOptions);
    // Remove unnecessary fields and metadata
    users = users.map((user) => user.get({ plain: true }));
    // If paginatedUserIds was empty, get the ids from the users
    if (paginatedUserIds.length === 0) {
      paginatedUserIds = users.map((user) => user.id);
    }
    console.timeEnd('Find users');

    // Get all test results with userId in paginatedUserIds
    console.time('Get test results for users');
    let testResults = await TestResult.findAll({
      where: { userId: { [Op.in]: paginatedUserIds } },
      attributes: ['id', 'userId', 'score', 'nQuestions', 'createdAt', 'nSeconds', 'hits', 'fails', 'omissions'],
    });

    // Remove unnecessary fields and metadata
    testResults = testResults.map((testResult) => testResult.get({ plain: true }));
    console.timeEnd('Get test results for users');

    // Get all authored tests with userId in paginatedUserIds
    console.time('Get authored tests for users');
    let authoredTests = await Test.findAll({
      where: { userId: { [Op.in]: paginatedUserIds } },
      attributes: ['id', 'userId', 'name', 'visibility', 'createdAt'],
    });

    // Remove unnecessary fields and metadata
    authoredTests = authoredTests.map((test) => test.get({ plain: true }));
    console.timeEnd('Get authored tests for users');

    // Attach test and results to users
    users.forEach((user) => {
      user.testResults = testResults.filter((testResult) => testResult.userId === user.id);
      user.authoredTests = authoredTests.filter((test) => test.userId === user.id);
    });

    // If paginatedUserIds is not empty, sort the users by the order of paginatedUserIds
    if (paginatedUserIds.length > 0) {
      users.sort((a, b) => paginatedUserIds.indexOf(a.id) - paginatedUserIds.indexOf(b.id));
    }

    // Compute user stats and authored tests count
    console.time('Compute user stats and authored tests count');
    users.forEach((user) => {
      user.stats = buildUserStatsDict(user.testResults);
      // Calculate number of authored tests
      user.authoredTestsCount = user.authoredTests.length;
      // Calculate number of authored tests that are public
      user.publicAuthoredTestsCount = user.authoredTests.filter((test) => test.visibility === 'public').length;
    });
    console.timeEnd('Compute user stats and authored tests count');

    // Create the data object to pass to the view
    const data = {
      type,
      users,
      username,
      search,
      orderby,
      orderdir,
    };

    // If ajax request, send json response
    console.timeEnd('Index execution time');
    if (req.query.ajax === 'true') {return res.json({
      renderedHTML: getRenderedTemplate(INDEX_USER_TEMPLATE_CONTENT, res.locals, data)
    });}
    // Render the index view
    res.render('users/index.ejs', data);
  } catch (error) {
    next(error, req, res);
  }
};

// GET /users/:username
exports.show = (req, res, next) => {
  try {
    const { user } = req;

    // SEO metadata: use the real username so shared profile links show meaningful previews
    res.locals.pageTitle = `${user.username}'s Profile | WiseSloth.open`;
    res.locals.pageDescription = `${user.username}'s Profile page for WiseSloth.open: authored tests, stats and more...`;

    // If ajax request, send json response
    if (req.query.ajax === 'true') return res.json({ renderedHTML: getRenderedTemplate(SHOW_USER_TEMPLATE_CONTENT, res.locals, { user }) });
    // Render the show view
    res.render('users/show.ejs', { user });
  } catch (error) {
    next(error, req, res);
  }
};

// PUT /api/users/update
// API endpoint to update a user in the DB
exports.updateUserAPI = async (req, res, _next) => {
  const oldUsername = req.body.oldUsername;
  const role = req.body.role;
  const username = req.body.username;
  const name = req.body.name;
  const desc = req.body.desc;

  const userIsHimself = oldUsername === req.session.user.username;
  const userIsAdmin = req.session.user.isAdmin;


  try {
    // Check if the user is an admin or the user themselves
    if (!userIsHimself && !userIsAdmin) {
      return res.status(403).json({ success: false, error: 'You are not authorized to update this user.' });
    }

    // Set new values for isAdmin and isEditor
    let isAdmin = false;
    let isEditor = false;
    if (role === 'admin' && userIsAdmin) {
      isAdmin = true;
      isEditor = true;
    } else if (role === 'editor' && userIsAdmin) {
      isAdmin = false;
      isEditor = true;
    }

    // Validate username if it was changed
    let usernameError = '';
    if (username !== oldUsername) {
      usernameError = await validateUsername(username);
    }

    // Validate name (must be under 50 characters)
    let nameError = '';
    if (name.length > 50) {
      nameError = 'Name must be under 50 characters long. ';
    }

    // Validate description (must be under 300 characters)
    let descError = '';
    if (desc.length > 300) {
      descError = 'Description must be under 300 characters long. ';
    }

    // If there are validations errors, respond with an error message
    const validationErrors = usernameError + nameError + descError;
    if (validationErrors !== '') {
      return res.status(200).json({
        success: false,
        error: validationErrors
      });
    }

    // Updated user dict
    const updatedUser = {
      username: username,
      name: name || '',
      desc: desc || '',
      ...(userIsAdmin ? { isAdmin, isEditor } : {}),
    };

    // Update user in DB with new values
    await User.update(updatedUser, { where: { username: oldUsername } });

    // Update session user
    if (req.session.user.username === oldUsername) {
      req.session.user.username = username;
      req.session.user.name = name;
      req.session.user.desc = desc;
      // Wait for any potential session store save to complete
      await new Promise((resolve) => req.session.save(resolve));
    }

    // Remove test from cached tests for the user id
    cacheCtrl.removeTestFromCachedTestWithAuthorUsername(oldUsername);

    // Respond with a success message and the updated user instance
    return res.status(200).json({ success: true });
  } catch (error) {
    // Check if the error is a Sequelize validation error
    if (error.name === 'SequelizeValidationError') {
      // Extract the validation errors
      const validationErrors = error.errors.map((err) => err.message);
      // Respond with an error message and the validation errors
      return res.status(400).json({ success: false, error: 'Validation error', validationErrors });
    }
    // Respond with a generic error message
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// DELETE /users/:username
exports.destroy = async (req, res, _next) => {
  try {
    const username = req.params.username;

    // Get user from DB and check if it exists
    const user = await User.findOne({ where: { username: username } });
    if (!user) {
      throw new Error(`No existing user with username=${username}`);
    }

    // Get user id from user
    const userId = user.id;
    const isAdmin = user.isAdmin;

    // If the user to be deleted is an admin, respond with an error message
    if (isAdmin) {
      return res.status(403).send('You cannot delete an admin user.');
    }

    // Deleting preloaded user from req object
    delete req.user;
    // Only set session user to null if it's the same user
    if (req.session.user.id === userId) {
      req.session.user = null;
      // Wait for any potential session store save to complete
      await new Promise((resolve) => req.session.save(resolve));
    }

    // Delete non-public authored tests
    await Test.destroy({
      where: {
        [Op.and]: [
          { userId: userId },
          { visibility: { [Op.not]: 'public' } },
        ],
      },
    });

    // Remove user tests and quiz results from DB
    await TestResult.destroy({ where: { userId: userId } });
    await QuizResult.destroy({ where: { userId: userId } });
    // Remove all tests from favorites
    await Favorite.destroy({ where: { userId: userId } });
    // Remove all followers and following
    await Follower.destroy({ where: { followerId: userId } });
    // await Follower.destroy({ where: { followedId: userId } });
    console.log(`User ${username} - non-public tests, results, favorites, and following deleted successfully.`);
    // Retain anonymized attribution for public quizzes and spending history.
    await user.update({
      username: 'deleted-' + username,
      name: 'Deleted User',
      desc: 'This user has been deleted.',
      passwordHash: null, apiKeyEncrypted: null, weeklyBudgetUsd: null, email: null, birthDate: null,
      isAdmin: false, isEditor: false,
    });
    console.log(`User ${username} updated successfully to deleted-${username}.`);

    // Delete cached tests by author id
    cacheCtrl.removeAllTestsFromCacheWithAuthorId(userId);

    return res.status(200).send('User deleted successfully.');
  } catch (error) {
    const errorMessage = 'Error deleting the user: ' + error.message;
    console.log(errorMessage);
    return res.status(500).send(errorMessage);
  }
};
