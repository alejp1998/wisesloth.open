'use strict';

const fs = require('fs');
const vm = require('vm');
const sequelize = require('../../models');
const { fetchAI } = require('../../helpers/ai-client');

describe('browser-direct AI', () => {
  test('preparation never reads the saved key or checks host spending', async () => {
    const transaction = jest.spyOn(sequelize, 'transaction');
    const recorded = jest.spyOn(sequelize.models.AiUsageLog, 'create');
    const call = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ browserAIPlan: { model: 'gemini/gemini-3.8-flash' } })));
    const req = { session: { user: { id: 'user' } }, body: { browserAI: JSON.stringify({ mode: 'prepare', model: 'gemini/gemini-3.8-flash' }) } };
    const response = await fetchAI(req, 'http://ai:5000/v1/tests/notes', { method: 'POST', body: new FormData() });
    expect((await response.json()).browserAIPlan).toBeDefined();
    expect(call.mock.calls[0][1].headers).toEqual({ 'X-Browser-AI-Mode': 'prepare', 'X-Browser-AI-Model': 'gemini/gemini-3.8-flash' });
    expect(transaction).not.toHaveBeenCalled();
    expect(recorded).not.toHaveBeenCalled();
  });

  test('browser results have zero host cost and do not trust browser billing', async () => {
    const record = jest.spyOn(sequelize.models.AiUsageLog, 'create').mockResolvedValue({});
    const call = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ success: true, completion: { costUsd: 999, tokens: { total: 999 } } })));
    const req = { session: { user: { id: 'user' } }, body: { browserAI: { mode: 'complete', model: 'openai/gpt-6-luna', content: '{"name":"quiz"}' } } };
    await fetchAI(req, 'http://ai:5000/v1/tests/notes', { method: 'POST', body: new FormData() });
    expect(call.mock.calls[0][1].body.get('_browser_completion')).toBe('{"name":"quiz"}');
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'browser', costUsd: 0, totalTokens: 0 }));
  });

  test('invalid browser mode fails without any provider call', async () => {
    const call = jest.spyOn(global, 'fetch');
    await expect(fetchAI({ session: { user: { id: 'user' } }, body: { browserAI: { mode: 'invalid', model: 'openai/gpt-6-luna' } } },
      'http://ai:5000/v1/tests/notes', { body: new FormData() })).rejects.toThrow('Invalid browser AI');
    expect(call).not.toHaveBeenCalled();
  });

  test.each(['openai/gpt-6-luna', 'gemini/gemini-3.8-flash'])('the %s key goes only to its provider', async model => {
    const calls = [];
    const nativeFetch = jest.fn(async (url, options) => {
      calls.push({ url, options });
      if (calls.length === 1) {return new Response(JSON.stringify({ browserAIPlan: { model,
        messages: [{ role: 'system', content: 'Generate a quiz' }, { role: 'user', content: 'Study content' }],
        schema: { type: 'object', properties: { name: { type: 'string' } } }, maxOutputTokens: 1000 } }));}
      if (calls.length === 2) {return new Response(JSON.stringify(model.startsWith('openai/')
        ? { choices: [{ message: { content: '{"name":"Quiz"}' } }] }
        : { candidates: [{ content: { parts: [{ text: '{"name":"Quiz"}' }] } }] }));}
      return new Response(JSON.stringify({ success: true }));
    });
    const window = { fetch: nativeFetch, location: { origin: 'https://quiz.example.org' }, username: 'reader', isLoggedIn: true };
    const document = { addEventListener: jest.fn(), getElementById: () => null };
    vm.runInNewContext(fs.readFileSync(require.resolve('../../public/scripts/browser-ai.js'), 'utf8'),
      { window, document, FormData, URL, AbortSignal });
    window.wsBrowserAI.enable(model, 'private-user-key');
    await window.wsBrowserAI.fetch('/api/tests/new', { method: 'POST', body: JSON.stringify({ type: 'notes', text: 'Study content' }) });
    expect(calls).toHaveLength(3);
    expect(JSON.stringify(calls[0])).not.toContain('private-user-key');
    expect(JSON.stringify(calls[2])).not.toContain('private-user-key');
    expect(calls[1].url).toMatch(model.startsWith('openai/') ? /^https:\/\/api.openai.com\// : /^https:\/\/generativelanguage.googleapis.com\//);
    expect(calls[1].options.credentials).toBe('omit');
    expect(JSON.stringify(calls[1].options.headers)).toContain('private-user-key');
    window.wsBrowserAI.clear();
    await window.wsBrowserAI.fetch('/api/tests/new', { method: 'POST', body: '{}' });
    expect(calls[3].options.body).toBe('{}');
  });
});
