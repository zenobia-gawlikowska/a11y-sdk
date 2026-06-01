'use strict';

// @angular-eslint/eslint-plugin-template >= 18.0.0 required
// @angular-eslint/template-parser >= 18.0.0 required (HTML template parser)
// Installed by setup.sh: @angular-eslint/eslint-plugin-template@^18.0.0 @angular-eslint/template-parser@^18.0.0
const angular = require('@angular-eslint/eslint-plugin-template');
const angularTemplateParser = require('@angular-eslint/template-parser');

module.exports = [
  {
    ...angular.configs.accessibility,
    files: ['**/*.html'],
    languageOptions: {
      parser: angularTemplateParser,
    },
  },
];
