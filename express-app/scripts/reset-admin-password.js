'use strict';

const sequelize = require('../models');
const { hashPassword } = require('../helpers/credentials');

async function reset() {
  const user = await sequelize.models.User.unscoped().findOne({
    where: { username: process.env.ADMIN_USERNAME },
  });
  if (!user || !user.isAdmin) throw new Error('Configured administrator not found.');
  await user.update({ passwordHash: await hashPassword(process.env.ADMIN_PASSWORD) });
  console.log('Administrator password reset from ADMIN_PASSWORD.');
}

reset().then(() => sequelize.close()).catch(async error => {
  console.error(error.message);
  await sequelize.close();
  process.exitCode = 1;
});
