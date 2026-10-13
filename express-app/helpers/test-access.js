'use strict';

function canReadTest(test, user) {
  if (test.visibility === 'public') return true;
  if (!user) return false;
  if (user.isAdmin || user.id === test.userId) return true;
  return test.visibility === 'followers' && (user.iFollowIds || []).includes(test.userId);
}

module.exports = { canReadTest };
