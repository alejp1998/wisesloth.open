(function () {
  'use strict';
  const nativeFetch = window.fetch.bind(window);
  const models = new Set(['openai/gpt-6-luna', 'gemini/gemini-3.8-flash', 'gemini/gemini-3.5-flash-lite']);
  let active = null;

  function updateStatus() {
    const status = document.getElementById('browser-ai-status');
    if (status) status.textContent = active ? `Active in this tab: ${active.model}.` : 'Browser key is disconnected.';
  }

  function clear() {
    active = null;
    updateStatus();
  }

  function enable(model, key) {
    if (!models.has(model) || typeof key !== 'string' || !key.trim() || key.length > 512) {
      throw new Error('Choose a supported model and enter your provider key.');
    }
    active = { model, key: key.trim(), account: window.username };
    updateStatus();
  }

  function withBrowserConfig(options, config) {
    if (options.body instanceof FormData) {
      const body = new FormData();
      for (const [name, value] of options.body.entries()) body.append(name, value);
      body.set('browserAI', JSON.stringify(config));
      return { ...options, body };
    }
    const body = JSON.parse(options.body);
    return { ...options, body: JSON.stringify({ ...body, browserAI: config }) };
  }

  async function callProvider(config, plan) {
    if (plan.model !== config.model || !Array.isArray(plan.messages) || !plan.schema) {
      throw new Error('The application returned an invalid browser AI plan.');
    }
    let endpoint, headers, body;
    if (config.model.startsWith('openai/')) {
      endpoint = 'https://api.openai.com/v1/chat/completions';
      headers = { Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json' };
      body = { model: config.model.slice(7), messages: plan.messages, reasoning_effort: 'none',
        max_completion_tokens: plan.maxOutputTokens,
        response_format: { type: 'json_schema', json_schema: { name: 'study_material', strict: true, schema: plan.schema } } };
    } else {
      endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${config.model.slice(7)}:generateContent`;
      headers = { 'x-goog-api-key': config.key, 'Content-Type': 'application/json' };
      body = { systemInstruction: { parts: [{ text: plan.messages.find(m => m.role === 'system').content }] },
        contents: [{ role: 'user', parts: [{ text: plan.messages.find(m => m.role === 'user').content }] }],
        generationConfig: { maxOutputTokens: plan.maxOutputTokens, responseMimeType: 'application/json', responseJsonSchema: plan.schema } };
    }
    const response = await nativeFetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body),
      credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(90000) });
    if (!response.ok) throw new Error(`Provider request failed (${response.status}). Check your key, quota and billing in the provider dashboard.`);
    const result = await response.json();
    const content = config.model.startsWith('openai/') ? result.choices?.[0]?.message?.content
      : result.candidates?.[0]?.content?.parts?.filter(part => !part.thought).map(part => part.text || '').join('');
    if (!content || content.length > 500000) throw new Error('Provider returned an empty or oversized result.');
    JSON.parse(content);
    return content;
  }

  async function fetchAI(url, options) {
    if (!active) return nativeFetch(url, options);
    if (active.account !== window.username || !window.isLoggedIn) {
      clear();
      throw new Error('Sign in and reconnect your browser key.');
    }
    const target = new URL(url, window.location.origin);
    if (target.origin !== window.location.origin || !/^\/api\/tests\/(new|new-flashcards|edit-quiz-ai|edit-flashcard-ai|edit-test-ai)$/.test(target.pathname)) {
      throw new Error('Unsupported browser AI action.');
    }
    const config = active;
    const prepared = await nativeFetch(url, withBrowserConfig(options, { mode: 'prepare', model: config.model }));
    const payload = await prepared.clone().json();
    if (!prepared.ok || !payload.browserAIPlan) return prepared;
    const content = await callProvider(config, payload.browserAIPlan);
    if (active !== config) throw new Error('Browser key disconnected before the result was saved.');
    return nativeFetch(url, withBrowserConfig(options, { mode: 'complete', model: config.model, content }));
  }

  document.addEventListener('submit', event => {
    if (event.target.id !== 'browser-ai-form') return;
    event.preventDefault();
    const input = document.getElementById('browser-api-key');
    try {
      enable(document.getElementById('browser-ai-model').value, input.value);
      input.value = '';
    } catch (error) {
      document.getElementById('browser-ai-status').textContent = error.message;
    }
  });
  document.addEventListener('click', event => {
    if (event.target.closest('#browser-ai-disconnect')) clear();
  });
  document.addEventListener('DOMContentLoaded', updateStatus);
  window.wsBrowserAI = { fetch: fetchAI, enable, clear, updateStatus, isActive: () => !!active };
})();
