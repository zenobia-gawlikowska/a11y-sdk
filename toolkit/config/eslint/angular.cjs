'use strict';

// @angular-eslint/eslint-plugin-template >= 18.0.0 required
// @angular-eslint/template-parser >= 18.0.0 required (HTML template parser)
// Installed by setup.sh: @angular-eslint/eslint-plugin-template@^18.0.0 @angular-eslint/template-parser@^18.0.0
const angular = require('@angular-eslint/eslint-plugin-template');
const angularTemplateParser = require('@angular-eslint/template-parser');

// angular.configs.accessibility uses eslintrc format (plugins as string array,
// top-level parser). Rebuild as a valid flat config object manually.
module.exports = [
  {
    files: ['**/*.html'],
    plugins: { '@angular-eslint/template': angular },
    languageOptions: { parser: angularTemplateParser },
    rules: angular.configs.accessibility.rules,
  },
];
