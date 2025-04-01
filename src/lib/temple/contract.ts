import { MavrykToolkit } from '@mavrykdynamics/taquito';
import memoizee from 'memoizee';

export const loadContract = memoizee(fetchContract, {
  promise: true,
  max: 100
});

function fetchContract(tezos: MavrykToolkit, address: string, walletAPI = true) {
  return walletAPI ? tezos.wallet.at(address) : tezos.contract.at(address);
}
