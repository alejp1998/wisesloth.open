'use strict';

// REQUIRES
const { Op } = require('sequelize');

// MODELS
const { models } = require('../models');
const { Test, Flashcard } = models;

// HELPERS
const { checkUserCanCreate, recordAiUsage } = require('../helpers/ai-edit-usage');

// AI service API base URL (FastAPI)
const API_URL = (process.env.AI_API_URL || 'http://fastapi-api:5000') + '/v1/';
const { fetchAI } = require('../helpers/ai-client');


// AUXILIARY FUNCTIONS

// Check that the session user is the author of the test (or an admin)
async function ensureCanEdit(req, testId) {
  const ssnUser = req.session.user;
  if (!ssnUser) return { ok: false, status: 401, error: 'You must log in to edit flashcards' };

  const test = await Test.findByPk(testId);
  if (!test) return { ok: false, status: 404, error: 'Test not found' };

  const isAuthor = test.userId === ssnUser.id;
  const isAdmin = !!ssnUser.isAdmin;
  if (!isAuthor && !isAdmin) {
    return { ok: false, status: 403, error: 'Only the author or an admin can edit these flashcards' };
  }
  return { ok: true, test };
}

// POST /api/tests/update-flashcards
// Batch-save flashcards: upsert provided cards, delete listed ids
exports.updateFlashcardsAPI = async (req, res, _next) => {
  const { testId, cards, deletedIds } = req.body;

  try {
    const auth = await ensureCanEdit(req, testId);
    if (!auth.ok) return res.status(auth.status).json({ success: false, error: auth.error });
    const test = auth.test;

    if (!Array.isArray(cards)) {
      return res.status(400).json({ success: false, error: 'cards parameter must be an array' });
    }
    if (cards.length === 0) {
      return res.status(400).json({ success: false, error: 'You must have at least one flashcard' });
    }

    // Validate cards
    for (const card of cards) {
      if (!card.id) return res.status(400).json({ success: false, error: 'Each card must have an id' });
      if (!card.front || !card.front.trim()) return res.status(400).json({ success: false, error: 'Each card must have a front side' });
      if (!card.back || !card.back.trim()) return res.status(400).json({ success: false, error: 'Each card must have a back side' });
      if (typeof card.front === 'string' && card.front.length > 2000) return res.status(400).json({ success: false, error: 'Card front is too long' });
      if (typeof card.back === 'string' && card.back.length > 5000) return res.status(400).json({ success: false, error: 'Card back is too long' });
    }

    // Upsert each card
    for (const card of cards) {
      const values = {
        number: card.number || 1,
        front: card.front.trim(),
        back: card.back.trim(),
        image_url: card.image_url || '',
      };
      const existing = await Flashcard.findByPk(card.id);
      if (existing) {
        await existing.update(values);
      } else {
        await Flashcard.create({ id: card.id, testId: test.id, userId: test.userId, ...values });
      }
    }

    // Delete removed cards
    if (Array.isArray(deletedIds) && deletedIds.length > 0) {
      await Flashcard.destroy({ where: { id: { [Op.in]: deletedIds }, testId: test.id } });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Error in updateFlashcardsAPI:', error);
    return res.status(500).json({ success: false, error: 'Internal server error: ' + error });
  }
};

// POST /api/tests/edit-flashcard-ai
// Applies an AI edit to a single flashcard (returns edited front/back for review)
exports.editFlashcardAI = async (req, res, _next) => {
  const { testId, flashcardId, instruction } = req.body;

  try {
    const auth = await ensureCanEdit(req, testId);
    if (!auth.ok) return res.status(auth.status).json({ success: false, error: auth.error });

    if (!flashcardId || !instruction) {
      return res.status(400).json({ success: false, error: 'flashcardId and instruction parameters are required' });
    }
    if (typeof instruction !== 'string' || instruction.length > 500) {
      return res.status(400).json({ success: false, error: 'Instruction must be a string of at most 500 characters' });
    }

    const flashcard = await Flashcard.findByPk(flashcardId);
    if (!flashcard || flashcard.testId !== testId) {
      return res.status(404).json({ success: false, error: 'Flashcard not found' });
    }

    // Require an existing signed-in account.
    const tokenCheck = await checkUserCanCreate(req, 'an AI edit');
    if (!tokenCheck.ok) {
      return res.status(tokenCheck.status).json({ success: false, error: tokenCheck.error });
    }

    // Call the FastAPI flashcard-edit endpoint
    const formData = new FormData();
    formData.append('front', flashcard.front);
    formData.append('back', flashcard.back);
    formData.append('instruction', instruction);

    const response = await fetchAI(req, API_URL + 'tests/flashcard-edit', {
      method: 'POST',
      body: formData,
    });
    const responseData = await response.json();
    if (responseData.browserAIPlan) return res.json(responseData);

    if (!responseData.success) {
      return res.status(400).json({ success: false, error: responseData.error });
    }

    const content = responseData.completion.content;

    // Return usage already recorded by the AI client.
    const usage = await recordAiUsage({
      user: tokenCheck.user,
      ssnUser: req.session.user,
      testId,
      action: 'flashcard_edit',
      tokensUsed: responseData.completion.tokens,
      model: responseData.completion.model,
    });

    return res.json({
      success: true,
      flashcard: {
        front: content.front || flashcard.front,
        back: content.back || flashcard.back,
      },
      tokensUsed: usage.tokensUsed,
      costUsd: req.aiUsage?.costUsd || 0,
    });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, error: error.message });
    console.error('Error in editFlashcardAI:', error);
    return res.status(500).json({ success: false, error: 'Internal server error: ' + error });
  }
};
