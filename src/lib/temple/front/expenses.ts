import { encodeAddress } from '@mavrykdynamics/webmavryk-utils';
import BigNumber from 'bignumber.js';

import { OperationsPreview } from 'lib/temple/types';

export type RawOperationAssetExpense = {
  tokenAddress?: string;
  tokenId?: number;
  amount: BigNumber;
  to?: string;
};
export type RawOperationExpenses = {
  amount?: number;
  delegate?: string;
  type: string;
  isEntrypointInteraction: boolean;
  contractAddress?: string;
  expenses: RawOperationAssetExpense[];
};

const STAKING_ENTRYPOINTS = ['stake', 'unstake', 'finalize_unstake', 'staking'];
// Display types that describe a protocol operation and must never come from a dApp-chosen entrypoint name
const PROTOCOL_DISPLAY_TYPES = ['transaction', 'delegation', 'origination', ...STAKING_ENTRYPOINTS];
const CONTRACT_CALL_TYPE = 'contract_call';

export function tryParseExpenses(operations: OperationsPreview, accountAddress: string) {
  return tryParseExpensesPure(operations, accountAddress);
}

function tryParseExpensesPure(operations: OperationsPreview, accountAddress: string): RawOperationExpenses[] {
  // Forged content (rawToSign, sign preview) is a `{ branch, contents }` object; dApp/wallet op params are an array
  const isForged = !Array.isArray(operations);
  const operationsAsArray = isForged ? operations.contents : operations;
  return (Array.isArray(operationsAsArray) ? operationsAsArray : [])
    .map<RawOperationExpenses | undefined>(operation => mapExpensesArray(operation, accountAddress, isForged))
    .filter((x): x is RawOperationExpenses => !!x);
}

const mapExpensesArray = (operation: any, accountAddress: string, isForged: boolean) => {
  if (operation.destination) {
    operation = { ...operation, to: operation.destination };
  }

  const { kind, source: from, to, amount } = operation;
  const entrypoint = getParameters(operation)?.entrypoint;
  const type = getDisplayType(kind, entrypoint, to === accountAddress && (!from || from === accountAddress));
  const isEntrypointInteraction = !!entrypoint;
  const parsedAmount = amount !== undefined ? Number(amount) : undefined;
  if (!kind) {
    return undefined;
  }
  if (kind === 'delegation') {
    return {
      amount: 0,
      delegate: operation.delegate,
      type,
      isEntrypointInteraction: false,
      expenses: []
    };
  }
  if (from && from !== accountAddress) {
    return {
      amount: parsedAmount,
      type,
      isEntrypointInteraction,
      expenses: []
    };
  }
  if (kind === 'increase_paid_storage') {
    // `amount` is a storage size in bytes, not mumav: it must never be shown as a MVRK amount or expense.
    return { amount: undefined, type, isEntrypointInteraction: false, expenses: [] };
  }
  if (kind === 'origination') {
    const balance = getOriginationBalance(operation, isForged);
    return {
      amount: balance?.toNumber(),
      type,
      isEntrypointInteraction: false,
      expenses: balance ? [{ amount: balance, to: undefined }] : []
    };
  }
  const expenses: RawOperationAssetExpense[] = [];
  if (amount) {
    expenses.push({ amount: new BigNumber(amount), to });
  }
  if (['transfer', 'approve'].includes(type)) {
    extendExpenses(type, operation, expenses);
  }

  return {
    amount: parsedAmount,
    type,
    isEntrypointInteraction,
    contractAddress: isEntrypointInteraction ? to : undefined,
    expenses
  };
};

// Real stake pseudo-operations always target the signing account (webmavryk wallet.stake/unstake/finalizeUnstake)
const getDisplayType = (kind: string, entrypoint: string | undefined, isToSigner: boolean) => {
  if (kind !== 'transaction' || !entrypoint) return kind;
  if (STAKING_ENTRYPOINTS.includes(entrypoint) && isToSigner) return entrypoint;
  return PROTOCOL_DISPLAY_TYPES.includes(entrypoint) ? CONTRACT_CALL_TYPE : entrypoint;
};

// Forged contents and params flagged `mumav` hold the balance in mumav; other origination params hold whole MVRK,
// as webmavryk createOriginationOperation expects. The unit must not be inferred from dApp-controlled fields.
const getOriginationBalance = (operation: any, isForged: boolean) => {
  if (operation.balance === undefined) return undefined;
  const balance = new BigNumber(operation.balance);
  return isForged || operation.mumav === true ? balance : balance.times(1e6);
};

// The parser emits a zero-amount placeholder leg to every called contract, and zero-amount %transfer legs carry a
// dApp-chosen recipient that moves nothing; any leg that moves value keeps its recipient. Zero-amount approve legs
// stay, since approving 0 revokes an allowance.
export const getExpenseReceivers = ({
  type,
  expenses,
  contractAddress
}: {
  type?: string;
  expenses: Pick<RawOperationAssetExpense, 'amount' | 'to'>[];
  contractAddress?: string;
}) => [
  ...new Set(
    expenses.flatMap(({ to, amount }) =>
      to && !(new BigNumber(amount).isZero() && (to === contractAddress || type === 'transfer')) ? [to] : []
    )
  )
];

const extendExpenses = (type: any, operation: any, expenses: RawOperationAssetExpense[]) => {
  if (type === 'transfer' && getParameters(operation)?.value instanceof Array) {
    const internalTransfers = getParameters(operation).value;
    internalTransfers.forEach((transfersBatch: any) => {
      transfersBatch.args[1].forEach((transfer: any) => {
        expenses.push({
          tokenAddress: operation.to,
          amount: new BigNumber(transfer.args[1].args[1].int),
          tokenId: Number(transfer.args[1].args[0].int),
          to: readMichelsonAddress(transfer.args[0])
        });
      });
    });
  } else {
    const tokenAddress = operation.to;
    let args = getParameters(operation)?.value?.args;
    while (args?.[0]?.prim) {
      args = args?.[0]?.args;
    }
    while (args?.[1]?.prim) {
      args = args?.[1]?.args;
    }
    const to = readMichelsonAddress(args?.[0]);
    const amount = args?.[1]?.int;
    if ([tokenAddress, to, amount].every(value => typeof value === 'string')) {
      expenses.push({
        tokenAddress,
        amount: new BigNumber(amount),
        to
      });
    }
  }
};

/**
 * Read a Michelson address node in either readable (`string`) or optimized (`bytes`) form. A dApp can encode the
 * recipient as bytes; reading only strings would hide the transfer from the preview.
 *
 * @returns the base58 address, or undefined when the node is not a decodable address
 */
function readMichelsonAddress(node: any): string | undefined {
  if (typeof node?.string === 'string') return node.string;
  if (typeof node?.bytes !== 'string' || !/^[0-9a-fA-F]{44,}$/.test(node.bytes)) return undefined;
  try {
    // The first 22 bytes are the address; any remainder is an entrypoint suffix.
    return encodeAddress(node.bytes.slice(0, 44));
  } catch {
    return undefined;
  }
}

function getParameters(op: any) {
  return op?.parameters ?? op?.parameter;
}
