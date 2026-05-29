'use strict';

// eslint-plugin-vuejs-accessibility >= 2.3.0 + eslint-plugin-vue required
// Installed by setup.sh: eslint-plugin-vuejs-accessibility@^2.3.0 eslint-plugin-vue
const pluginVueA11y = require('eslint-plugin-vuejs-accessibility');

module.exports = [
  ...pluginVueA11y.configs['flat/recommended'].map((config) => ({
    ...config,
    files: ['**/*.vue'],
  })),
];
