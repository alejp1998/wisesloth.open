'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const { randomUUID } = require('crypto');
const sequelize = require('../models');
const { hashPassword, validateUsername } = require('../helpers/credentials');
const { parseBudget } = require('../helpers/spending');

async function bootstrap() {
  const { User, InstanceSettings } = sequelize.models;
  await InstanceSettings.findOrCreate({ where: { id: 'instance' },
    defaults: { weeklyBudgetUsd: parseBudget(process.env.INSTANCE_WEEKLY_BUDGET_USD) } });
  if (await User.count({ where: { isAdmin: true } })) return;
  const username = process.env.ADMIN_USERNAME;
  if (!validateUsername(username)) throw new Error('Set a valid ADMIN_USERNAME before starting.');
  await User.create({ id: randomUUID(), username, isAdmin: true,
    passwordHash: await hashPassword(process.env.ADMIN_PASSWORD)  });
  console.log('Initial administrator created.');
}

bootstrap().then(() => sequelize.close()).catch(async error => {
  console.error(error.message);
  await sequelize.close();
  process.exitCode = 1;
});
