'use strict';
// The initial Open schema is built from the registered models, including their
// associations. Later schema changes must use a new, explicit migration.
module.exports = {
  async up(queryInterface) { await queryInterface.sequelize.sync(); },
  async down() { throw new Error('Use a database backup to roll back the initial schema.'); },
};
