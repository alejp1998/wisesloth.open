'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Favorite extends Model {}

  Favorite.init(
    {
      // Sequelize automatically manages 'id' as the primary key in join tables
      userId: {
        type: DataTypes.STRING,
        allowNull: false,
        references: { model: 'User', key: 'id' },
      },
      testId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'Test', key: 'id' },
      },
    },
    {
      sequelize,
      modelName: 'Favorite',
      tableName: 'favorites', // Specify the table name if needed
      timestamps: true, // Consider removing timestamps if not needed
    }
  );

  return Favorite;
};
