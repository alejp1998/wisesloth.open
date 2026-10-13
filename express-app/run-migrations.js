'use strict';

// Runs the app's Sequelize migrations programmatically.
// Avoids needing sequelize-cli (a devDependency that is NOT installed in the
// production image). Records applied migrations in the standard SequelizeMeta
// table, so it works alongside sequelize-cli runs too.
//
// Usage: node run-migrations.js

const path = require('path');
const fs = require('fs');
// models/index.js exports the sequelize instance directly
const sequelize = require('./models');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const META_TABLE = 'SequelizeMeta';

async function ensureMetaTable() {
  await sequelize.query(
    `CREATE TABLE IF NOT EXISTS ${META_TABLE} (name VARCHAR(255) NOT NULL PRIMARY KEY)`
  );
}

async function getAppliedMigrations() {
  const [rows] = await sequelize.query(`SELECT name FROM ${META_TABLE}`);
  return rows.map((r) => r.name);
}

async function run() {
  await ensureMetaTable();
  const applied = await getAppliedMigrations();
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.js'))
    .sort();

  for (const file of files) {
    if (applied.includes(file)) {
      console.log(`SKIP  ${file} (already applied)`);
      continue;
    }
    console.log(`RUN   ${file} ...`);
    const migration = require(path.join(MIGRATIONS_DIR, file));
    try {
      await migration.up(sequelize.getQueryInterface(), sequelize.constructor);
      await sequelize.query(
        `INSERT INTO ${META_TABLE} (name) VALUES (?)`,
        { replacements: [file] }
      );
      console.log(`OK    ${file}`);
    } catch (error) {
      console.error(`FAIL  ${file}: ${error.message}`);
      throw error;
    }
  }

  console.log('All migrations processed.');
  await sequelize.close();
}

run().catch((error) => {
  console.error('Migration run failed:', error);
  process.exit(1);
});
