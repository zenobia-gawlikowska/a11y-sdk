'use strict';

// @angular-eslint/eslint-plugin-template >= 18.0.0 required
// Installed by setup.sh: @angular-eslint/eslint-plugin-template@^18.0.0
const angular = require('@angular-eslint/eslint-plugin-template');

module.exports = [
  {
    ...angular.configs.templateAccessibility,
    files: ['**/*.html'],
  },
];
