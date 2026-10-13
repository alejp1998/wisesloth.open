'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class UserSkillConfig extends Model {
    /**
     * Helper function for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(_models) {
      // define association here
    }
  }
  UserSkillConfig.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        allowNull: false,
        validate: { notEmpty: { msg: 'Id must not be empty' } },
      },
      userId: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: { notEmpty: { msg: 'User id must not be empty' } },
      },
      // Per-creation-type + always skill selections, e.g.
      // { oldexam: [...], notes: [...], instructions: [...], flashcards: [...], personality: [...], always: [...] }
      config: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {},
      },
    },
    {
      sequelize,
      modelName: 'UserSkillConfig',
    }
  );
  return UserSkillConfig;
};
