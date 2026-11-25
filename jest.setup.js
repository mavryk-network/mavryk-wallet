const { Crypto, CryptoKey } = require('@peculiar/webcrypto');
const { TextDecoder, TextEncoder } = require('util');

Object.assign(global, {
  crypto: new Crypto(),
  CryptoKey,
  TextDecoder,
  TextEncoder
});

jest.mock('lib/temple/repo', () => ({
  db: {
    delete: jest.fn(),
    open: jest.fn()
  }
}));
