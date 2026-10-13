'use strict';

const { randomUUID } = require('crypto');
const { models: { AiUsageLog } } = require('../models');
const BROWSER_MODELS = new Set(['openai/gpt-6-luna', 'gemini/gemini-3.8-flash', 'gemini/gemini-3.5-flash-lite']);

async function fetchBrowserAI(req, url, options) {
  const config = typeof req.body.browserAI === 'string' ? JSON.parse(req.body.browserAI) : req.body.browserAI;
  if (!config || !['prepare', 'complete'].includes(config.mode) || !BROWSER_MODELS.has(config.model)) {
    throw new Error('Invalid browser AI configuration.');
  }
  if (!(options.body instanceof FormData)) throw new Error('Browser AI requires form data.');
  if (config.mode === 'complete') {
    if (typeof config.content !== 'string' || !config.content || config.content.length > 500000) {
      throw new Error('Browser completion is missing or too large.');
    }
    options.body.set('_browser_completion', config.content);
  }
  const response = await fetch(url, {
    ...options,
    headers: { 'X-Browser-AI-Mode': config.mode, 'X-Browser-AI-Model': config.model },
    signal: AbortSignal.timeout(30000),
  });
  const payload = await response.clone().json();
  if (payload.browserAIPlan && config.mode === 'prepare') return response;
  if (config.mode === 'prepare') return response;
  // Browser billing cannot be attested by this server. Track the action with zero
  // host cost, and leave personal spending controls to the provider account.
  req.aiUsage = await AiUsageLog.create({
    id: randomUUID(), userId: req.session.user.id,
    action: new URL(url).pathname.split('/').pop(), model: config.model,
    promptTokens: 0, completionTokens: 0, totalTokens: 0, costUsd: 0,
    outcome: payload.success ? 'browser' : 'error',
  });
  return response;
}

module.exports = { fetchBrowserAI };
