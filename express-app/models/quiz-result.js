'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class QuizResult extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(_models) {
      // define association here
    }
  }
  QuizResult.init(
    {
      quizId: {
        type: DataTypes.UUID,
        allowNull: false
      },
      testId: {
        type: DataTypes.UUID,
        allowNull: false
      },
      testResultId: {
        type: DataTypes.UUID,
        allowNull: false
      },
      userId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      number: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      score: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
      },
      result: {
        type: DataTypes.STRING, // "correct", "incorrect", "omitted"
        allowNull: false,
      },
      orderOpts: {
        type: DataTypes.STRING, // e.g. "1,3,4,2"
        allowNull: false,
      },
      chosenOpts: {
        type: DataTypes.STRING, // e.g. "2,3"
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: 'QuizResult',
    }
  );
  return QuizResult;
};
