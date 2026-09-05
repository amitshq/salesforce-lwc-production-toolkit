const { jestConfig } = require('@salesforce/sfdx-lwc-jest/config');

module.exports = {
  ...jestConfig,
  moduleNameMapper: {
    ...(jestConfig.moduleNameMapper || {}),
    '^lightning/modal$': '<rootDir>/force-app/test/jest-mocks/lightning/modal'
  },
  setupFiles: [...(jestConfig.setupFiles || []), '<rootDir>/scripts/jest/setup.js'],
  collectCoverageFrom: [
    'force-app/main/default/lwc/**/*.js',
    '!force-app/main/default/lwc/**/__tests__/**'
  ]
};
