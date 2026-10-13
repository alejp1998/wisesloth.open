'use strict';

const { models: { User } } = require('../models');

async function checkUserCanCreate(req, noun = 'a test') {
  if (!req.session.user) return { ok: false, status: 401, error: `Sign in to create ${noun}.` };
  const user = await User.findByPk(req.session.user.id);
  if (!user) return { ok: false, status: 401, error: 'Account not found.' };
  return { ok: true, user };
}

// fetchAI has already durably recorded provider usage, including failures.
async function recordAiUsage({ tokensUsed }) {
  return { tokensUsed: tokensUsed?.total || 0 };
}

module.exports = { checkUserCanCreate, recordAiUsage };
