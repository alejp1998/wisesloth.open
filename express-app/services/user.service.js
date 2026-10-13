/**
 * User Service Module
 * Business logic for user-related operations
 */

'use strict';

const { Op, fn } = require('sequelize');
const { models } = require('../models');
const { User, Test, TestResult, QuizResult, Favorite, Follower } = models;
const { getVisibilityConditions } = require('../helpers/visibility-conditions');

/**
 * Build user statistics from test results
 * @param {Array} testResults - Array of test result objects
 * @returns {Object} Statistics object
 */
function buildUserStatsDict(testResults) {
  const stats = {
    nTries: testResults.length,
    nSeconds: 0,
    userHits: 0,
    userFails: 0,
    userOmissions: 0,
  };

  testResults.forEach((testResult) => {
    // Skip personality test results (score === -1)
    if (testResult.score === -1) return;

    stats.nSeconds += testResult.nSeconds || 0;
    stats.userHits += testResult.hits || 0;
    stats.userFails += testResult.fails || 0;
    stats.userOmissions += testResult.omissions || 0;
  });

  return stats;
}

/**
 * Comparator function for sorting by date field
 * @param {string} field - Field name containing the date
 * @returns {Function} Comparator function
 */
function dateComparator(field) {
  return (a, b) => new Date(b[field].createdAt) - new Date(a[field].createdAt);
}

/**
 * Get non-deleted, non-temporary user conditions
 * @param {boolean} isAdmin - Whether requesting user is admin
 * @returns {Object} Sequelize conditions
 */
function getActiveUserConditions(isAdmin = false) {
  if (isAdmin) return {};

  return {
    [Op.and]: [
      { username: { [Op.notLike]: '%deleted-%' } },
    ],
  };
}

/**
 * Get sorted user data with related entities
 * @param {string} username - Username to fetch
 * @param {Object} sessionUser - Current session user
 * @returns {Promise<Object|null>} User data or null if not found
 */
async function getSortedUserData(username, sessionUser) {
  const isMyself = sessionUser && sessionUser.username === username;
  const isAdmin = sessionUser && sessionUser.isAdmin;

  // Build includes based on permissions
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

  const testResultsIncludeList = [];

  if (isMyself || isAdmin) {
    includeList.push({
      model: Test,
      as: 'favoriteTests',
      attributes: ['id', 'name'],
      through: { attributes: ['createdAt'] },
    });

    testResultsIncludeList.push({
      model: Test,
      as: 'test',
      attributes: ['id', 'name'],
    });
  }

  // Fetch user data
  let user = await User.findOne({
    where: { username },
    include: includeList
  });

  if (!user) return null;

  user = user.get ? user.get({ plain: true }) : user;

  // Fetch test results
  let testResults = await TestResult.findAll({
    attributes: ['id', 'score', 'nQuestions', 'createdAt', 'nSeconds', 'hits', 'fails', 'omissions', 'updatedAt'],
    where: { userId: user.id },
    include: testResultsIncludeList
  });

  testResults = testResults.map((tr) => tr.get({ plain: true }));
  user.testResults = testResults;

  // Fetch authored tests with visibility check
  user.authoredTests = await Test.findAll({
    attributes: ['id', 'name', 'visibility', 'createdAt'],
    where: {
      [Op.and]: [
        { userId: user.id },
        getVisibilityConditions(sessionUser)
      ]
    }
  });

  // Compute counts
  user.authoredTestsCount = user.authoredTests.length;
  user.publicAuthoredTestsCount = user.authoredTests.filter((test) => test.visibility === 'public').length;
  user.iFollowCount = user.iFollow.length;
  user.followMeCount = user.followMe.length;

  // Sort arrays
  user.iFollow.sort(dateComparator('followers'));
  user.followMe.sort(dateComparator('followers'));
  user.authoredTests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Limit to first 5
  user.authoredTests = user.authoredTests.slice(0, 5);
  user.iFollow = user.iFollow.slice(0, 5);
  user.followMe = user.followMe.slice(0, 5);

  // Build stats
  user.stats = buildUserStatsDict(user.testResults);

  if (isMyself || isAdmin) {
    // Filter out invalid results
    user.testResults = user.testResults.filter(
      result => result.score !== -1 && result.test !== null && result.test !== undefined
    );

    user.favoriteTestsCount = user.favoriteTests.length;
    user.testResultsCount = user.testResults.length;

    user.favoriteTests.sort(dateComparator('favorites'));
    user.testResults.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    user.favoriteTests = user.favoriteTests.slice(0, 5);
    user.testResults = user.testResults.slice(0, 10);
  }

  return user;
}

/**
 * Get count of active (non-temporary, non-deleted) users
 * @returns {Promise<number>} User count
 */
async function getUsersCount() {
  try {
    return await User.count({
      where: getActiveUserConditions(false),
    });
  } catch (error) {
    console.error('Error getting users count:', error);
    return 0;
  }
}

/**
 * Get top users by number of authored tests
 * @param {number} limit - Maximum number of users to return
 * @returns {Promise<Array>} Array of top users
 */
async function getTopUsersByTests(limit = 5) {
  try {
    const testCounts = await Test.findAll({
      attributes: ['userId', [fn('COUNT', 'userId'), 'nTests']],
      group: ['userId'],
    });

    testCounts.sort((a, b) => b.dataValues.nTests - a.dataValues.nTests);
    const topUserIds = testCounts.slice(0, limit * 4).map((tc) => tc.dataValues.userId);

    let users = await User.findAll({
      where: {
        [Op.and]: [
          { id: { [Op.in]: topUserIds } },
          getActiveUserConditions(false),
        ],
      },
      attributes: ['id', 'username', 'name'],
    });

    users = users.map((user) => ({
      username: user.username,
      nAuthoredTests: testCounts.find((tc) => tc.dataValues.userId === user.id)?.dataValues.nTests || 0,
    }));

    users.sort((a, b) => b.nAuthoredTests - a.nAuthoredTests);
    return users.slice(0, limit);
  } catch (error) {
    console.error('Error getting top users by tests:', error);
    return [];
  }
}

/**
 * Get top users by number of public authored tests
 * @param {number} limit - Maximum number of users to return
 * @returns {Promise<Array>} Array of top users
 */
async function getTopUsersByPublicTests(limit = 5) {
  try {
    const publicTestCounts = await Test.findAll({
      attributes: ['userId', [fn('COUNT', 'userId'), 'nPublicTests']],
      where: { visibility: 'public' },
      group: ['userId'],
    });

    publicTestCounts.sort((a, b) => b.dataValues.nPublicTests - a.dataValues.nPublicTests);
    const topUserIds = publicTestCounts.slice(0, limit * 4).map((ptc) => ptc.dataValues.userId);

    let users = await User.findAll({
      where: {
        [Op.and]: [
          { id: { [Op.in]: topUserIds } },
          getActiveUserConditions(false),
        ],
      },
      attributes: ['id', 'username', 'name'],
    });

    users = users.map((user) => ({
      username: user.username,
      nPublicTests: publicTestCounts.find((ptc) => ptc.dataValues.userId === user.id)?.dataValues.nPublicTests || 0,
    }));

    users.sort((a, b) => b.nPublicTests - a.nPublicTests);
    return users.slice(0, limit);
  } catch (error) {
    console.error('Error getting top users by public tests:', error);
    return [];
  }
}

/**
 * Get top users by number of test attempts
 * @param {number} limit - Maximum number of users to return
 * @returns {Promise<Array>} Array of top users
 */
async function getTopUsersByTries(limit = 5) {
  try {
    const testResults = await TestResult.findAll({
      attributes: ['userId'],
    });

    const userTries = {};
    testResults.forEach((tr) => {
      userTries[tr.userId] = (userTries[tr.userId] || 0) + 1;
    });

    const topUserIds = Object.keys(userTries)
      .sort((a, b) => userTries[b] - userTries[a])
      .slice(0, limit * 4);

    let users = await User.findAll({
      where: {
        [Op.and]: [
          { id: { [Op.in]: topUserIds } },
          getActiveUserConditions(false),
        ],
      },
      attributes: ['id', 'username', 'name'],
    });

    users = users.map((user) => ({
      username: user.username,
      nTries: userTries[user.id] || 0,
    }));

    users.sort((a, b) => b.nTries - a.nTries);
    return users.slice(0, limit);
  } catch (error) {
    console.error('Error getting top users by tries:', error);
    return [];
  }
}

/**
 * Get top users by time spent on tests
 * @param {number} limit - Maximum number of users to return
 * @returns {Promise<Array>} Array of top users
 */
async function getTopUsersByDuration(limit = 5) {
  try {
    const testResults = await TestResult.findAll({
      attributes: ['userId', 'nSeconds'],
    });

    const userDurations = {};
    testResults.forEach((tr) => {
      userDurations[tr.userId] = (userDurations[tr.userId] || 0) + (tr.nSeconds || 0);
    });

    const topUserIds = Object.keys(userDurations)
      .sort((a, b) => userDurations[b] - userDurations[a])
      .slice(0, limit * 4);

    let users = await User.findAll({
      where: {
        [Op.and]: [
          { id: { [Op.in]: topUserIds } },
          getActiveUserConditions(false),
        ],
      },
      attributes: ['id', 'username', 'name'],
    });

    users = users.map((user) => ({
      username: user.username,
      nSeconds: userDurations[user.id] || 0,
    }));

    users.sort((a, b) => b.nSeconds - a.nSeconds);
    return users.slice(0, limit);
  } catch (error) {
    console.error('Error getting top users by duration:', error);
    return [];
  }
}

/**
 * Update user profile
 * @param {string} username - Username to update
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} Updated user
 */
async function updateUser(username, updateData) {
  const allowedFields = ['username', 'name', 'desc', 'isAdmin', 'isEditor'];
  const filteredData = {};

  for (const field of allowedFields) {
    if (updateData[field] !== undefined) {
      filteredData[field] = updateData[field];
    }
  }

  await User.update(filteredData, { where: { username } });
  return User.findOne({ where: { username: filteredData.username || username } });
}

/**
 * Soft delete a user (mark as deleted)
 * @param {string} username - Username to delete
 * @returns {Promise<Object>} Result of deletion
 */
async function softDeleteUser(username) {
  const user = await User.findOne({ where: { username } });

  if (!user) {
    throw new Error(`No existing user with username=${username}`);
  }

  if (user.isAdmin) {
    throw new Error('Cannot delete an admin user');
  }

  const userId = user.id;

  // Delete non-public authored tests
  await Test.destroy({
    where: {
      [Op.and]: [
        { userId },
        { visibility: { [Op.not]: 'public' } },
      ],
    },
  });

  // Remove user's results
  await TestResult.destroy({ where: { userId } });
  await QuizResult.destroy({ where: { userId } });

  // Remove favorites and follows
  await Favorite.destroy({ where: { userId } });
  await Follower.destroy({ where: { followerId: userId } });

  // Mark user as deleted
  await user.update({
    username: `deleted-${username}`,
    name: 'Deleted User',
    desc: 'This user has been deleted.',
  });

  return { userId, deletedUsername: `deleted-${username}` };
}

/**
 * Get user's followers and following IDs
 * @param {string} username - Username to fetch relations for
 * @returns {Promise<Object>} Object with iFollowIds and followMeIds
 */
async function getUserFollowRelations(username) {
  const user = await User.findOne({
    where: { username },
    include: [
      {
        model: User,
        as: 'iFollow',
        attributes: ['id'],
        through: { attributes: [] },
      },
      {
        model: User,
        as: 'followMe',
        attributes: ['id'],
        through: { attributes: [] },
      },
    ],
  });

  if (!user) {
    return { iFollowIds: [], followMeIds: [] };
  }

  return {
    iFollowIds: user.iFollow.map((u) => u.id),
    followMeIds: user.followMe.map((u) => u.id),
  };
}

module.exports = {
  buildUserStatsDict,
  dateComparator,
  getActiveUserConditions,
  getSortedUserData,
  getUsersCount,
  getTopUsersByTests,
  getTopUsersByPublicTests,
  getTopUsersByTries,
  getTopUsersByDuration,
  updateUser,
  softDeleteUser,
  getUserFollowRelations,
};
