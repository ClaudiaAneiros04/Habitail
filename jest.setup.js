// jest.setup.js
import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

// Mock global de expo-sqlite para aislar la capa de base de datos durante las pruebas unitarias
jest.mock('expo-sqlite', () => {
  return {
    openDatabaseAsync: jest.fn().mockResolvedValue({
      execAsync: jest.fn().mockResolvedValue(undefined),
      runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 }),
      getFirstAsync: jest.fn().mockResolvedValue(null),
      getAllAsync: jest.fn().mockResolvedValue([]),
      withTransactionAsync: jest.fn(async (callback) => await callback()),
    }),
  };
});

// Mock global de expo-crypto para generación de UUIDs RFC4122 en tests
jest.mock('expo-crypto', () => ({
  randomUUID: () => {
    const crypto = require('crypto');
    return crypto.randomUUID();
  },
}));
