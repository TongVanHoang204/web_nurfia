module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.cjs'],
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: { module: 'CommonJS', moduleResolution: 'node', allowJs: true } }],
  },
  transformIgnorePatterns: ['/node_modules/(?!htmlparser2/|domhandler/|domutils/|domelementtype/|entities/|dom-serializer/)'],
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  setupFiles: ['<rootDir>/tests/setup.cjs'],
  clearMocks: true,
  restoreMocks: true,
};
