'use strict';

const router = require('express').Router();
const { randomUUID } = require('crypto');
const sequelize = require('../models');
const { User, InstanceSettings, AiUsageLog } = sequelize.models;
const { hashPassword, verifyPassword, encryptApiKey, validateUsername } = require('../helpers/credentials');
const { genSsnUserData } = require('../helpers/user-session');
const { parseBudget, weeklySpend } = require('../helpers/spending');
const { authLimiter, accountCreationLimiter } = require('../middleware/rateLimiter');
const { loginRequired, loginRequiredAPI, adminRequired } = require('../controllers/session');

function renderLogin(res, error = '', status = 200) {
  return res.status(status).render('account/login', {
    error, allowRegistration: process.env.ALLOW_REGISTRATION === 'true',
  });
}

router.get('/login', (_req, res) => renderLogin(res));
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const user = validateUsername(req.body.username)
      ? await User.unscoped().findOne({ where: { username: req.body.username } }) : null;
    // Unknown accounts still run scrypt to avoid revealing usernames via timing.
    const dummy = 'scrypt:00000000000000000000000000000000:' + '0'.repeat(128);
    if (!await verifyPassword(req.body.password, user?.passwordHash || dummy) || !user) {
      return renderLogin(res, 'Incorrect username or password.', 401);
    }
    await new Promise((resolve, reject) => req.session.regenerate(err => err ? reject(err) : resolve()));
    req.session.user = await genSsnUserData(user);
    req.session.rememberMe = req.body.rememberMe === 'on';
    await new Promise((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));
    return res.redirect('/tests');
  } catch (error) { return next(error); }
});

async function createAccount(body) {
  if (!validateUsername(body.username)) throw new Error('Username must be 3–32 lowercase letters, numbers or dashes.');
  return User.create({ id: randomUUID(), username: body.username,
    passwordHash: await hashPassword(body.password), isAdmin: false,
  });
}

router.post('/register', accountCreationLimiter, async (req, res) => {
  if (process.env.ALLOW_REGISTRATION !== 'true') return renderLogin(res, 'Registration is disabled. Ask the host for an account.', 403);
  try {
    await createAccount(req.body);
    return renderLogin(res, 'Account created. Sign in to continue.');
  } catch (_error) { return renderLogin(res, 'Account could not be created. Use a unique valid username and a password of 12–256 characters.', 400); }
});

router.get('/settings', loginRequired, async (req, res, next) => {
  try {
    const user = await User.unscoped().findByPk(req.session.user.id);
    if (!user) return res.redirect('/login');
    const instance = await InstanceSettings.findByPk('instance');
    const usage = await AiUsageLog.findAll({ where: { userId: user.id }, order: [['createdAt', 'DESC']], limit: 30 });
    // Explicit locals: never pass the credential-bearing User object to EJS.
    return res.render('account/settings', {
      personalBudget: user.weeklyBudgetUsd, instanceBudget: instance.weeklyBudgetUsd,
      hasApiKey: !!user.apiKeyEncrypted, model: process.env.LLM_MODEL || 'openai/gpt-6-luna',
      personalSpend: await weeklySpend(user.id), instanceSpend: user.isAdmin ? await weeklySpend() : null,
      usage, notice: req.query.saved === '1' ? 'Settings saved.' : '',
    });
  } catch (error) { return next(error); }
});

router.post('/settings', loginRequiredAPI, async (req, res) => {
  try {
    const budget = parseBudget(req.body.weeklyBudgetUsd);
    const apiKey = req.body.apiKey;
    if (apiKey && (typeof apiKey !== 'string' || apiKey.length > 512 || /\s/.test(apiKey))) throw new Error('Invalid API key.');
    const updates = { weeklyBudgetUsd: budget };
    if (req.body.clearApiKey === 'on') updates.apiKeyEncrypted = null;
    else if (apiKey) updates.apiKeyEncrypted = encryptApiKey(apiKey);
    if (req.body.newPassword) {
      const user = await User.unscoped().findByPk(req.session.user.id);
      if (!await verifyPassword(req.body.currentPassword, user.passwordHash)) throw new Error('Current password is incorrect.');
      updates.passwordHash = await hashPassword(req.body.newPassword);
    }
    await User.update(updates, { where: { id: req.session.user.id } });
    return res.redirect('/settings?saved=1');
  } catch (error) { return res.status(400).send(error.message); }
});

router.post('/settings/instance', loginRequiredAPI, adminRequired, async (req, res) => {
  try {
    const budget = parseBudget(req.body.weeklyBudgetUsd);
    await InstanceSettings.update({ weeklyBudgetUsd: budget }, { where: { id: 'instance' } });
    return res.redirect('/settings?saved=1');
  } catch (error) { return res.status(400).send(error.message); }
});

router.post('/settings/accounts', loginRequiredAPI, adminRequired, async (req, res) => {
  try {
    await createAccount(req.body);
    return res.redirect('/settings?saved=1');
  } catch (_error) { return res.status(400).send('Could not create account. Check the username and password requirements.'); }
});

module.exports = router;
