'use strict';

// MODULES REQUIRED


// MODELS
const { models } = require('../models');
const { User, Favorite } = models;

// POST api/users/:username/follow
exports.followUser = async (req, res, _next) => {
  try {
    const username = req.params.username; // User to be followed
    const followerId = req.session.user.id; // Assuming you have authentication for the current user

    const userToFollow = await User.findOne({ where: { username: username } });
    if (!userToFollow) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Add me to userToFollow followers
    await userToFollow.addFollowMe(followerId);

    // Update iFollowIds and iFollowUsernames
    req.session.user.iFollowIds.push(userToFollow.id);
    req.session.user.iFollowUsernames.push(userToFollow.username);

    res.status(200).json({ message: 'Followed successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

// DELETE api/users/:username/unfollow
exports.unfollowUser = async (req, res, _next) => {
  try {
    const username = req.params.username; // User to be unfollowed
    const followerId = req.session.user.id; // Assuming you have authentication for the current user

    const userToUnfollow = await User.findOne({ where: { username: username } });
    if (!userToUnfollow) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Remove me from userToUnfollow followers
    await userToUnfollow.removeFollowMe(followerId);

    // Update followMeIds and followMeUsernames
    req.session.user.iFollowIds = req.session.user.iFollowIds.filter(
      (id) => id !== userToUnfollow.id
    );
    req.session.user.iFollowUsernames = req.session.user.iFollowUsernames.filter(
      (username) => username !== userToUnfollow.username
    );

    res.status(200).json({ message: 'Followed successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

// POST /api/tests/:testUUID/favorite
exports.addTestToFavorites = async (req, res, _next) => {
  try {
    const testUUID = req.params.testUUID;
    const userId = req.session.user.id;

    // Create entry in favorites matching userId and testId
    await Favorite.create({ userId: userId, testId: testUUID });

    // Update favoriteIds
    req.session.user.favoriteIds.push(testUUID);

    res.status(200).json({ message: 'Test added to favorites' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

// DELETE /api/tests/:testUUID/unfavorite
exports.removeTestFromFavorites = async (req, res, _next) => {
  try {
    const testUUID = req.params.testUUID;
    const userId = req.session.user.id;

    // Delete entry from favorites matching userId and testId
    await Favorite.destroy({ where: { userId: userId, testId: testUUID } });

    // Update favoriteIds
    req.session.user.favoriteIds = req.session.user.favoriteIds.filter(
      (id) => id !== testUUID
    );

    res.status(200).json({ message: 'Test removed from favorites' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

// GET /api/logout
exports.logOut = async (req, res) => {
  if (!req.session.user) {
    // Respond with a success message
    return res
      .status(401)
      .json({ success: false, error: 'User already logged out!' });
  } else {
    // Destroy the session
    req.session.user = null;

    // Wait for any potential session store save to complete
    await new Promise((resolve) => req.session.save(resolve));

    // Respond with a success message
    return res.status(200).json({ success: true });
  }
};

// POST /api/sync-preferences
// Syncs client-side preferences with server session
exports.syncPreferences = async (req, res, _next) => {
  try {
    const { theme, language, showTips, compactView } = req.body;

    // Update session with client preferences (client wins for theme/language)
    if (theme && ['light', 'dark'].includes(theme)) {
      req.session.chosenTheme = theme;
    }
    if (language && ['en', 'es'].includes(language)) {
      req.session.chosenLanguage = language;
    }

    // Save session
    await new Promise((resolve) => req.session.save(resolve));

    // Return current server state
    const response = {
      preferences: {
        theme: req.session.chosenTheme,
        language: req.session.chosenLanguage,
        showTips: showTips !== undefined ? showTips : true,
        compactView: compactView !== undefined ? compactView : false,
      }
    };

    // Include user info if logged in
    if (req.session.user) {
      response.user = {
        username: req.session.user.username,
        name: req.session.user.name || '',
        isAdmin: req.session.user.isAdmin || false,
        isEditor: req.session.user.isEditor || false,
      };
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error('Error syncing preferences:', error);
    res.status(500).json({ error: 'Failed to sync preferences' });
  }
};

// GET /api/session-status
// Returns current session status for frontend state recovery
exports.getSessionStatus = async (req, res, _next) => {
  try {
    const response = {
      isLoggedIn: !!req.session.user,
      preferences: {
        theme: req.session.chosenTheme || 'light',
        language: req.session.chosenLanguage || 'en',
      }
    };

    if (req.session.user) {
      response.user = {
        username: req.session.user.username,
        name: req.session.user.name || '',
        isAdmin: req.session.user.isAdmin || false,
        isEditor: req.session.user.isEditor || false,
      };
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error('Error getting session status:', error);
    res.status(500).json({ error: 'Failed to get session status' });
  }
};

// GET /api/user/session - Get current session user data
exports.getSessionUser = async (req, res) => {
  try {
    // Check if user is logged in
    if (!req.session.user) {
      return res.status(200).json({
        loggedIn: false
      });
    }

    const userId = req.session.user.id;
    const user = await User.findByPk(userId);

    if (!user) {
      // Session exists but user not found - clear session
      return res.status(200).json({
        loggedIn: false
      });
    }

    // Return user session data
    return res.status(200).json({
      loggedIn: true,
      username: user.username,
      isAdmin: user.isAdmin || false,
      theme: user.theme || 'light',
      language: user.language || 'en'
    });
  } catch (error) {
    console.error('Error getting session user:', error);
    return res.status(500).json({ error: 'Failed to get session data' });
  }
};
