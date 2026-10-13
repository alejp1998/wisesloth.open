'use strict';

// REQUIRES
const uuid = require('uuid');

// MODELS
const { models } = require('../models');
const { UserSkill, UserSkillConfig } = models;

// HELPERS
const { MAX_SKILLS_PER_USER, MAX_SKILL_LENGTH, MAX_SKILL_DESCRIPTION_LENGTH, parseSkillsInput, normalizeSkillConfig } = require('../helpers/skills');

// Normalize the semicolon-separated types field to a clean canonical string
function normalizeTypes(value) {
  return String(value || '')
    .split(';')
    .map((t) => t.trim().toLowerCase().replace(/\s+/g, '-'))
    .filter(Boolean)
    .slice(0, 12)
    .join(';');
}

// AUXILIARY FUNCTIONS

// Get the logged-in user's id or respond 401
function requireUser(req, res) {
  const ssnUser = req.session.user;
  if (!ssnUser) {
    res.status(401).json({ success: false, error: 'Login required' });
    return null;
  }
  return ssnUser;
}

// GET /api/skills
// List the current user's skills (ordered by creation date)
exports.listSkills = async (req, res, next) => {
  try {
    const ssnUser = requireUser(req, res);
    if (!ssnUser) return;

    const skills = await UserSkill.findAll({
      where: { userId: ssnUser.id },
      order: [['createdAt', 'ASC']],
    });

    return res.json({
      success: true,
      skills: skills.map((s) => ({ id: s.id, skill: s.skill, description: s.description || '', types: s.types || 'always' })),
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/skills
// Add a new skill (free text) for the current user
exports.addSkill = async (req, res, next) => {
  try {
    const ssnUser = requireUser(req, res);
    if (!ssnUser) return;

    const skill = String(req.body.skill || '').trim().replace(/\s+/g, ' ').slice(0, MAX_SKILL_LENGTH);
    if (!skill) {
      return res.status(400).json({ success: false, error: 'Skill cannot be empty' });
    }
    const description = String(req.body.description || '').trim().slice(0, MAX_SKILL_DESCRIPTION_LENGTH);
    const types = normalizeTypes(req.body.types);

    const count = await UserSkill.count({ where: { userId: ssnUser.id } });
    if (count >= MAX_SKILLS_PER_USER) {
      return res.status(400).json({ success: false, error: `You can have at most ${MAX_SKILLS_PER_USER} skills` });
    }

    const existing = await UserSkill.findOne({ where: { userId: ssnUser.id, skill } });
    if (existing) {
      return res.status(400).json({ success: false, error: 'You already have that skill' });
    }

    const created = await UserSkill.create({
      id: uuid.v4(),
      userId: ssnUser.id,
      skill,
      description,
      types: types || 'always',
    });

    return res.json({ success: true, skill: { id: created.id, skill: created.skill, description: created.description || '', types: created.types || 'always' } });
  } catch (error) {
    next(error);
  }
};

// PUT /api/skills/:id
// Edit an existing skill (only the owner)
exports.updateSkill = async (req, res, next) => {
  try {
    const ssnUser = requireUser(req, res);
    if (!ssnUser) return;

    const skill = String(req.body.skill || '').trim().replace(/\s+/g, ' ').slice(0, MAX_SKILL_LENGTH);
    if (!skill) {
      return res.status(400).json({ success: false, error: 'Skill cannot be empty' });
    }
    const description = String(req.body.description || '').trim().slice(0, MAX_SKILL_DESCRIPTION_LENGTH);
    const types = normalizeTypes(req.body.types);

    const existing = await UserSkill.findOne({
      where: { id: req.params.id, userId: ssnUser.id },
    });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Skill not found' });
    }

    await existing.update({ skill, description, types: types || 'always' });

    return res.json({ success: true, skill: { id: existing.id, skill: existing.skill, description: existing.description || '', types: existing.types || 'always' } });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/skills/:id
// Delete a skill (only the owner)
exports.deleteSkill = async (req, res, next) => {
  try {
    const ssnUser = requireUser(req, res);
    if (!ssnUser) return;

    const existing = await UserSkill.findOne({
      where: { id: req.params.id, userId: ssnUser.id },
    });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Skill not found' });
    }

    await existing.destroy();
    return res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

// GET /api/skills/config
// Return the current user's per-creation-type skill config (empty object if none saved)
exports.getSkillConfig = async (req, res, next) => {
  try {
    const ssnUser = requireUser(req, res);
    if (!ssnUser) return;

    const record = await UserSkillConfig.findOne({ where: { userId: ssnUser.id } });
    return res.json({ success: true, config: record ? normalizeSkillConfig(record.config) : normalizeSkillConfig({}) });
  } catch (error) {
    next(error);
  }
};

// PUT /api/skills/config
// Save the current user's per-creation-type skill config
exports.updateSkillConfig = async (req, res, next) => {
  try {
    const ssnUser = requireUser(req, res);
    if (!ssnUser) return;

    const config = normalizeSkillConfig(req.body.config);

    let record = await UserSkillConfig.findOne({ where: { userId: ssnUser.id } });
    if (!record) {
      record = await UserSkillConfig.create({ id: uuid.v4(), userId: ssnUser.id, config });
    } else {
      await record.update({ config });
    }

    return res.json({ success: true, config: record.config });
  } catch (error) {
    next(error);
  }
};

// Used by test/flashcard creation to append the user's selected skills to the AI request
exports.appendSkillsToFormData = (req, formData) => {
  const skills = parseSkillsInput(req.body.skills);
  if (skills.length) {
    formData.append('skills', JSON.stringify(skills));
  }
};
