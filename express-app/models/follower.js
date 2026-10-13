'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Follower extends Model {}

  Follower.init(
    {
      // Sequelize automatically manages 'id' as the primary key in join tables
      followerId: {
        type: DataTypes.STRING,
        allowNull: false,
        references: { model: 'User', key: 'id' },
      },
      followedId: {
        type: DataTypes.STRING,
        allowNull: false,
        references: { model: 'User', key: 'id' },
      },
    },
    {
      sequelize,
      modelName: 'Follower',
      tableName: 'followers', // Specify the table name if needed
      timestamps: true, // Consider removing timestamps if not needed
    }
  );

  return Follower;
};
