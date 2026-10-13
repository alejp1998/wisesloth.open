'use strict';

// JSON embedded in script tags needs more than HTML-escaping or JSON.stringify:
// a literal closing script tag ends the element even inside a quoted string.
function safeJson(value) {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, character =>
    `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

module.exports = { safeJson };
