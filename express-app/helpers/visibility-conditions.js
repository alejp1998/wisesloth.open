'use strict';
const { Op } = require('sequelize');
function getVisibilityConditions(user) {
  if (user?.isAdmin) return [{}];
  if (!user) return [{ visibility: 'public' }];
  return [{ [Op.or]: [
    { visibility: 'public' }, { userId: user.id },
    { [Op.and]: [{ visibility: 'followers' }, { userId: { [Op.in]: user.iFollowIds || [] } }] },
  ] }];
}
module.exports = { getVisibilityConditions };
