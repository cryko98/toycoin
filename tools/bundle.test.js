'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { isCurrent, SOURCES } = require('./bundle');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('js/bundle.js and index.html are in sync with the sources (run `npm run bundle`)', () => {
  assert.ok(isCurrent());
});

test('the page loads the hashed bundle and stylesheet, not the individual sources', () => {
  assert.match(html, /<script src="js\/bundle\.js\?v=[0-9a-f]{10}"><\/script>/);
  assert.match(html, /href="css\/style\.css\?v=[0-9a-f]{10}"/);
  for (const f of SOURCES) assert.ok(!html.includes(`src="${f}"`), `${f} should not be loaded separately`);
  assert.match(html, /<link rel="icon"[^>]*href="data:image\/png;base64,/);
});
