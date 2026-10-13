'use strict';

const { hashPassword, verifyPassword, encryptApiKey, decryptApiKey } = require('../../helpers/credentials');
const { safeJson } = require('../../helpers/safe-json');
const { canReadTest } = require('../../helpers/test-access');
const { isPublicAddress, extractText, resolvePublicUrl } = require('../../helpers/link-source');
const { weekStart, parseBudget, assertBudget } = require('../../helpers/spending');
const { sameOrigin } = require('../../middleware/same-origin');
const { models } = require('../../models');

describe('self-hosted credentials', () => {
  test('scrypt uses independent salts and accepts the exact password only', async () => {
    const password = 'A long <password> with spaces';
    const first = await hashPassword(password);
    expect(await hashPassword(password)).not.toEqual(first);
    expect(await verifyPassword(password, first)).toBe(true);
    expect(await verifyPassword(password.trim() + '!', first)).toBe(false);
    expect(await verifyPassword(password, 'malformed')).toBe(false);
    await expect(hashPassword('short')).rejects.toThrow();
  });
  test('API keys are authenticated ciphertext with random nonces', () => {
    process.env.KEY_ENCRYPTION_SECRET = 'ab'.repeat(32);
    const encrypted = encryptApiKey('provider-key-for-tests');
    expect(encrypted).not.toContain('provider-key');
    expect(encryptApiKey('provider-key-for-tests')).not.toEqual(encrypted);
    expect(decryptApiKey(encrypted)).toBe('provider-key-for-tests');
    process.env.KEY_ENCRYPTION_SECRET = 'cd'.repeat(32);
    expect(() => decryptApiKey(encrypted)).toThrow();
  });
  test('public User queries exclude credentials and personal limits', () => {
    const excluded = models.User.options.defaultScope.attributes.exclude;
    expect(excluded).toEqual(expect.arrayContaining(['passwordHash', 'apiKeyEncrypted', 'weeklyBudgetUsd']));
  });
});

describe('sharing permissions', () => {
  const owner = { id: 'owner' };
  const outsider = { id: 'other', favoriteIds: ['quiz'], triedIds: ['quiz'] };
  test('private quizzes stay private even after a previous attempt or favorite', () => {
    const quiz = { id: 'quiz', userId: 'owner', visibility: 'private' };
    expect(canReadTest(quiz, null)).toBe(false);
    expect(canReadTest(quiz, outsider)).toBe(false);
    expect(canReadTest(quiz, owner)).toBe(true);
    expect(canReadTest(quiz, { id: 'admin', isAdmin: true })).toBe(true);
  });
  test('public and follower sharing have distinct access', () => {
    expect(canReadTest({ visibility: 'public' }, null)).toBe(true);
    const quiz = { userId: 'owner', visibility: 'followers' };
    expect(canReadTest(quiz, outsider)).toBe(false);
    expect(canReadTest(quiz, { id: 'other', iFollowIds: ['owner'] })).toBe(true);
  });
  test('JSON in script tags cannot terminate a script element', () => {
    const value = { name: '</script><img src=x onerror=alert(1)>', text: '\u2028' };
    const encoded = safeJson(value);
    expect(encoded).not.toContain('<');
    expect(JSON.parse(encoded)).toEqual(value);
  });
});

describe('link imports', () => {
  test.each(['127.0.0.1', '10.1.2.3', '169.254.169.254', '192.168.1.1', '0.0.0.0',
    '100.64.0.1', '::1', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1', '2001:db8::1'])('rejects %s', address => {
    expect(isPublicAddress(address)).toBe(false);
  });
  test('allows routable addresses', () => {
    expect(isPublicAddress('8.8.8.8')).toBe(true);
    expect(isPublicAddress('2606:4700:4700::1111')).toBe(true);
  });
  test('rejects credentials and non-HTTP schemes before networking', async () => {
    await expect(resolvePublicUrl('file:///etc/passwd')).rejects.toThrow();
    await expect(resolvePublicUrl('https://user:password@example.com')).rejects.toThrow();
    await expect(resolvePublicUrl('http://example.com:1234')).rejects.toThrow();
  });
  test('extracts article content without scripts or navigation', () => {
    const result = extractText('<nav>Menu</nav><article><h1>Title</h1><p>Facts &amp; examples.</p><script>bad()</script></article>', 'text/html');
    expect(result).toContain('Title');
    expect(result).toContain('Facts & examples.');
    expect(result).not.toContain('bad()');
    expect(result).not.toContain('Menu');
  });
});

describe('spending and browser mutations', () => {
  test('UTC Monday boundary is independent of server timezone', () => {
    expect(weekStart(new Date('2026-10-18T23:59:59Z')).toISOString()).toBe('2026-10-12T00:00:00.000Z');
    expect(weekStart(new Date('2026-10-19T00:00:00Z')).toISOString()).toBe('2026-10-19T00:00:00.000Z');
  });
  test('unlimited, paused and positive budgets are distinct', () => {
    expect(parseBudget('')).toBeNull();
    expect(parseBudget('0')).toBe(0);
    expect(parseBudget('1.123456')).toBe(1.123456);
    for (const value of ['-1', 'NaN', 'Infinity', '1e3', '0x10', '1.1234567']) {
      expect(() => parseBudget(value)).toThrow();
    }
  });
  test('instance and individual limits both gate requests', async () => {
    const sum = jest.spyOn(models.AiUsageLog, 'sum').mockResolvedValue(2);
    await expect(assertBudget({ id: 'a', weeklyBudgetUsd: null }, { weeklyBudgetUsd: null })).resolves.toBeUndefined();
    await expect(assertBudget({ id: 'a', weeklyBudgetUsd: 2 }, { weeklyBudgetUsd: null })).rejects.toThrow('Your weekly');
    await expect(assertBudget({ id: 'a', weeklyBudgetUsd: null }, { weeklyBudgetUsd: 2 })).rejects.toThrow('instance weekly');
    sum.mockRestore();
  });
  test('browser writes reject a foreign or missing Origin', () => {
    process.env.APP_URL = 'http://localhost:8080';
    for (const origin of ['https://evil.example', undefined]) {
      const req = { method: 'POST', get: () => origin };
      const res = global.testUtils.mockResponse();
      const next = jest.fn();
      sameOrigin(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    }
    const next = jest.fn();
    sameOrigin({ method: 'POST', get: () => 'http://localhost:8080' }, global.testUtils.mockResponse(), next);
    expect(next).toHaveBeenCalled();
  });
});
