module.exports = {
  preset: 'react-native',
  setupFiles: ['./jest.setup.js'],
  testMatch: ['<rootDir>/src/__tests__/**/*.test.{ts,tsx}'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.test.json',
        babelConfig: true,
      },
    ],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native' +
      '|@react-native' +
      '|@react-navigation' +
      '|react-native-vector-icons' +
      '|react-native-screens' +
      '|react-native-safe-area-context' +
      '|react-native-gesture-handler' +
      '|@tanstack/react-query' +
      ')/)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/__tests__/**',
    '!src/types/**',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
