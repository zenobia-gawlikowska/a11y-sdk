'use strict';

// eslint-plugin-svelte >= 3.0.0 required (v3 is flat-config-only)
// Installed by setup.sh: eslint-plugin-svelte@^3.0.0
// Requires Node >= 18.20.4 — setup.sh warns if below.
const svelte = require('eslint-plugin-svelte');

module.exports = [
  ...svelte.configs.recommended.map((config) => ({
    ...config,
    files: ['**/*.svelte'],
  })),
];
