'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Test extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(_models) {
      // define association here
    }
  }
  Test.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        allowNull: false,
        validate: { notEmpty: { msg: 'Id must not be empty' } },
      },
      name: {
        type: DataTypes.STRING,
        validate: { notEmpty: { msg: 'Name must not be empty' } },
      },
      language: {
        type: DataTypes.STRING
      },
      userId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      topic: {
        type: DataTypes.STRING,
        validate: { notEmpty: { msg: 'Topic must not be empty' } },
      },
      desc: {
        type: DataTypes.TEXT,
        validate: { notEmpty: { msg: 'Description must not be empty' } },
      },
      context: {
        type: DataTypes.TEXT,
      },
      promptTokens: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      completionTokens: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      visibility : {
        type: DataTypes.STRING,
        defaultValue: 'public', // public, followers, private
      },
      hideAnswers: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      type: {
        type: DataTypes.STRING,
        defaultValue: 'knowledge', // knowledge, personality, flashcards
      },
      // Content that was used to generate the test (notes/old-exam text, from-scratch
      // instructions). Stored for future AI-assisted edits; admin-only in the UI.
      // LONGTEXT: source notes can be up to 100k chars, which exceeds TEXT's 64KB.
      creationContent: {
        type: DataTypes.TEXT('long'),
      },
      // Initial creation guidelines summary (what the user asked for when creating).
      creationGuidelines: {
        type: DataTypes.TEXT,
      },
    },
    {
      sequelize,
      modelName: 'Test',
    }
  );
  return Test;
};
