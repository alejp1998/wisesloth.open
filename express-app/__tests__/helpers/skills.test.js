/**
 * Tests for the skills/preferences helper.
 */
const { parseSkillsInput, MAX_SKILLS_PER_USER, MAX_SKILL_LENGTH } = require('../../helpers/skills');

describe('parseSkillsInput', () => {
  it('parses a JSON array string', () => {
    expect(parseSkillsInput('["math","physics","trig"]')).toEqual(['math', 'physics', 'trig']);
  });

  it('accepts an actual array', () => {
    expect(parseSkillsInput(['a', 'b'])).toEqual(['a', 'b']);
  });

  it('trims whitespace and collapses inner spaces', () => {
    expect(parseSkillsInput(['  calculus   ii  ', ' linear '])).toEqual(['calculus ii', 'linear']);
  });

  it('drops empty items and deduplicates case-insensitively', () => {
    expect(parseSkillsInput(['', '  ', 'Math', 'math', 'MATH'])).toEqual(['Math']);
  });

  it('returns [] for invalid JSON or non-array', () => {
    expect(parseSkillsInput('not json')).toEqual([]);
    expect(parseSkillsInput('42')).toEqual([]);
    expect(parseSkillsInput(null)).toEqual([]);
    expect(parseSkillsInput(undefined)).toEqual([]);
    expect(parseSkillsInput({})).toEqual([]);
  });

  it('truncates skills to MAX_SKILL_LENGTH', () => {
    const long = 'x'.repeat(500);
    const result = parseSkillsInput([long]);
    expect(result[0].length).toBe(MAX_SKILL_LENGTH);
  });

  it('caps the number of skills at MAX_SKILLS_PER_USER', () => {
    const many = Array.from({ length: 100 }, (_, i) => `skill-${i}`);
    const result = parseSkillsInput(many);
    expect(result.length).toBe(MAX_SKILLS_PER_USER);
  });
});
