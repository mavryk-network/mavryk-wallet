export const MOCK_PK_KEY = new Uint8Array([109, 111, 99, 107, 32, 101, 100, 112, 107, 115, 105, 103]);
export const MOCK_SK_KEY = new Uint8Array([109, 111, 99, 107, 32, 101, 100, 115, 107, 115, 105, 103]);

export const mockSodiumUtil = {
  crypto_generichash: jest.fn(() => new Uint8Array([109, 111, 99, 107, 32, 115, 116, 114, 105, 110, 103])),
  crypto_sign_seed_keypair: jest.fn(() => ({
    privateKey: new Uint8Array(Buffer.from('444e1f4ab90c304a5ac003d367747aab63815f583ff2330ce159d12c1ecceba1')),
    publicKey: new Uint8Array(Buffer.from('444e1f4ab90c304a5ac003d367747aab63815f583ff2330ce159d12c1ecceba1')),
    keyType: 'ed'
  })),
  crypto_sign_ed25519_pk_to_curve25519: jest.fn(() => MOCK_PK_KEY),
  crypto_sign_ed25519_sk_to_curve25519: jest.fn(() => MOCK_SK_KEY),
  crypto_kx_client_session_keys: jest.fn(() => ({
    sharedRx: new Uint8Array(),
    sharedTx: new Uint8Array()
  })),
  crypto_kx_server_session_keys: jest.fn(() => ({
    sharedRx: new Uint8Array(),
    sharedTx: new Uint8Array()
  })),
  crypto_secretbox_open_easy: jest.fn(
    () => new Uint8Array([109, 111, 99, 107, 32, 115, 101, 99, 114, 101, 116, 98, 111, 120])
  ),
  crypto_secretbox_easy: jest.fn(
    () => new Uint8Array([109, 111, 99, 107, 32, 115, 101, 99, 114, 101, 116, 98, 111, 120, 32, 101, 97, 115, 121])
  ),
  randombytes_buf: jest.fn(
    () => new Uint8Array([109, 111, 99, 107, 32, 114, 97, 110, 100, 111, 109, 98, 121, 116, 101, 115])
  ),
  crypto_box_seal: jest.fn(
    () => new Uint8Array([109, 111, 99, 107, 32, 99, 114, 121, 112, 116, 111, 98, 111, 120, 32, 115, 101, 97, 108])
  )
};

jest.mock('libsodium-wrappers', () => ({
  ...jest.requireActual('libsodium-wrappers'),
  ...mockSodiumUtil
}));
