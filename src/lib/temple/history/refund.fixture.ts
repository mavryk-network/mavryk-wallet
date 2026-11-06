import type { MavrykHistoryOperation } from 'mavryk/api/history';

export const REFUND_WALLET = 'refund-wallet';
export const REFUND_TOKEN = 'KT1PXS6bacaVGHHWCQtvNSvoGL9Daho3ozcp';

/** Relevant API fields from refunnd.json, with account and operation identifiers removed. */
export const refundFixture = (): MavrykHistoryOperation => ({
  hash: 'refund-operation',
  type: 'interaction',
  status: 'applied',
  details: {
    type: 'interaction',
    transferType: 'received',
    from: 'refund-contract',
    to: REFUND_WALLET,
    tokenAddress: REFUND_TOKEN,
    tokenId: 0,
    rawAmount: '4260000',
    amount: 4.26,
    currency: 'OCEAN',
    entrypoint: 'processRefund'
  },
  operations: [
    {
      id: 1,
      hash: 'refund-operation',
      type: 'interaction',
      status: 'applied',
      sender: REFUND_WALLET,
      target: 'refund-contract',
      amount: 0,
      parameter: { entrypoint: 'processRefund' }
    },
    {
      id: 2,
      hash: 'refund-operation',
      type: 'interaction',
      status: 'applied',
      sender: 'refund-contract',
      target: REFUND_TOKEN,
      amount: 0,
      parameter: {
        entrypoint: 'transfer',
        value: [{ from_: 'refund-contract', txs: [{ to_: REFUND_WALLET, amount: '4260000', token_id: '0' }] }]
      }
    }
  ]
});
