'use strict';
module.exports = (sequelize, DataTypes) => sequelize.define('InstanceSettings', {
  id: { type: DataTypes.STRING, primaryKey: true },
  weeklyBudgetUsd: { type: DataTypes.DECIMAL(12, 6), allowNull: true },
});
