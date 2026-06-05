'use strict';

// eslint-plugin-svelte >= 3.0.0 required (v3 is flat-config-only)
// Installed by setup.sh: eslint-plugin-svelte@^3.0.0
// Requires Node >= 18.20.4 — setup.sh warns if below.
//
// Svelte's a11y rules are built into the Svelte compiler itself, not the ESLint
// plugin. The `svelte/valid-compile` rule runs the compiler and promotes its
// a11y warnings (a11y-alt-text, a11y-click-events-have-key-events, etc.) to
// ESLint errors. It is not included in `recommended` so we add it explicitly.
const svelte = require('eslint-plugin-svelte');

module.exports = [
  ...svelte.configs['flat/recommended'].map((config) => ({
    ...config,
    files: ['**/*.svelte'],
  })),
  {
    files: ['**/*.svelte'],
    rules: {
      'svelte/valid-compile': 'error',
    },
  },
];
