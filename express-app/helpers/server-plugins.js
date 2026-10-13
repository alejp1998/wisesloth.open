'use strict';

const fs = require('fs');
const path = require('path');
const UglifyJS = require('uglify-js');
const scripts = ['general-actions', 'browser-ai', 'customize', 'login-logout', 'index', 'tests/test-index'];

function buildAssets() {
  for (const name of scripts) {
    const source = path.join(__dirname, '../public/scripts', name + '.js');
    const target = path.join(__dirname, '../public/scripts', name + '.min.js');
    const code = fs.readFileSync(source, 'utf8');
    if (process.env.NODE_ENV === 'production') {
      const result = UglifyJS.minify(code);
      if (result.error) throw new Error(`Could not build ${name}: ${result.error.message}`);
      fs.writeFileSync(target, result.code, 'utf8');
    } else {
      fs.writeFileSync(target, code, 'utf8');
    }
  }
}

module.exports = { buildAssets };
