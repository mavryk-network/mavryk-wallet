require('@testing-library/jest-dom');

const { Crypto, CryptoKey } = require('@peculiar/webcrypto');

const cryptoInstance = new Crypto();
Object.defineProperty(globalThis, 'crypto', {
  value: cryptoInstance,
  writable: true,
  configurable: true
});
Object.defineProperty(globalThis, 'CryptoKey', {
  value: CryptoKey,
  writable: true,
  configurable: true
});

jest.mock('lib/temple/repo', () => ({
  db: {
    delete: jest.fn(),
    open: jest.fn()
  }
}));
