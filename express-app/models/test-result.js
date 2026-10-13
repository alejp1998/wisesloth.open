'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class TestResult extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(_models) {
      // define association here
    }
  }
  TestResult.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        allowNull: false,
        validate: { notEmpty: { msg: 'Id must not be empty' } },
      },
      testId: {
        type: DataTypes.UUID,
        allowNull: false
      },
      userId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      nSeconds: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      nQuestions: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      score: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      hits: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      fails: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      omissions: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      sequelize,
      modelName: 'TestResult',
    }
  );
  return TestResult;
};
