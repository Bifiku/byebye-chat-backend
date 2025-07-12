export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/test/**/auth.e2e.spec.ts'],
  setupFilesAfterEnv: ['./test/setup.ts'],
};
