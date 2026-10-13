'use strict';

const { randomUUID } = require('crypto');
const sequelize = require('../models');
const { decryptApiKey } = require('./credentials');
const { assertBudget } = require('./spending');
const { fetchBrowserAI } = require('./browser-ai-client');

async function fetchAI(req, url, options) {
  if (!req.session.user) throw new Error('Sign in to use AI.');
  if (req.body?.browserAI !== undefined) return fetchBrowserAI(req, url, options);
  // One shared row serializes paid calls across sessions and processes. Usage
  // commits before the lock is released, so simultaneous calls see prior spend.
  let response;
  await sequelize.transaction(async transaction => {
    const instance = await sequelize.models.InstanceSettings.findByPk('instance', {
      transaction, lock: transaction.LOCK.UPDATE,
    });
    if (!instance) throw new Error('Run the database bootstrap first.');
    const user = await sequelize.models.User.unscoped().findByPk(req.session.user.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!user) throw new Error('Account not found.');
    await assertBudget(user, instance, transaction);
    const apiKey = decryptApiKey(user.apiKeyEncrypted);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120000);
    let payload;
    let uncertain = false;
    try {
      response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          ...options.headers,
          ...(apiKey ? { 'X-Provider-Key': apiKey } : {}),
        },
      });
      payload = await response.clone().json();
    } catch (_error) {
      // A timeout/transport failure can happen after the provider charged us.
      // Record a configured conservative amount rather than silently going unmetered.
      uncertain = true;
      payload = { success: false, error: 'AI service unavailable or timed out. Check the usage log before retrying.' };
    } finally {
      clearTimeout(timer);
    }
    const completion = payload.completion;
    const usage = completion?.tokens || payload.usage?.tokens || {};
    const cost = completion?.costUsd ?? payload.usage?.costUsd;
    const costUsd = uncertain ? Number(process.env.UNCERTAIN_REQUEST_COST_USD || '1') : Number(cost || 0);
    if (!Number.isFinite(costUsd) || costUsd < 0) throw new Error('AI service returned an invalid cost.');
    req.aiUsage = await sequelize.models.AiUsageLog.create({
      id: randomUUID(), userId: user.id, action: new URL(url).pathname.split('/').pop(),
      model: completion?.model || payload.usage?.model || process.env.LLM_MODEL || 'openai/gpt-6-luna',
      promptTokens: usage.prompt || 0, completionTokens: usage.completion || 0,
      totalTokens: usage.total || 0, costUsd,
      outcome: uncertain || completion?.outcome === 'uncertain' || payload.usage?.outcome === 'uncertain'
        ? 'uncertain' : payload.success ? 'success' : 'error',
    }, { transaction });
    if (uncertain) response = new Response(JSON.stringify(payload), { status: 502 });
  });
  return response;
}

module.exports = { fetchAI };
