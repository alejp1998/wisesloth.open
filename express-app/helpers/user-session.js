// MODULES REQUIRED
const { Op } = require('sequelize');

// MODELS
const { models } = require('../models');
const { User, TestResult, Follower, Favorite } = models;

// HELPERS
const { nouns, adjectives } = require('./dictionaries.js');

// FUNCTION TO GENERATE A UNIQUE USERNAME
function generateUsername(separator) {
  // Get a ramdom adjective and noun
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const randomDigit1 = Math.floor(Math.random() * 10);
  const randomDigit2 = Math.floor(Math.random() * 10);
  // Concatenate the adjective and noun with the separator
  // And add two random digits at the end
  return adjective + separator + noun + randomDigit1 + randomDigit2;
}

// This helper function generates a unique username
function generateUniqueUsername() {
  const username = generateUsername('-');
  // Modify generated username to be under 15 characters
  // by slicing it to 13 characters and adding two random digits
  // username = username.slice(0, 13) + Math.floor(Math.random() * 10) + Math.floor(Math.random() * 10);
  // Check if the username already exists
  return User.findOne({
    where: {
      [Op.or]: [
        { username: username },
        { username: 't-' + username },
        { username: 'temp-' + username },
        { username: 'deleted-' + username }
      ]
    }
  // If the username already exists, generate a new one recursively
  }).then((user) => {
    if (user) {
      return generateUniqueUsername();
    } else {
      return username;
    }
  });
}

// Refresh session user data
async function genSsnUserData(user) {
  try {
    // Otherwise update user to match DB data and include followed users and favorite tests
    console.time('Fetching logged in user from DB');
    const refreshedUser = await User.findByPk(user.id);
    console.timeEnd('Fetching logged in user from DB');

    // Get user's favorite tests from DB
    console.time('Fetching favorite tests from DB');
    const favoriteTests = await Favorite.findAll({
      where: { userId: refreshedUser.id },
      attributes: ['testId'],
    });
    console.timeEnd('Fetching favorite tests from DB');

    // Get user's test results from DB
    console.time('Fetching test results from DB');
    const testResults = await TestResult.findAll({
      where: { userId: refreshedUser.id },
      attributes: ['testId'],
    });
    console.timeEnd('Fetching test results from DB');

    // Get user's followed users from DB
    console.time('Fetching followed users from DB');
    const iFollow = await Follower.findAll({
      where: { followerId: refreshedUser.id },
      attributes: ['followedId'],
    });
    // Get usernames of followed users from user table
    const iFollowUsers = await User.findAll({
      where: { id: iFollow.map((follow) => follow.followedId) },
      attributes: ['id', 'username'],
    });
    console.timeEnd('Fetching followed users from DB');

    // Get user's followers from DB
    console.time('Fetching followers from DB');
    const followMe = await Follower.findAll({
      where: { followedId: refreshedUser.id },
      attributes: ['followerId'],
    });
    // Get usernames of followers from user table
    const followMeUsers = await User.findAll({
      where: { id: followMe.map((follow) => follow.followerId) },
      attributes: ['id', 'username'],
    });
    console.timeEnd('Fetching followers from DB');

    // Build user favorites ids, followed and followers ids and usernames
    console.time('Building user session data');
    const favoriteIds = favoriteTests.map((favorite) => favorite.testId);
    const iFollowIds = iFollowUsers.map((user) => user.id);
    const followMeIds = followMeUsers.map((user) => user.id);
    const iFollowUsernames = iFollowUsers.map((user) => user.username);
    const followMeUsernames = followMeUsers.map((user) => user.username);

    // Build list of tried ids with unique testId values on testResults
    const triedIds = [];
    testResults.forEach((result) => {
      if (!triedIds.includes(result.testId)) {
        triedIds.push(result.testId);
      }
    });
    console.timeEnd('Building user session data');

    // Return refreshed user session data
    return {
      id: refreshedUser.id,
      username: refreshedUser.username,
      favoriteIds: favoriteIds,
      triedIds: triedIds,
      iFollowIds: iFollowIds,
      followMeIds: followMeIds,
      iFollowUsernames: iFollowUsernames,
      followMeUsernames: followMeUsernames,
      isAdmin: refreshedUser.isAdmin,
      isEditor: refreshedUser.isEditor,
      createdAt: refreshedUser.createdAt,
    };
  } catch (error) {
    console.error('Error refreshing user session data:', error);
  }
}

exports.generateUniqueUsername = generateUniqueUsername;
exports.genSsnUserData = genSsnUserData;
