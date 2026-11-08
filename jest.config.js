const { jestConfig } = require('@salesforce/sfdx-lwc-jest/config');

module.exports = {
  ...jestConfig,
  moduleNameMapper: {
    ...(jestConfig.moduleNameMapper || {}),
    '^lightning/modal$': '<rootDir>/force-app/test/jest-mocks/lightning/modal',
    // Test-only parent components (not deployed: force-app/test/** is in .forceignore)
    '^c/modalTestHost$': '<rootDir>/force-app/test/jest-fixtures/modalTestHost/modalTestHost'
  },
  setupFiles: [...(jestConfig.setupFiles || []), '<rootDir>/scripts/jest/setup.js'],
  collectCoverageFrom: [
    'force-app/main/default/lwc/**/*.js',
    '!force-app/main/default/lwc/**/__tests__/**'
  ]
};
