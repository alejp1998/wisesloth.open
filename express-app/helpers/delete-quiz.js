// MODELS
const { models } = require('../models');
const { Quiz } = models;

// AUXILIARY CONSTANTS
const API_URL = (process.env.AI_API_URL || 'http://fastapi-api:5000') + '/v1/';

// Delete image from local storage
const deleteImage = async (quizId) => {
  // Build form data
  const formData = new FormData();
  formData.append('quizId', quizId);
  // Send a POST request to API
  await fetch(API_URL + 'images/quiz/delete', {
    method: 'POST',
    body: formData,
  });
};

// Deletes a quiz from DB and its image from local storage
const deleteQuiz = async (quizId) => {
  // Get the quiz from the DB
  const quiz = await Quiz.findByPk(quizId,
    {
      attributes: ['id', 'image_url'],
    }
  );

  // Delete image from local storage
  if (quiz.image_url) {
    await deleteImage(quizId);
  }

  // Delete quiz from DB
  await quiz.destroy();
};

// Delete all quizzes of a test
const deleteQuizzesByTest = async (testId) => {
  // Get all quizzes of the test
  const quizzes = await Quiz.findAll({
    where: {
      testId: testId,
    },
    attributes: ['id'],
  });

  // Delete each quiz
  await Promise.all(quizzes.map((quiz) => deleteQuiz(quiz.id)));
};

// Delete all quizzes of a user
const deleteQuizzesByUser = async (userId) => {
  // Get all quizzes of the user
  const quizzes = await Quiz.findAll({
    where: {
      userId: userId,
    },
    attributes: ['id'],
  });

  // Delete each quiz
  await Promise.all(quizzes.map((quiz) => deleteQuiz(quiz.id)));
};

exports.deleteQuiz = deleteQuiz;
exports.deleteQuizzesByTest = deleteQuizzesByTest;
exports.deleteQuizzesByUser = deleteQuizzesByUser;
