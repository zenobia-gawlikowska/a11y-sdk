'use strict';

// eslint-plugin-jsx-a11y >= 6.9.0 required
// Installed by setup.sh: eslint-plugin-jsx-a11y@^6.9.0
const jsxA11y = require('eslint-plugin-jsx-a11y');

module.exports = [
  {
    ...jsxA11y.flatConfigs.recommended,
    files: ['**/*.{jsx,tsx}'],
  },
];
