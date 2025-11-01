// Jest setup file for additional test configuration
// This file runs before each test file

// Mock expo modules if needed
jest.mock("expo-constants", () => ({
  expoConfig: {},
}));

// Silence console warnings during tests (optional)
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};
