import type { MavrykHistoryOperation } from 'mavryk/api/history';

export const PURCHASE_WALLET = 'mv1DXLvsp4T7X6gXLHn7szGN7WLooy14fQ3G';
export const PURCHASE_ASSET = 'KT19PyrK3NKTiAfjxPJwhswgzkiMeQuawkFc';
export const PAYMENT_ASSET = 'KT1Pn5Zpx1bJx5H51btk92pfwvUMCKtp2Q2v';
const RECIPIENT = 'mv19MAVgCDwzuNMWprbHrUZhznoH8n9NWGWt';
const CONTRACT = 'KT1U6KXwy8vduoq86HBjGp9m2Czc8rZM85MN';
const HASH = 'oodorTRhJuY8Pb7pLsWuQE6meZGE5uRFXdCKUpiKerh2M5Yu7Ca';
const common = {
  hash: HASH,
  level: 6873611,
  timestamp: '2026-10-19T09:00:10Z',
  type: 'transaction',
  status: 'applied',
  amount: 0
};

/** Recorded purchase fields from fixes.md; unspecified transport fields are deliberately omitted. */
export function purchaseFixture(): MavrykHistoryOperation {
  return {
    ...common,
    type: 'interaction',
    details: {
      type: 'interaction',
      from: PURCHASE_WALLET,
      to: RECIPIENT,
      tokenAddress: PAYMENT_ASSET,
      entrypoint: 'purchase',
      contract: CONTRACT,
      amount: 6,
      currency: 'WUSDT',
      usdAmount: 0
    },
    networkFees: { totalFee: 0.010438, gasFee: 0.006188, storageFee: 0.00425, burnedFromFees: 0.00425 },
    operations: [
      {
        ...common,
        id: 65453111115776,
        sender: PURCHASE_WALLET,
        target: CONTRACT,
        parameter: {
          entrypoint: 'purchase',
          value: {
            amount: '200000',
            payment: 'USDT',
            launchName: 'KRKN-issuance-v1',
            saleOption: 'Starter',
            maxTotalPayment: '6000000'
          }
        }
      },
      {
        ...common,
        id: 65453112164352,
        sender: CONTRACT,
        target: PURCHASE_ASSET,
        parameter: { entrypoint: 'mint', value: [{ owner: PURCHASE_WALLET, amount: '200000', token_id: '0' }] }
      },
      ...['5940000', '60000'].map((amount, index) => ({
        ...common,
        id: [65453113212928, 65453114261504][index],
        sender: CONTRACT,
        target: PAYMENT_ASSET,
        parameter: {
          entrypoint: 'transfer',
          value: [{ from_: PURCHASE_WALLET, txs: [{ to_: RECIPIENT, amount, token_id: '0' }] }]
        }
      }))
    ]
  };
}

export const PURCHASE_DECIMALS = { [`${PURCHASE_ASSET}_0`]: 6, [`${PAYMENT_ASSET}_0`]: 6 };
