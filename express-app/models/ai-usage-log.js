'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class AiUsageLog extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(_models) {
      // define association here
    }
  }
  AiUsageLog.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        allowNull: false,
        validate: { notEmpty: { msg: 'Id must not be empty' } },
      },
      userId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      testId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      // Generation or editing endpoint that produced this usage.
      action: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      // The configured model used for this request.
      model: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      promptTokens: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      completionTokens: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      costUsd: { type: DataTypes.DECIMAL(14, 8), allowNull: false, defaultValue: 0 },
      outcome: { type: DataTypes.STRING, allowNull: false, defaultValue: 'success' },
      totalTokens: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
    },
    {
      sequelize,
      modelName: 'AiUsageLog',
    }
  );
  return AiUsageLog;
};
