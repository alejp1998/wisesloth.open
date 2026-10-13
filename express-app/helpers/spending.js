'use strict';

const { Op } = require('sequelize');
const { models } = require('../models');

function weekStart(now = new Date()) {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
  return start;
}

function parseBudget(value) {
  if (value === '' || value === null || value === undefined) return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 100000 || !/^\d+(\.\d{1,6})?$/.test(String(value))) {
    throw new Error('Budget must be a nonnegative USD amount (up to six decimal places), or blank for unlimited.');
  }
  return amount;
}

async function weeklySpend(userId, transaction) {
  const where = { createdAt: { [Op.gte]: weekStart() } };
  if (userId) where.userId = userId;
  return Number(await models.AiUsageLog.sum('costUsd', { where, transaction })) || 0;
}

function limitReached(message) {
  return Object.assign(new Error(message), { status: 429 });
}

async function assertBudget(user, instance, transaction) {
  if (user.weeklyBudgetUsd !== null && user.weeklyBudgetUsd !== undefined
      && await weeklySpend(user.id, transaction) >= Number(user.weeklyBudgetUsd)) {
    throw limitReached('Your weekly spending limit has been reached. Change it in Settings or wait until Monday UTC.');
  }
  if (instance.weeklyBudgetUsd !== null && await weeklySpend(null, transaction) >= Number(instance.weeklyBudgetUsd)) {
    throw limitReached('The instance weekly spending limit has been reached. Contact the host.');
  }
}

module.exports = { weekStart, parseBudget, weeklySpend, assertBudget };
