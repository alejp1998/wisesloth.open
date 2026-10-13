'use strict';

const dns = require('dns').promises;
const http = require('http');
const https = require('https');
const ipaddr = require('ipaddr.js');
const cheerio = require('cheerio');

function isPublicAddress(address) {
  try { return ipaddr.process(address).range() === 'unicast'; }
  catch (_error) { return false; }
}

async function resolvePublicUrl(raw) {
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password
      || (url.port && url.port !== (url.protocol === 'https:' ? '443' : '80'))) {
    throw new Error('Use a public HTTP(S) link on its standard port, without credentials.');
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(a => !isPublicAddress(a.address))) {
    throw new Error('Links to private, local, or reserved network addresses are not allowed.');
  }
  return { url, address: addresses.find(item => item.family === 4) || addresses[0] };
}

async function fetchLink(raw, redirects = 0) {
  if (typeof raw !== 'string' || raw.length > 2048) throw new Error('Invalid source link.');
  const { url, address } = await resolvePublicUrl(raw);
  const result = await new Promise((resolve, reject) => {
    const request = (url.protocol === 'https:' ? https : http).get(url, {
      agent: false,
      // Pin the vetted address; the socket never performs a second DNS lookup.
      lookup: (_host, options, callback) => callback(null,
        options.all ? [address] : address.address, options.all ? undefined : address.family),
      headers: { 'User-Agent': 'WiseSloth.open/1.0', 'Accept-Encoding': 'identity' },
    }, response => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        response.resume();
        return resolve({ redirect: response.headers.location });
      }
      if (response.statusCode !== 200) {
        response.resume();
        return reject(new Error(`Source returned HTTP ${response.statusCode}.`));
      }
      const type = (response.headers['content-type'] || '').split(';')[0].trim();
      if (!['text/html', 'text/plain', 'text/markdown', 'application/xhtml+xml'].includes(type)) {
        response.resume();
        return reject(new Error('Import supports public HTML, Markdown and plain text. Upload PDFs using the PDF tab.'));
      }
      const chunks = [];
      let size = 0;
      response.on('data', chunk => {
        size += chunk.length;
        if (size > 2 * 1024 * 1024) request.destroy(new Error('Source is larger than 2 MB.'));
        else chunks.push(chunk);
      });
      response.on('error', reject);
      response.on('end', () => resolve({ type, body: Buffer.concat(chunks).toString('utf8') }));
    });
    const timer = setTimeout(() => request.destroy(new Error('Source fetch timed out.')), 10000);
    request.on('close', () => clearTimeout(timer));
    request.on('error', reject);
  });
  if (result.redirect) {
    if (redirects >= 3) throw new Error('Too many source redirects.');
    return fetchLink(new URL(result.redirect, url).href, redirects + 1);
  }
  return { text: extractText(result.body, result.type), url: url.href };
}

function extractText(body, type) {
  if (type === 'text/plain' || type === 'text/markdown') return body.trim();
  const $ = cheerio.load(body);
  $('script, style, noscript, iframe, svg, nav, footer, header, form').remove();
  $('br').replaceWith('\n');
  $('p, li, h1, h2, h3, h4, tr, section').append('\n');
  const main = $('article, main').first();
  return (main.length ? main.text() : $('body').text()).replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n').trim();
}

async function appendSource(body) {
  if (!body.sourceUrl) return;
  if (body.type && !['notes', 'old-exam'].includes(body.type)) throw new Error('Links are supported for notes, exams and flashcards.');
  let source;
  try { source = await fetchLink(body.sourceUrl); }
  catch (error) { error.status = 400; throw error; }
  const text = [body.text || '', `Source: ${source.url}\n${source.text}`].filter(Boolean).join('\n\n');
  if (source.text.length < 100) throw new Error('The link did not contain enough readable text. Paste its text instead.');
  if (text.length > 50000) throw new Error('Combined source exceeds 50,000 characters. Use a shorter page or paste an excerpt.');
  body.text = text;
}

module.exports = { isPublicAddress, resolvePublicUrl, fetchLink, extractText, appendSource };
