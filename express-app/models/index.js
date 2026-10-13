'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const process = require('process');
const env = process.env.NODE_ENV || 'development'; // Default to development if NODE_ENV is not set

/**
 * Load and parse the JSON configuration file.
 * Replace placeholders with environment variable values.
 *
 * @param {string} configFilePath - The path to the configuration file.
 * @returns {object} The configuration object with environment variables substituted.
 */
function loadConfig(configFilePath) {
  // Read the JSON configuration file
  const configFile = fs.readFileSync(configFilePath, 'utf8');
  const config = JSON.parse(configFile);

  // Replace placeholders in the configuration
  function replaceEnvVars(obj) {
    if (typeof obj === 'string') {
      // Replace placeholders with environment variables
      return obj.replace(/\$\{(\w+)\}/g, (match, p1) => {
        return process.env[p1] || match;  // Use the environment variable or keep the original placeholder
      });
    } else if (typeof obj === 'object' && obj !== null) {
      // Recursively process objects and arrays
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          obj[key] = replaceEnvVars(obj[key]);
        }
      }
    }
    return obj;
  }

  return replaceEnvVars(config);
}

// Load the database configuration
const dbConfig = loadConfig(path.join(__dirname, '..', 'config', 'config.json'))[env];

// Connection pool configuration for better performance and scalability
const poolConfig = {
  max: 10,        // Maximum number of connection in pool
  min: 0,         // Minimum number of connection in pool
  acquire: 30000, // Maximum time (ms) that pool will try to get connection before throwing error
  idle: 10000     // Maximum time (ms) that a connection can be idle before being released
};

// Set up the database connection
let sequelize;
if (dbConfig.use_env_variable) {
  // dbConfig.use_env_variable should point to the name of the environment variable holding the connection string
  sequelize = new Sequelize(process.env[dbConfig.use_env_variable], {
    ...dbConfig,
    pool: poolConfig
  });
} else {
  sequelize = new Sequelize(
    dbConfig.database,
    dbConfig.username,
    dbConfig.password,
    {
      host: dbConfig.host,
      dialect: dbConfig.dialect.startsWith('${') ? 'mysql' : dbConfig.dialect,
      logging: dbConfig.logging,
      pool: poolConfig,
      // Additional performance optimizations
      dialectOptions: {
        // For MySQL - enable connection timeout
        connectTimeout: 60000
      },
      retry: {
        // Retry connection on transient errors
        max: 3
      }
    }
  );
}

// Test the database connection
// sequelize.authenticate()
//   .then(() => {
//     console.log(`Connection to the ${env} database has been established successfully.`);
//   })
//   .catch(err => {
//     console.error('Unable to connect to the database:', err);
//   });

/// Define Models
const User = require(path.join(__dirname, 'user'))(sequelize, Sequelize);
const Test = require(path.join(__dirname, 'test'))(sequelize, Sequelize);
const Quiz = require(path.join(__dirname, 'quiz'))(sequelize, Sequelize);
const Flashcard = require(path.join(__dirname, 'flashcard'))(sequelize, Sequelize);
const InstanceSettings = require('./instance-settings')(sequelize, Sequelize);
const UserSkill = require(path.join(__dirname, 'user-skill'))(sequelize, Sequelize);
const UserSkillConfig = require(path.join(__dirname, 'user-skill-config'))(sequelize, Sequelize);
const TestResult = require(path.join(__dirname, 'test-result'))(sequelize, Sequelize);
const QuizResult = require(path.join(__dirname, 'quiz-result'))(sequelize, Sequelize);
const Follower = require(path.join(__dirname, 'follower'))(sequelize, Sequelize);
const Favorite = require(path.join(__dirname, 'favorite'))(sequelize, Sequelize);
const session = require(path.join(__dirname, 'session'))(sequelize, Sequelize);
const AiUsageLog = require(path.join(__dirname, 'ai-usage-log'))(sequelize, Sequelize);

// Charge models
sequelize.models = {
  User,
  Test,
  Quiz,
  Flashcard,
  InstanceSettings,
  UserSkill,
  UserSkillConfig,
  TestResult,
  QuizResult,
  Follower,
  Favorite,
  session,
  AiUsageLog,
};

// Initialize models and set up associations
Object.keys(sequelize.models).forEach((modelName) => {
  if (sequelize.models[modelName].associate) {
    sequelize.models[modelName].associate(sequelize.models);
  }
});

// Relation 1-to-N between User and Test
User.hasMany(Test, { as: 'authoredTests', foreignKey: 'userId' });
Test.belongsTo(User, { as: 'author', foreignKey: 'userId' });

// Relation N-to-N between User and Test through Favorite
User.belongsToMany(Test, { as: 'favoriteTests', through: 'favorites', foreignKey: 'userId' });
Test.belongsToMany(User, { as: 'favoritedBy', through: 'favorites', foreignKey: 'testId' });

// Relation N-to-N between User and User through Follower
User.belongsToMany(User, { as: 'iFollow', through: 'followers', foreignKey: 'followerId' });
User.belongsToMany(User, { as: 'followMe', through: 'followers', foreignKey: 'followedId' });

// Relation 1-to-N between User and UserSkill (skills / preferences)
User.hasMany(UserSkill, { as: 'skills', foreignKey: 'userId', onDelete: 'CASCADE' });
UserSkill.belongsTo(User, { as: 'owner', foreignKey: 'userId' });

// Relation 1-to-1 between User and UserSkillConfig (per-type + always selections)
User.hasOne(UserSkillConfig, { as: 'skillConfig', foreignKey: 'userId', onDelete: 'CASCADE' });
UserSkillConfig.belongsTo(User, { as: 'owner', foreignKey: 'userId' });

// Relation 1-to-N between User and TestResult
User.hasMany(TestResult, { as: 'testResults', foreignKey: 'userId', onDelete: 'CASCADE' });
TestResult.belongsTo(User, { as: 'examinee', foreignKey: 'userId' });

// Relation 1-to-N between User and QuizResult
User.hasMany(QuizResult, { as: 'quizResults', foreignKey: 'userId', onDelete: 'CASCADE' });
QuizResult.belongsTo(User, { as: 'examinee', foreignKey: 'userId' });

// Relation 1-to-N between Test and Quizzes
Test.hasMany(Quiz, { as: 'quizzes', foreignKey: 'testId', onDelete: 'CASCADE' });
Quiz.belongsTo(Test, { as: 'test', foreignKey: 'testId' });

// Relation 1-to-N between Test and TestResult
Test.hasMany(TestResult, { as: 'testResults', foreignKey: 'testId', onDelete: 'CASCADE' });
TestResult.belongsTo(Test, { as: 'test', foreignKey: 'testId' });

// Relation 1-to-N between Test and QuizResult
Test.hasMany(QuizResult, { as: 'testQuizResults', foreignKey: 'testId', onDelete: 'CASCADE' });
QuizResult.belongsTo(Test, { as: 'test', foreignKey: 'testId' });

// Relation 1-to-N between Quiz and QuizResult
Quiz.hasMany(QuizResult, { as: 'quizResults', foreignKey: 'quizId' });
QuizResult.belongsTo(Quiz, { as: 'quiz', foreignKey: 'quizId' });

// Relation 1-to-N between TestResult and QuizResult
TestResult.hasMany(QuizResult, { as: 'quizResults', foreignKey: 'testResultId', onDelete: 'CASCADE' });
QuizResult.belongsTo(TestResult, { as: 'testResult', foreignKey: 'testResultId' });

// Relation 1-to-N between User and AiUsageLog (metrics for focused AI edits: single
// question/card edits and general test/deck edits - not full test creation, which is
// tracked directly on the Test row's promptTokens/completionTokens)
User.hasMany(AiUsageLog, { as: 'aiUsageLogs', foreignKey: 'userId', onDelete: 'SET NULL' });
AiUsageLog.belongsTo(User, { as: 'user', foreignKey: 'userId' });

// Relation 1-to-N between User and IssueReport (widget bug reports; nullable userId = anonymous)

module.exports = sequelize;
