'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Flashcard extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(_models) {
      // define association here
    }
  }
  Flashcard.init(
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
      front: {
        type: DataTypes.TEXT,
        validate: { notEmpty: { msg: 'Front must not be empty' } },
      },
      back: {
        type: DataTypes.TEXT,
        validate: { notEmpty: { msg: 'Back must not be empty' } },
      },
      image_url: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: 'Flashcard',
    }
  );
  return Flashcard;
};
