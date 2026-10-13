'use strict';

// HELPERS

const { loadTemplateContent, getRenderedTemplate } = require('../helpers/load-template-content');
const { models: { Test } } = require('../models');
const { canReadTest } = require('../helpers/test-access');

// CONSTANTS
const LOBBY_TEMPLATE_CONTENT = loadTemplateContent('livebattle-lobby');
const LIVEBATTLE_NOT_FOUND_TEMPLATE_CONTENT = loadTemplateContent('livebattle-not-found');

const MIN_N_PLAYERS = 2;
const MAX_N_PLAYERS = 100;
const COUNTDOWN_SECONDS = 10;
const SHOW_NEW_SCORES_SECONDS = 10;
const QUESTION_SECONDS = 30;
const MIN_QUESTION_SECONDS = 20;
const MAX_QUESTION_SECONDS = 90;
const MAX_INACTIVE_SECONDS = QUESTION_SECONDS * 1.5;

// AUXILIARY VARIABLES
const activeLiveBattles = {};

// AUXILIARY FUNCTIONS

// Count non-empty quiz options
function countNonEmptyOptions(quiz) {
  const optionAttrs = ['opt1', 'opt2', 'opt3', 'opt4', 'opt5', 'opt6'];
  return optionAttrs.reduce((count, option) => {
    const isOptionEmpty = (quiz[option] === '' || quiz[option].startsWith('[Exp]'));
    return count + (isOptionEmpty ? 0 : 1);
  }, 0);
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
const checkQuizAndCalcScore = (quiz, chosenOptsStr, remainingMs, maxMs) => {
  try {
    const correctOpts = quiz.correct_opts.split(',');
    const chosenOpts = chosenOptsStr.split(',');
    // console.log("Checking quiz:", { correctOpts, chosenOpts, remainingMs, maxMs });
    const isCorrect = checkCorrect(correctOpts, chosenOpts).isCorrect;

    // Calculate score (from 0 to 1000)
    let score = isCorrect ? 1 : 0;
    score = Math.floor(score * remainingMs / maxMs * 1000);

    return { isCorrect, score };
  } catch (error) {
    console.error('Error checking quiz:', error);
    return { isCorrect: false, score: 0 };
  }
};

// Delete all liveBattles not updated in the last 30 minutes
const deleteOldLiveBattles = () => {
  const now = new Date();
  const thirtyMinutesAgo = new Date(now.getTime() - (30 * 60 * 1000));
  for (const liveBattleId in activeLiveBattles) {
    if (activeLiveBattles[liveBattleId].updatedAt < thirtyMinutesAgo) {
      delete activeLiveBattles[liveBattleId];
    }
  }
};

// Generate a liveBattleId with 6 uppercase characters
const generateliveBattleId = () => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  // Generate a random liveBattleId
  let liveBattleId = '';
  for (let i = 0; i < 6; i++) {
    liveBattleId += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  // Check if the liveBattleId is a key in activeLiveBattles
  if (activeLiveBattles[liveBattleId]) {
    liveBattleId = generateliveBattleId();
  }

  return liveBattleId;
};

// Get a simplified copy of a liveBattle object
const getSimplifiedLiveBattleCopy = (liveBattleId) => {
  // Find liveBattle in activeLiveBattles
  const liveBattle = activeLiveBattles[liveBattleId];

  // Check if liveBattle exists
  if (!liveBattle) {
    return null;
  }

  // Make a copy of the liveBattle object
  const liveBattleCopy = structuredClone(liveBattle);

  // Remove the host, test, and quizzes from the liveBattleCopy object
  delete liveBattleCopy.host;
  delete liveBattleCopy.test;
  delete liveBattleCopy.quizzes;

  // Return the liveBattleCopy object
  return liveBattleCopy;
};
// Create new liveBattle object
const createNewLiveBattle = (host, test, nSeconds, tryConfig) => {
  // Delete old liveBattles
  deleteOldLiveBattles();

  // Delete any previous liveBattles with the same host
  for (const liveBattleId in activeLiveBattles) {
    if (activeLiveBattles[liveBattleId].host.id === host.id) {
      delete activeLiveBattles[liveBattleId];
    }
  }

  // Generate a unique liveBattleId
  const liveBattleId = generateliveBattleId();

  // Create new liveBattle object
  const liveBattle = {
    id: liveBattleId,
    status: 'waiting', // waiting, ongoing, finished
    secondsPerQuestion: nSeconds,
    currentTime: Date.now(),
    currentQuizIndex: 0,
    currentQuizId: null,
    currentQuizStartsAt: null,
    currentQuizEndsAt: null,
    hostIsPlayer: false,
    host: {
      id: host.id,
      username: host.username,
      lastContact: new Date(),
    },
    players: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Set test to the liveBattle object
  // Delete quizzes, creationData, stats, context, latestResults, bestResults, userResults, metadataQuiz
  delete test.quizzes;
  delete test.creationData;
  delete test.stats;
  delete test.context;
  delete test.creationContent;
  delete test.creationGuidelines;
  delete test.latestResults;
  delete test.bestResults;
  delete test.userResults;
  delete test.metadataQuiz;
  liveBattle.test = test;

  // Set nQs
  liveBattle.nQs = tryConfig.quizzes.length;

  // Delete updatedAt and createdAt from tryConfig.quizzes
  tryConfig.quizzes.forEach((quiz) => {
    delete quiz.updatedAt;
    delete quiz.createdAt;
  });

  // Set quizzes to the liveBattle object
  liveBattle.quizzes = tryConfig.quizzes;

  // Set randomOpts for each quiz
  liveBattle.quizzes.forEach((quiz) => {
    quiz.randomOpts = tryConfig.randomQuizzesOpts[quiz.id];
  });

  // Order the quizzes by the position of their id in the list tryConfig.randomQuizzesIds
  liveBattle.quizzes.sort((a, b) => {
    return tryConfig.randomQuizIds.indexOf(a.id) - tryConfig.randomQuizIds.indexOf(b.id);
  });

  // Add liveBattle to activeLiveBattles
  activeLiveBattles[liveBattleId] = liveBattle;

  return liveBattle;
};

// Add a new player to a live battle
const addPlayerToLiveBattle = (liveBattleId, playername, userId) => {
  // Find liveBattle in activeLiveBattles
  const liveBattle = activeLiveBattles[liveBattleId];

  // If liveBattle is not found, return
  if (!liveBattle) {
    return;
  }

  // If liveBattle is not waiting, return
  if (liveBattle.status !== 'waiting') {
    return;
  }

  // While the playername matches an existing player, generate a new playername by adding a random number to it
  while (liveBattle.players.some((player) => player.name === playername)) {
    // If last 3 characters of playername are digits
    if (playername.slice(-3).match(/^\d+$/)) {
      playername = playername.slice(0, -3) + Math.floor(Math.random() * 1000);
    } else {
      playername = playername + '-' + Math.floor(Math.random() * 1000);
    }
  }

  // Initialize scores array to the length of liveBattle.quizzes and values -1
  const scores = Array(liveBattle.nQs).fill(-1);

  // Add a new player to the liveBattle object
  liveBattle.players.push({
    id: userId,
    name: playername,
    totalScore: 0,
    totalSeconds: 0,
    hits: 0,
    fails: 0,
    omissions: 0,
    scores: scores,
    lastContact: new Date(),
  });

  // Update liveBattle in activeLiveBattles
  liveBattle.updatedAt = new Date();

  // Return the used playername
  return playername;
};

// Update the last contact of a player
const updatePlayerLastContact = (liveBattleId, playername) => {
  // Find liveBattle in activeLiveBattles
  const liveBattle = activeLiveBattles[liveBattleId];

  // If liveBattle is not found, return
  if (!liveBattle) {
    return;
  }

  // If playername === host.username, update lastContact of host
  if (playername === liveBattle.host.username) {
    liveBattle.host.lastContact = new Date();
  }

  // Find player in liveBattle
  const player = liveBattle.players.find((player) => player.name === playername);

  // If player is not found, return
  if (!player) {
    return;
  }

  // Update player in liveBattle
  player.lastContact = new Date();
};

// Check if a player is in a live battle
const isPlayerInLiveBattle = (liveBattleId, playername) => {
  // Find liveBattle in activeLiveBattles
  const liveBattle = activeLiveBattles[liveBattleId];

  // If liveBattle is not found, return false
  if (!liveBattle) {
    return false;
  }

  // Find player in liveBattle
  const player = liveBattle.players.find((player) => player.name === playername);

  // If player is not found, return false
  if (!player) {
    return false;
  }

  // Return true
  return true;
};

// Check if a player with the same name AND same IP is in the live battle


// Remove a player from a live battle
const removePlayerFromLiveBattle = (liveBattleId, playername) => {
  // Find liveBattle in activeLiveBattles
  const liveBattle = activeLiveBattles[liveBattleId];

  // If liveBattle is not found, return
  if (!liveBattle) {
    return;
  }

  // Find player in liveBattle
  const player = liveBattle.players.find((player) => player.name === playername);

  // If player is not found, return
  if (!player) {
    return;
  }

  // Remove player from liveBattle
  liveBattle.players = liveBattle.players.filter((player) => player.name !== playername);
};

// Remove players whose last contact was more than MAX_INACTIVE_SECONDS ago
const removeInactivePlayersFromLiveBattle = (liveBattleId) => {
  // Find liveBattle in activeLiveBattles
  const liveBattle = activeLiveBattles[liveBattleId];

  // If liveBattle is not found, return
  if (!liveBattle) {
    return;
  }

  // Set seconds threshold to MAX_INACTIVE_SECONDS/4 if status is waiting
  let secondsThreshold = MAX_INACTIVE_SECONDS;
  if (liveBattle.status === 'waiting') {
    secondsThreshold = MAX_INACTIVE_SECONDS / 4;
  }

  // Remove players whose last contact was more than MAX_INACTIVE_SECONDS ago
  liveBattle.players = liveBattle.players.filter((player) => {
    return (new Date() - player.lastContact) < secondsThreshold * 1000;
  });
};

// Update non-answered scores
const updateNonAnsweredScores = (liveBattleId, currentQuizIndex) => {
  // Find liveBattle in activeLiveBattles
  const liveBattle = activeLiveBattles[liveBattleId];

  // If liveBattle is not found, return
  if (!liveBattle) {
    return;
  }

  // For each player, set the score of index currentQuizIndex to 0 if it was -1
  liveBattle.players.forEach((player) => {
    if (player.scores[currentQuizIndex] === -1) {
      player.scores[currentQuizIndex] = 0;
    }
  });
};


// Calculate new total scores
const calculateNewTotalScores = (liveBattleId) => {
  // Find liveBattle in activeLiveBattles
  const liveBattle = activeLiveBattles[liveBattleId];

  // If liveBattle is not found, return
  if (!liveBattle) {
    return;
  }

  // Calculate new total scores for each player by summing all score values different from -1
  liveBattle.players.forEach((player) => {
    player.totalScore = player.scores.reduce((acc, score) => {
      if (score !== -1) {
        return acc + score;
      }
      return acc;
    }, 0);
  });
};


// GET /tests/:testUUID/livebattle
exports.newLobby = async (req, res, next) => {
  try {
    // Get the user from the session object
    const user = req.session.user;
    // Get the test as a copy from the request object
    const test = req.test;
    // Get the query parameters
    let nQuestions = req.query.n || test.quizzes.length;
    let nSeconds = req.query.s || QUESTION_SECONDS;
    const randomizeOptions = req.query.rOpts === 'true';
    const randomizeQuestions = req.query.rQs === 'true';

    // If nQuestions is not a number, set it to the number of quizzes in the test
    if (isNaN(nQuestions)) {
      nQuestions = test.quizzes.length;
    // If nQuestions is greater than the number of quizzes in the test, set it to the number of quizzes in the test
    } else if (nQuestions > test.quizzes.length) {
      nQuestions = test.quizzes.length;
    // If nQuestions is less than 1, set it to 1
    } else if (nQuestions < 1) {
      nQuestions = 1;
    }

    // If nSeconds is not a number, set it to QUESTION_SECONDS
    if (isNaN(nSeconds)) {
      nSeconds = QUESTION_SECONDS;
    // If nSeconds is greater than MAX_QUESTION_SECONDS, set it to MAX_QUESTION_SECONDS
    } else if (nSeconds > MAX_QUESTION_SECONDS) {
      nSeconds = MAX_QUESTION_SECONDS;
    // If nSeconds is less than MIN_QUESTION_SECONDS, set it to MIN_QUESTION_SECONDS
    } else if (nSeconds < MIN_QUESTION_SECONDS) {
      nSeconds = MIN_QUESTION_SECONDS;
    }

    // Set nQuestions to 1 (for testing purposes)
    // nQuestions = 1;

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
    const tryConfig = {
      testId: test.id,
      testType: test.type,
      metadataQuiz: test.metadataQuiz,
      quizzes: resultQuizzes,
      nQuestions,
      randomQuizIds,
      randomQuizzesOpts,
    };

    // Create a new liveBattle object
    const liveBattle = createNewLiveBattle(user, test, nSeconds, tryConfig);
    const playername = user.username;
    // console.log(liveBattle);

    // If ajax request, send json response
    if (req.query.ajax === 'true') return res.json({ renderedHTML: getRenderedTemplate(LOBBY_TEMPLATE_CONTENT, res.locals, { liveBattle, playername }) });
    // Render the try.ejs template with the test and settings
    return res.render('livebattle/lobby.ejs', { liveBattle, playername, minimalFooter: true });
  } catch (error) {
    const errorMessage = 'Error creating the live battle: ' + error.message;
    console.error(errorMessage);
    next(error, req, res);
  }
};

// GET /livebattle/:liveBattleId?pn=cool-papaya13&hip=false
exports.joinLobby = async (req, res, next) => {
  try {
    // Get user from session
    const user = req.session.user;

    // Get the liveBattleId from the request object
    const liveBattleId = req.params.liveBattleId;

    // Get the liveBattle from the activeLiveBattles object
    const liveBattle = activeLiveBattles[liveBattleId];
    if (liveBattle) {
      const test = await Test.findByPk(liveBattle.test.id, { attributes: ['id', 'userId', 'visibility'] });
      if (!test || !canReadTest(test, req.session.user)) return res.status(404).json({ success: false, error: 'Battle not found.' });
    }

    // Try to get player name from query parameters (needed early for rejoin check)
    let playername = user.username;

    // Check if player can rejoin an ongoing battle
    // Allow rejoin if: battle is ongoing AND player has a name
    const canRejoin = liveBattle && liveBattle.status === 'ongoing' && playername;

    // If liveBattle is not found, finished, or players >= MAX_N_PLAYERS (but allow rejoin for ongoing)
    if (!liveBattle || liveBattle.status === 'finished' ||
        (liveBattle.status === 'ongoing' && !canRejoin) ||
        (liveBattle.status === 'waiting' && liveBattle.players.length >= MAX_N_PLAYERS)) {
      // If it was an ajax request
      if (req.query.ajax) {
        const renderedHTML = getRenderedTemplate(LIVEBATTLE_NOT_FOUND_TEMPLATE_CONTENT, res.locals, { liveBattleId });
        // Set response status to 404 (Not Found)
        res.status(404);
        return res.json({ renderedHTML: renderedHTML });
      }
      // Set the response status to 404 (Not Found)
      res.status(404);
      // If it was a regular request
      return res.render('livebattle/livebattle-not-found.ejs', { liveBattleId });
    }

    // If rejoining an ongoing battle, re-add the player if they were removed
    if (canRejoin) {
      const existingPlayer = liveBattle.players.find(p => p.name === playername);
      if (existingPlayer) {
        // Player still exists, just update last contact
        updatePlayerLastContact(liveBattleId, playername);
        console.log(`Player ${playername} rejoined live battle ${liveBattleId} (still in list)`);
      } else {
        // Player was removed due to inactivity, re-add them with scores set to 0 for past questions
        const scores = Array(liveBattle.nQs).fill(0);
        // Set scores for future questions (not yet answered) to -1
        for (let i = liveBattle.currentQuizIndex; i < liveBattle.nQs; i++) {
          scores[i] = -1;
        }
        liveBattle.players.push({
          id: user.id,
          name: playername,
          totalScore: 0,
          totalSeconds: 0,
          hits: 0,
          fails: 0,
          omissions: liveBattle.currentQuizIndex, // Mark past questions as omissions
          scores: scores,
          lastContact: new Date(),
        });
        console.log(`Player ${playername} rejoined live battle ${liveBattleId} (re-added to list)`);
      }
    }

    const hostIsPlayer = req.method === 'POST' ? req.query.hip : undefined;
    if (hostIsPlayer !== undefined && user.id !== liveBattle.host.id) {
      return res.status(403).json({ success: false, error: 'Only the host can change host participation.' });
    }
    if (user.id !== liveBattle.host.id) {
      if (isPlayerInLiveBattle(liveBattleId, playername)) updatePlayerLastContact(liveBattleId, playername);
      else playername = addPlayerToLiveBattle(liveBattleId, playername, user.id);
    }

    // If host is player is "true" and the playername matches the host name
    if (hostIsPlayer === 'true' && playername === liveBattle.host.username) {
      // Set hostIsPlayer to true
      liveBattle.hostIsPlayer = true;
      // Add the host as a player if it wasnt already there
      if (!isPlayerInLiveBattle(liveBattleId, liveBattle.host.username)) {
        addPlayerToLiveBattle(liveBattleId, liveBattle.host.username, user.id);
      } else {
        // Update last contact of host
        updatePlayerLastContact(liveBattleId, liveBattle.host.username);
      }
    }

    // If host is player is "false" and the playername matches the host name
    if (hostIsPlayer === 'false' && playername === liveBattle.host.username) {
      // Set hostIsPlayer to false
      liveBattle.hostIsPlayer = false;
      // Remove the host from the liveBattle players
      removePlayerFromLiveBattle(liveBattleId, liveBattle.host.username);
    }

    // If hostIsPlayer is either "true" or "false" just return success json response
    if (hostIsPlayer === 'true' || hostIsPlayer === 'false') {
      return res.json({ success: true });
    }

    // If ajax request, send json response
    if (req.query.ajax === 'true') return res.json({ renderedHTML: getRenderedTemplate(LOBBY_TEMPLATE_CONTENT, res.locals, { liveBattle, playername }) });
    // Render the try.ejs template with the test and settings
    return res.render('livebattle/lobby.ejs', { liveBattle, playername, minimalFooter: true });
  } catch (error) {
    next(error, req, res);
  }
};

// GET /livebattle/:liveBattleId/status?pn=:playername
// Only works as AJAX request
exports.getLiveBattleStatus = async (req, res, next) => {
  try {
    const playername = req.session.user.username;
    const liveBattleId = req.params.liveBattleId;
    const liveBattle = activeLiveBattles[liveBattleId];
    if (liveBattle) {
      const test = await Test.findByPk(liveBattle.test.id, { attributes: ['id', 'userId', 'visibility'] });
      if (!test || !canReadTest(test, req.session.user)) return res.status(404).json({ success: false, error: 'Battle not found.' });
    }

    // If the live battle does not exist
    if (!liveBattle) {
      // Return unsuccessful response
      return res.json({ success: false, error: 'Live battle does not exist.' });
    }

    // Update the player last contact
    updatePlayerLastContact(liveBattleId, playername);

    // Remove inactive players
    removeInactivePlayersFromLiveBattle(liveBattleId);

    // Get the currentQuizEndsAt of the live battle
    const currentQuizEndsAt = liveBattle.currentQuizEndsAt;

    // Boolean checking if the current time is past the currentQuizEndsAt
    const isCurrentQuizOver = (currentQuizEndsAt && (currentQuizEndsAt < Date.now()));
    // Get active players (connected within MAX_INACTIVE_SECONDS)
    const activePlayers = liveBattle.players.filter((player) => {
      return (new Date() - player.lastContact) < MAX_INACTIVE_SECONDS * 1000;
    });
    // Boolean checking if all ACTIVE players have answered (skip disconnected players)
    const hasEveryoneAnswered = activePlayers.length > 0 &&
      activePlayers.every((player) => player.scores[liveBattle.currentQuizIndex] !== -1);
    // If the current time is past the currentQuizEndsAt
    if ((liveBattle.status === 'ongoing') && (isCurrentQuizOver || hasEveryoneAnswered)) {
      // Print the reason why we are updating the current quiz
      if (isCurrentQuizOver) {
        console.log(`The time to answer has passed. Moving to the next question.`);
      } else if (hasEveryoneAnswered) {
        console.log(`Everyone has answered. Moving to the next question.`);
      }
      // Update non-answered scores
      updateNonAnsweredScores(liveBattleId);
      // Calculate new total scores
      calculateNewTotalScores(liveBattleId);
      // Check if the currentQuizIndex is less than nQs
      if (liveBattle.currentQuizIndex < liveBattle.nQs - 1) {
        // Update the current quiz data
        liveBattle.currentQuizIndex += 1;
        liveBattle.currentQuizId = liveBattle.quizzes[liveBattle.currentQuizIndex].id;
        liveBattle.currentQuizStartsAt = Date.now() + SHOW_NEW_SCORES_SECONDS * 1000;
        liveBattle.currentQuizEndsAt = Date.now() + SHOW_NEW_SCORES_SECONDS * 1000 + liveBattle.secondsPerQuestion * 1000;
        // Print the update in natural text
        console.log(`Live battle ${liveBattleId} quiz index updated to ${liveBattle.currentQuizIndex} with id ${liveBattle.currentQuizId}.`);
      } else {
        // Set the live battle status to finished
        liveBattle.status = 'finished';
        // Print the update in natural text
        console.log(`Live battle ${liveBattleId} status updated to finished.`);
      }
    }

    // Update the current time in the live battle
    liveBattle.currentTime = Date.now();

    // Get a simplified copy of the live battle object
    const liveBattleCopy = getSimplifiedLiveBattleCopy(liveBattleId);

    // Return successful response
    return res.json({ success: true, liveBattle: liveBattleCopy });
  } catch (error) {
    next(error, req, res);
  }
};

// GET /livebattle/:liveBattleId/start
// Only works as AJAX request
exports.startLiveBattle = async (req, res, next) => {
  try {
    // Check the user is logged in and is the host of the live battle
    const user = req.session.user;
    const liveBattleId = req.params.liveBattleId;
    const liveBattle = activeLiveBattles[liveBattleId];
    if (liveBattle) {
      const test = await Test.findByPk(liveBattle.test.id, { attributes: ['id', 'userId', 'visibility'] });
      if (!test || !canReadTest(test, req.session.user)) return res.status(404).json({ success: false, error: 'Battle not found.' });
    }
    if (!user || !liveBattle || liveBattle.host.id !== user.id) {
      // Return unsuccessful response
      return res.status(403).json({ success: false, error: 'Only the host can start this battle.' });
    }

    // Check that there are enough players to start the live battle
    if (liveBattle.players.length < MIN_N_PLAYERS) {
      // Return unsuccessful response
      return res.json({ success: false, error: 'You need at least ' + MIN_N_PLAYERS + ' players to start the live battle.' });
    }

    // Start the live battle
    liveBattle.status = 'ongoing';
    liveBattle.currentQuizIndex = 0;
    liveBattle.currentQuizId = liveBattle.quizzes[0].id;
    liveBattle.currentQuizStartsAt = Date.now() + COUNTDOWN_SECONDS * 1000;
    liveBattle.currentQuizEndsAt = Date.now() + COUNTDOWN_SECONDS * 1000 + liveBattle.secondsPerQuestion * 1000;

    // Print the update in natural text
    console.log(`Live battle ${liveBattleId} started! Status updated to ongoing.`);

    // Get a simplified copy of the live battle object
    const liveBattleCopy = getSimplifiedLiveBattleCopy(liveBattleId);

    // Return successful response
    return res.json({ success: true , liveBattle: liveBattleCopy });
  } catch (error) {
    next(error, req, res);
  }
};

// POST /api/livebattle/:liveBattleId/answer?pn=:playername&qi=:quizIndex&rms:=remainingMs&co:=chosenOpts
// Only works as AJAX request
exports.checkAnswer = async (req, res, next) => {
  try {
    // Get the liveBattleId from the request object
    const liveBattleId = req.params.liveBattleId;
    const liveBattle = activeLiveBattles[liveBattleId];
    if (liveBattle) {
      const test = await Test.findByPk(liveBattle.test.id, { attributes: ['id', 'userId', 'visibility'] });
      if (!test || !canReadTest(test, req.session.user)) return res.status(404).json({ success: false, error: 'Battle not found.' });
    }

    // Check that the live battle exists
    if (!liveBattle) {
      // Return unsuccessful response
      return res.json({ success: false, error: 'Live battle does not exist.' });
    }

    // Check that the live battle is ongoing
    if (liveBattle.status !== 'ongoing') {
      // Return unsuccessful response
      return res.json({ success: false, error: 'Live battle is not ongoing.' });
    }

    // Unpack the query parameters
    const playername = req.session.user.username;
    const quizIndex = Number(req.query.qi);
    if (!Number.isInteger(quizIndex) || quizIndex !== liveBattle.currentQuizIndex
        || Date.now() < liveBattle.currentQuizStartsAt || Date.now() > liveBattle.currentQuizEndsAt) {
      return res.status(400).json({ success: false, error: 'Question is not currently accepting answers.' });
    }
    const remainingMs = Math.max(0, liveBattle.currentQuizEndsAt - Date.now());
    const chosenOptsStr = req.query.co;

    // Find the player
    const player = liveBattle.players.find((player) => player.id === req.session.user.id);
    if (!player) {
      return res.json({ success: false, error: 'Player not found in this live battle.' });
    }

    // If the chosenOptsStr is different from "0"
    const prevScore = player.scores[quizIndex];
    let result = 'omitted';
    let newScore = 0;

    // Check if the score is already calculated
    if (prevScore !== -1) {
      // If score is not 0, set result to correct
      if (prevScore !== 0) {
        result = 'correct';
      } else {
        result = 'incorrect';
      }
      // Return successful response
      return res.json({ success: true, result: result, score: prevScore, alreadyAnswered: true });
    }

    // If the score is not already calculated
    if (chosenOptsStr !== '0') {
      // Check if the answer is correct and calculate score (must be on time)
      const quiz = liveBattle.quizzes[quizIndex];
      const maxMs = liveBattle.secondsPerQuestion * 1000;
      const { isCorrect, score } = checkQuizAndCalcScore(quiz, chosenOptsStr, remainingMs, maxMs);
      result = isCorrect ? 'correct' : 'incorrect';
      newScore = score;
      console.log(`Quiz #${quizIndex + 1} checked for player ${playername} - ${result} - ${newScore}`);
    }

    // Add the score to the player's data
    player.scores[quizIndex] = newScore;

    // Update liveBattle in activeLiveBattles
    liveBattle.updatedAt = new Date();

    // Return successful response
    return res.json({ success: true, result: result, score: newScore, alreadyAnswered: false });
  } catch (error) {
    // Log the error
    console.error(error);
    next(error, req, res);
  }
};
