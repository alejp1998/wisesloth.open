'use strict';

// Helpers for translating between the DB quiz shape
// ({ question, opt1..opt6, correct_opts }) and the LLM quiz-edit shape
// ({ q, a..e, exp, correctOpts }).

// Map a DB-shaped quiz to the payload sent to the AI quiz-edit endpoint
function mapQuizToAIQuestion(quiz) {
  return {
    question: quiz.question || '',
    opt1: quiz.opt1 || '', opt2: quiz.opt2 || '', opt3: quiz.opt3 || '',
    opt4: quiz.opt4 || '', opt5: quiz.opt5 || '', opt6: quiz.opt6 || '',
    correct_opts: quiz.correct_opts || '',
  };
}

// Map the AI quiz-edit response ({ q, a..e, exp, correctOpts }) back to DB shape.
// `fallback` (the previous DB-shaped quiz) is used for fields the AI left empty.
function mapAIQuestionToQuiz(content, fallback) {
  const correctOpts = (content.correctOpts || [])
    .map((letter) => {
      const num = String(letter).toLowerCase().charCodeAt(0) - 96;
      return (num >= 1 && num <= 6) ? num : null;
    })
    .filter((num) => num !== null)
    .join(',');

  return {
    question: content.q || (fallback && fallback.question) || '',
    opt1: content.a || '', opt2: content.b || '', opt3: content.c || '',
    opt4: content.d || '', opt5: content.e || '',
    opt6: content.exp ? '[Exp]' + content.exp : '',
    correct_opts: correctOpts || (fallback && fallback.correct_opts) || '',
  };
}

module.exports = { mapQuizToAIQuestion, mapAIQuestionToQuiz };
