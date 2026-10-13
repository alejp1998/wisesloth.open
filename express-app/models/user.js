'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(_models) {
      // define association here
    }
  }

  User.init(
    {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
        unique: true,
        validate: { notEmpty: { msg: 'User id must not be empty.' } },
      },
      username: {
        type: DataTypes.STRING,
        unique: true,
        validate: { notEmpty: { msg: 'Username must not be empty.' } },
      },
      email: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: true,
        validate: { notEmpty: { msg: 'Email must not be empty.' } },
        defaultValue: null,
      },
      name: {
        type: DataTypes.STRING,
      },
      desc: {
        type: DataTypes.STRING,
      },
      birthDate: {
        type: DataTypes.DATE,
      },
      passwordHash: { type: DataTypes.TEXT, allowNull: true },
      apiKeyEncrypted: { type: DataTypes.TEXT, allowNull: true },
      weeklyBudgetUsd: { type: DataTypes.DECIMAL(12, 6), allowNull: true },
      isAdmin: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      isEditor: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: 'User',
      defaultScope: { attributes: { exclude: ['passwordHash', 'apiKeyEncrypted', 'weeklyBudgetUsd', 'email'] } },
    }
  );

  return User;
};
