'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Quiz extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(_models) {
      // define association here
    }
  }
  Quiz.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        allowNull: false,
        validate: { notEmpty: { msg: 'Id must not be empty' } },
      },
      testId: {
        type: DataTypes.UUID,
        validate: { notEmpty: { msg: 'Test id must not be empty' } },
      },
      userId: {
        type: DataTypes.UUID,
        validate: { notEmpty: { msg: 'User id must not be empty' } },
      },
      number: DataTypes.INTEGER,
      question: {
        type: DataTypes.TEXT,
        validate: { notEmpty: { msg: 'Question must not be empty' } },
      },
      correct_opts: {
        type: DataTypes.STRING,
        validate: { notEmpty: { msg: 'Correct options must not be empty' } },
      },
      image_url: DataTypes.STRING,
      opt1: DataTypes.TEXT,
      opt2: DataTypes.TEXT,
      opt3: DataTypes.TEXT,
      opt4: DataTypes.TEXT,
      opt5: DataTypes.TEXT,
      opt6: DataTypes.TEXT,
    },
    {
      sequelize,
      modelName: 'Quiz',
    }
  );
  return Quiz;
};
