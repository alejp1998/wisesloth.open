// Skills / preferences helpers.

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Max number of skills a user may keep
const MAX_SKILLS_PER_USER = 50;
// Max length of a single skill title (free text)
const MAX_SKILL_LENGTH = 200;
// Max length of a skill description (what the skill should do)
const MAX_SKILL_DESCRIPTION_LENGTH = 1000;

// Per-creation-type config keys for the skill selections (one array per type,
// plus "always" which applies regardless of creation type).
const SKILL_CONFIG_TYPES = ['oldexam', 'notes', 'instructions', 'personality', 'flashcards', 'always'];

// Default example skills are stored as YAML files in skills/defaults/ (one
// file per skill), loaded at startup. Each skill has a title, a long
// description of what the AI should actually do, and a semicolon-separated
// list of the generation types it affects (or "always").
const DEFAULTS_DIR = path.join(__dirname, '..', 'skills', 'defaults');

function loadDefaultSkills() {
  const skills = [];
  if (!fs.existsSync(DEFAULTS_DIR)) return skills;
  const files = fs.readdirSync(DEFAULTS_DIR).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml')).sort();
  for (const file of files) {
    try {
      const doc = yaml.load(fs.readFileSync(path.join(DEFAULTS_DIR, file), 'utf8'));
      if (!doc || !doc.title || !doc.description) continue;
      skills.push({
        title: String(doc.title).trim().replace(/\s+/g, ' '),
        types: String(doc.types || 'always').trim().toLowerCase(),
        description: String(doc.description).trim(),
      });
    } catch (e) {
      console.error('Failed to load default skill YAML:', file, e.message);
    }
  }
  return skills;
}

const DEFAULT_SKILLS = loadDefaultSkills();

/**
 * Normalize a skills input (JSON array string or actual array) into a validated
 * list of trimmed, deduplicated skill strings. Accepts plain strings or
 * { title, description } objects (title is used as the identity).
 * @param {string|Array} value - JSON array string or array from the request body
 * @returns {string[]}
 */
function parseSkillsInput(value) {
  let arr = value;
  if (typeof value === 'string' && value.trim()) {
    try {
      arr = JSON.parse(value);
    } catch (e) {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  const seen = new Set();
  const result = [];
  for (const item of arr) {
    const raw = typeof item === 'object' && item !== null ? item.title : item;
    const skill = String(raw || '').trim().replace(/\s+/g, ' ').slice(0, MAX_SKILL_LENGTH);
    if (!skill || seen.has(skill.toLowerCase())) continue;
    seen.add(skill.toLowerCase());
    result.push(skill);
  }
  return result.slice(0, MAX_SKILLS_PER_USER);
}

/**
 * Normalize a per-type skill config object into a validated config with every
 * known key present as an array of skill strings. Unknown keys are dropped.
 * @param {Object} input - raw config object, e.g. { oldexam: [...], always: [...] }
 * @returns {Object} - { oldexam: [], notes: [], instructions: [], personality: [], flashcards: [], always: [] }
 */
function normalizeSkillConfig(input) {
  const config = {};
  for (const key of SKILL_CONFIG_TYPES) {
    config[key] = parseSkillsInput(input && input[key]);
  }
  return config;
}

module.exports = {
  MAX_SKILLS_PER_USER,
  MAX_SKILL_LENGTH,
  MAX_SKILL_DESCRIPTION_LENGTH,
  SKILL_CONFIG_TYPES,
  DEFAULT_SKILLS,
  parseSkillsInput,
  normalizeSkillConfig,
};
