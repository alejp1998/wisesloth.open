'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class UserSkill extends Model {
    /**
     * Helper function for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(_models) {
      // define association here
    }
  }
  UserSkill.init(
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
      skill: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: { notEmpty: { msg: 'Skill must not be empty' } },
      },
      // Free-text description of what this skill/preference should do
      description: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: '',
      },
      // Types of generation this skill affects, semicolon-separated
      // (e.g. "oldexam;notes" or "always" for all types)
      types: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'always',
      },
    },
    {
      sequelize,
      modelName: 'UserSkill',
    }
  );
  return UserSkill;
};
