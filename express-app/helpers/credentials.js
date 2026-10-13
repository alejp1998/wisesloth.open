'use strict';

const crypto = require('crypto');
const { promisify } = require('util');
const scrypt = promisify(crypto.scrypt);

async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 256) {
    throw new Error('Use a password between 12 and 256 characters.');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64);
  return `scrypt:${salt}:${hash.toString('hex')}`;
}

async function verifyPassword(password, stored) {
  if (typeof password !== 'string' || password.length > 256 || !stored) return false;
  const [algorithm, salt, encoded] = stored.split(':');
  if (algorithm !== 'scrypt' || !salt || !/^[a-f0-9]{128}$/.test(encoded || '')) return false;
  const hash = await scrypt(password, salt, 64);
  return crypto.timingSafeEqual(hash, Buffer.from(encoded, 'hex'));
}

function keyEncryptionSecret() {
  const secret = process.env.KEY_ENCRYPTION_SECRET;
  if (!secret || !/^[a-f0-9]{64}$/i.test(secret)) {
    throw new Error('KEY_ENCRYPTION_SECRET must contain 64 hexadecimal characters.');
  }
  return Buffer.from(secret, 'hex');
}

function encryptApiKey(value) {
  if (!value) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyEncryptionSecret(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(b => b.toString('base64')).join('.');
}

function decryptApiKey(value) {
  if (!value) return null;
  const [iv, tag, encrypted] = value.split('.').map(b => Buffer.from(b, 'base64'));
  const cipher = crypto.createDecipheriv('aes-256-gcm', keyEncryptionSecret(), iv);
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(encrypted), cipher.final()]).toString('utf8');
}

function validateUsername(username) {
  return typeof username === 'string' && /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(username)
    && !username.startsWith('deleted-');
}

module.exports = { hashPassword, verifyPassword, encryptApiKey, decryptApiKey, validateUsername };
