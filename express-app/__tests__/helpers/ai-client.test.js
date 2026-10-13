'use strict';

const sequelize = require('../../models');
const { fetchAI } = require('../../helpers/ai-client');
const { encryptApiKey } = require('../../helpers/credentials');

describe('central AI billing', () => {
  let recorded;
  let instance;
  let user;
  beforeEach(() => {
    recorded = [];
    instance = { weeklyBudgetUsd: null };
    user = { id: 'user', weeklyBudgetUsd: null };
    jest.spyOn(sequelize, 'transaction').mockImplementation(async callback => callback({ LOCK: { UPDATE: 'UPDATE' } }));
    jest.spyOn(sequelize.models.InstanceSettings, 'findByPk').mockImplementation(async () => instance);
    jest.spyOn(sequelize.models.User, 'unscoped').mockReturnValue({ findByPk: async () => user });
    jest.spyOn(sequelize.models.AiUsageLog, 'sum').mockResolvedValue(0);
    jest.spyOn(sequelize.models.AiUsageLog, 'create').mockImplementation(async data => { recorded.push(data); return data; });
  });
  test('records failed charged responses and never persists the key', async () => {
    process.env.KEY_ENCRYPTION_SECRET = 'aa'.repeat(32);
    user.apiKeyEncrypted = encryptApiKey('test-key-secret');
    const fetch = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      success: false, error: 'invalid content', usage: { tokens: { total: 100 }, costUsd: 0.05, model: 'test-model' },
    })));
    const req = { session: { user: { id: 'user' } } };
    await fetchAI(req, 'http://ai:5000/v1/tests/notes', { method: 'POST' });
    expect(fetch.mock.calls[0][1].headers['X-Provider-Key']).toBe('test-key-secret');
    expect(recorded[0]).toMatchObject({ costUsd: 0.05, totalTokens: 100, outcome: 'error' });
    expect(JSON.stringify(recorded)).not.toContain('test-key-secret');
  });
  test('zero budget prevents paid requests entirely', async () => {
    user.weeklyBudgetUsd = 0;
    const fetch = jest.spyOn(global, 'fetch');
    await expect(fetchAI({ session: { user: { id: 'user' } } }, 'http://ai:5000/v1/tests/notes', {})).rejects.toThrow('weekly spending');
    expect(fetch).not.toHaveBeenCalled();
    expect(recorded).toHaveLength(0);
  });
  test('transport failures record an uncertain cost instead of zero', async () => {
    process.env.UNCERTAIN_REQUEST_COST_USD = '1';
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network failure'));
    const response = await fetchAI({ session: { user: { id: 'user' } } }, 'http://ai:5000/v1/tests/notes', {});
    expect(response.status).toBe(502);
    expect(recorded[0]).toMatchObject({ costUsd: 1, outcome: 'uncertain' });
  });
  test('preserves uncertain billing reported by a provider timeout', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      success: false, usage: { costUsd: 1, outcome: 'uncertain' },
    })));
    await fetchAI({ session: { user: { id: 'user' } } }, 'http://ai:5000/v1/tests/notes', {});
    expect(recorded[0]).toMatchObject({ costUsd: 1, outcome: 'uncertain' });
  });
});
