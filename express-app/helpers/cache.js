// CONSTANTS
const MAX_N_CACHED_TESTS = 100;
const MAX_N_CACHED_TRY_CONFIGS = 1000;

// AUXILIARY VARIABLES
let cachedTests = {};
const cachedTryConfigs = {};

// AUXILIARY FUNCTIONS

// Check if a test is in the cache
const isTestInCache = (testId) => {
  return testId in cachedTests;
};

// Add a test to the cache
const addTestToCache = (test) => {
  // If the cache is full, remove the oldest test
  if (Object.keys(cachedTests).length >= MAX_N_CACHED_TESTS) {
    removeTestFromCache(Object.keys(cachedTests)[0]);
  }

  // Check if test exists
  if (cachedTests[test.id]) {
    // Replace just test data
    cachedTests[test.id].test = test;
    cachedTests[test.id].authorId = test.author.id;
    cachedTests[test.id].authorUsername = test.author.username;
    return;
  }

  // Add test to cache
  cachedTests[test.id] = {
    id: test.id,
    authorId: test.author.id,
    authorUsername: test.author.username,
    test: test,
    quizzes: null,
    testResults: null,
    quizResults: null,
  };
};

// Get a test from the cache
const getTestFromCache = (testId) => {
  // Check if test exists
  if (!cachedTests[testId]) {
    return null;
  }
  // Return a copy of cached test
  return cachedTests[testId];
};

// Remove a test from the cache
const removeTestFromCache = (testId) => {
  // Remove test
  delete cachedTests[testId];
};

// Remove test from cached test from the cache for a given authorId
const removeTestFromCachedTestWithAuthorId = (authorId) => {
  for (const testId in cachedTests) {
    if (cachedTests[testId].authorId === authorId) {
      removeTestFromCachedTest(testId);
    }
  }
};

// Remove test from cached test from the cache for a given authorUsername
const removeTestFromCachedTestWithAuthorUsername = (authorUsername) => {
  for (const testId in cachedTests) {
    if (cachedTests[testId].authorUsername === authorUsername) {
      removeTestFromCachedTest(testId);
    }
  }
};

// Remove all tests from the cache with an authorId
const removeAllTestsFromCacheWithAuthorId = (authorId) => {
  for (const testId in cachedTests) {
    if (cachedTests[testId].authorId === authorId) {
      removeTestFromCache(testId);
    }
  }
};

// Remove all tests from the cache with an authorId
const removeAllTestsFromCacheWithAuthorUsername = (authorUsername) => {
  for (const testId in cachedTests) {
    if (cachedTests[testId].authorUsername === authorUsername) {
      removeTestFromCache(testId);
    }
  }
};

// Remove all tests from the cache
const removeAllTestsFromCache = () => {
  cachedTests = {};
};

// Get test from cached test
const getTestFromCachedTest = (testId) => {
  const cachedTest = getTestFromCache(testId);
  // Check if test exists
  if (!cachedTest) {
    return null;
  }
  // Return copy of test
  const test = structuredClone(cachedTest.test);
  return test;
};

// Remove test from cached test
const removeTestFromCachedTest = (testId) => {
  const cachedTest = getTestFromCache(testId);
  // Check if test exists
  if (!cachedTest) {
    return;
  }
  // Remove test
  cachedTest.test = null;
};

// Add quizzes to cached test
const addQuizzesToCachedTest = (testId, quizzes) => {
  const cachedTest = getTestFromCache(testId);
  // Check if test exists
  if (!cachedTest) {
    return;
  }
  // Add test to cache
  cachedTest.quizzes = quizzes;
};

// Get quizzes from cached test
const getQuizzesFromCachedTest = (testId) => {
  const cachedTest = getTestFromCache(testId);
  // Check if test exists
  if (!cachedTest) {
    return null;
  }
  // Return a copy of cached test quizzes
  const quizzes = structuredClone(cachedTest.quizzes);
  return quizzes;
};

// Remove quizzes from cached test
const removeQuizzesFromCachedTest = (testId) => {
  const cachedTest = getTestFromCache(testId);
  // Check if test exists
  if (!cachedTest) {
    return;
  }
  // Remove quizzes
  cachedTest.quizzes = null;
};

// Add test results to cached test
const addTestResultsToCachedTest = (testId, testResults) => {
  const cachedTest = getTestFromCache(testId);
  // Check if test exists
  if (!cachedTest) {
    return;
  }
  // Add test to cache
  cachedTest.testResults = testResults;
};

// Get test results from cached test
const getTestResultsFromCachedTest = (testId) => {
  const cachedTest = getTestFromCache(testId);
  // Check if test exists
  if (!cachedTest) {
    return null;
  }
  // Return a copy of cached test results
  const testResults = structuredClone(cachedTest.testResults);
  return testResults;
};

// Remove test results from cached test
const removeTestResultsFromCachedTest = (testId) => {
  const cachedTest = getTestFromCache(testId);
  // Check if test exists
  if (!cachedTest) {
    return;
  }
  // Remove test results
  cachedTest.testResults = null;
};

// Add quiz results to cached test
const addQuizResultsToCachedTest = (testId, quizResults) => {
  const cachedTest = getTestFromCache(testId);
  // Check if test exists
  if (!cachedTest) {
    return;
  }
  // Add test to cache
  cachedTest.quizResults = quizResults;
};

// Get quiz results from cached test
const getQuizResultsFromCachedTest = (testId) => {
  const cachedTest = getTestFromCache(testId);
  // Check if test exists
  if (!cachedTest) {
    return null;
  }
  // Return a copy of cached quiz results
  const quizResults = structuredClone(cachedTest.quizResults);
  return quizResults;
};

// Remove quiz results from cached test
const removeQuizResultsFromCachedTest = (testId) => {
  const cachedTest = getTestFromCache(testId);
  // Check if test exists
  if (!cachedTest) {
    return;
  }
  // Remove quiz results
  cachedTest.quizResults = null;
};

// Check if try config is in cache
const isTryConfigInCache = (resultId) => {
  return resultId in cachedTryConfigs;
};

// Remove try config from cache
const removeTryConfigFromCache = (resultId) => {
  delete cachedTryConfigs[resultId];
};

// Remove try configs from cache created more than 6h ago
const removeOldTryConfigsFromCache = () => {
  // Remove old try configs
  for (const resultId in cachedTryConfigs) {
    if (Date.now() - cachedTryConfigs[resultId].createdAt > 6 * 60 * 60 * 1000) {
      removeTryConfigFromCache(resultId);
    }
  }
  // If still over MAX_N_CACHED_TRY_CONFIGS, remove the oldest
  if (Object.keys(cachedTryConfigs).length > MAX_N_CACHED_TRY_CONFIGS) {
    const oldestResultId = Object.keys(cachedTryConfigs).sort((a, b) => cachedTryConfigs[a].createdAt - cachedTryConfigs[b].createdAt)[0];
    removeTryConfigFromCache(oldestResultId);
  }
};

// Add a tryConfig to the cache
const addTryConfigToCache = (resultId, tryConfig) => {
  // Remove old try configs from cache
  removeOldTryConfigsFromCache();
  // Add try config
  cachedTryConfigs[resultId] = {
    createdAt: Date.now(),
    userId: null,
    tryConfig: tryConfig,
  };
};

// Set tryConfig user id
const setTryConfigUserId = (resultId, userId) => {
  // Check if try config exists
  if (!isTryConfigInCache(resultId)) {
    return;
  }
  // Set user id
  cachedTryConfigs[resultId].userId = userId;
};

// Get a try config from the cache
const getTryConfigFromCache = (resultId, userId) => {
  // Check if try config exists
  if (!isTryConfigInCache(resultId)) {
    return null;
  }
  // Check if user id matches
  if (cachedTryConfigs[resultId].userId && (cachedTryConfigs[resultId].userId !== userId)) {
    return null;
  }
  // Get copy of tryConfig
  const tryConfig = structuredClone(cachedTryConfigs[resultId].tryConfig);
  return tryConfig;
};

module.exports = {
  isTestInCache,
  addTestToCache,
  getTestFromCache,
  removeTestFromCache,
  removeTestFromCachedTestWithAuthorId,
  removeTestFromCachedTestWithAuthorUsername,
  removeAllTestsFromCacheWithAuthorId,
  removeAllTestsFromCacheWithAuthorUsername,
  removeAllTestsFromCache,
  getTestFromCachedTest,
  removeTestFromCachedTest,
  addQuizzesToCachedTest,
  getQuizzesFromCachedTest,
  removeQuizzesFromCachedTest,
  addTestResultsToCachedTest,
  getTestResultsFromCachedTest,
  removeTestResultsFromCachedTest,
  addQuizResultsToCachedTest,
  getQuizResultsFromCachedTest,
  removeQuizResultsFromCachedTest,
  isTryConfigInCache,
  removeTryConfigFromCache,
  removeOldTryConfigsFromCache,
  addTryConfigToCache,
  setTryConfigUserId,
  getTryConfigFromCache,
};
