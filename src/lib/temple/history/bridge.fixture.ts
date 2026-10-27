import type { MavrykHistoryOperation } from 'mavryk/api/history';

export const BRIDGE_WALLET = 'mv1BridgeWallet';
export const BRIDGE_TOKEN = 'KT1Pn5Zpx1bJx5H51btk92pfwvUMCKtp2Q2v';
export const BRIDGE_CONTRACT = 'KT1Tw3ckFCD9zQQxzHbU2KY9gm4hkCXkwJUg';

/** Complete API summary with two independently priced movements. */
export const bridgeFixture = (): MavrykHistoryOperation => ({
  hash: 'ooBridge',
  type: 'transaction',
  status: 'applied',
  sender: BRIDGE_WALLET,
  details: {
    type: 'interaction',
    entrypoint: 'mint',
    contract: BRIDGE_CONTRACT,
    transferType: 'received',
    tokenAddress: BRIDGE_TOKEN,
    tokenId: '0',
    to: BRIDGE_WALLET,
    amount: '121.8',
    currency: 'wUSDT',
    usdAmount: 121.64,
    transfers: ['120.582', '1.218'].map((amount, index) => ({
      movementKind: 'mint',
      transferType: 'received',
      tokenAddress: BRIDGE_TOKEN,
      tokenId: '0',
      to: BRIDGE_WALLET,
      amount,
      rawAmount: index === 0 ? '120582000' : '1218000',
      currency: 'wUSDT',
      usdAmount: index === 0 ? 120.42 : 1.22
    }))
  }
});
