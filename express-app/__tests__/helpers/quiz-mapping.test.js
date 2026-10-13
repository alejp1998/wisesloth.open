/**
 * Tests for the quiz shape mapping helpers used by the AI per-question edit.
 */

const { mapQuizToAIQuestion, mapAIQuestionToQuiz } = require('../../helpers/quiz-mapping');

describe('mapQuizToAIQuestion', () => {
  it('maps DB fields into the AI payload shape', () => {
    const dbQuiz = {
      question: 'What is 2+2?',
      opt1: '3', opt2: '4', opt3: '5', opt4: '', opt5: '', opt6: '[Exp]Math.',
      correct_opts: '2',
    };
    expect(mapQuizToAIQuestion(dbQuiz)).toEqual({
      question: 'What is 2+2?',
      opt1: '3', opt2: '4', opt3: '5', opt4: '', opt5: '',
      opt6: '[Exp]Math.',
      correct_opts: '2',
    });
  });

  it('defaults missing fields to empty strings', () => {
    expect(mapQuizToAIQuestion({})).toEqual({
      question: '', opt1: '', opt2: '', opt3: '', opt4: '', opt5: '', opt6: '',
      correct_opts: '',
    });
  });
});

describe('mapAIQuestionToQuiz', () => {
  it('maps letters back to 1-based option numbers and prefixes explanations', () => {
    const content = {
      q: 'What is 2+2?',
      a: '3', b: '4', c: '5', d: '', e: '',
      exp: 'Four is correct.',
      correctOpts: ['b'],
    };
    expect(mapAIQuestionToQuiz(content, null)).toEqual({
      question: 'What is 2+2?',
      opt1: '3', opt2: '4', opt3: '5', opt4: '', opt5: '',
      opt6: '[Exp]Four is correct.',
      correct_opts: '2',
    });
  });

  it('maps multiple correct answers and handles uppercase letters', () => {
    const content = {
      q: 'Pick both', a: 'x', b: 'y', c: 'z', d: '', e: '',
      exp: '', correctOpts: ['A', 'C'],
    };
    expect(mapAIQuestionToQuiz(content, null)).toEqual({
      question: 'Pick both',
      opt1: 'x', opt2: 'y', opt3: 'z', opt4: '', opt5: '',
      opt6: '',
      correct_opts: '1,3',
    });
  });

  it('falls back to the previous correct_opts when the AI returns none', () => {
    const content = { q: 'Q', a: '1', b: '2', exp: '', correctOpts: [] };
    const fallback = { question: 'Q', correct_opts: '1', opt6: '' };
    const result = mapAIQuestionToQuiz(content, fallback);
    expect(result.correct_opts).toBe('1');
  });

  it('falls back to the previous question when the AI returns empty', () => {
    const content = { q: '', a: '1', b: '2', exp: '', correctOpts: ['a'] };
    const fallback = { question: 'Original question', correct_opts: '1' };
    const result = mapAIQuestionToQuiz(content, fallback);
    expect(result.question).toBe('Original question');
  });
});
