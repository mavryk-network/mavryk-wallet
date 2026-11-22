import { MavrykWalletDAppErrorType } from '@mavrykdynamics/mavryk-wallet-dapp/dist/types';

import { normalizeNetworkId, BASENET_NETWORK_ID } from 'lib/temple/network-storage';
import { NETWORKS } from 'lib/temple/networks';

import type { AnalyticsAssetType, AnalyticsNetwork, AnalyticsTxType } from './analytics-events.schema';

export interface AnalyticsOperationKind {
  tx_type: AnalyticsTxType;
  asset_type: AnalyticsAssetType;
}

const STAKING_ENTRYPOINTS = new Set(['stake', 'unstake', 'finalize_unstake']);

/**
 * Classifies operation params by kind only. Destinations, amounts and parameters never leave this function.
 * Accepts both wallet-side (`parameter`) and RPC/dApp-side (`parameters`) shapes; reveals are ignored.
 */
export function classifyOperations(opParams: unknown): AnalyticsOperationKind {
  const ops = (Array.isArray(opParams) ? opParams : []).filter(
    (op): op is Record<string, any> => Boolean(op) && typeof op === 'object' && op.kind !== 'reveal'
  );

  if (ops.length === 0) return { tx_type: 'other', asset_type: 'none' };
  if (ops.length > 1) return { tx_type: 'batch', asset_type: 'none' };

  const [op] = ops;

  switch (op.kind) {
    case 'delegation':
      return { tx_type: 'delegate', asset_type: 'none' };

    case 'origination':
      return { tx_type: 'origination', asset_type: 'none' };

    case 'transaction': {
      const entrypoint: unknown = (op.parameter ?? op.parameters)?.entrypoint;

      if (entrypoint === undefined || entrypoint === 'default') return { tx_type: 'send', asset_type: 'mvrk' };
      if (entrypoint === 'transfer') return { tx_type: 'send', asset_type: 'token' };
      if (typeof entrypoint === 'string' && STAKING_ENTRYPOINTS.has(entrypoint)) {
        return { tx_type: 'stake', asset_type: 'mvrk' };
      }

      return { tx_type: 'contract_call', asset_type: Number(op.amount) > 0 ? 'mvrk' : 'none' };
    }

    default:
      return { tx_type: 'other', asset_type: 'none' };
  }
}

const KNOWN_ERROR_MESSAGES = new Set<string>(Object.values(MavrykWalletDAppErrorType));
const SAFE_ERROR_CODE_PATTERN = /^[A-Za-z0-9_.]{1,100}$/;

/**
 * Reduces an error to a code that cannot carry user data: the protocol error id (without the protocol prefix),
 * a known wallet/dApp error type, or `unknown`. Raw messages and stacks are never returned.
 */
export function toAnalyticsErrorCode(error: unknown): string {
  const errors: unknown = (error as { errors?: unknown } | null)?.errors;

  if (Array.isArray(errors) && errors.length > 0) {
    const id: unknown = errors[errors.length - 1]?.id;

    if (typeof id === 'string') {
      const code = id.replace(/^proto\.[^.]+\./, '');
      if (SAFE_ERROR_CODE_PATTERN.test(code)) return code;
    }
  }

  if (error instanceof Error && KNOWN_ERROR_MESSAGES.has(error.message)) return error.message;

  return 'unknown';
}

const MAINNET_RPC_URL = NETWORKS.find(({ id }) => id === 'mainnet')?.rpcBaseURL;
const BASENET_RPC_URL = NETWORKS.find(({ id }) => id === BASENET_NETWORK_ID)?.rpcBaseURL;

const trimSlashes = (url: string) => url.replace(/\/+$/, '');

/** Maps a selected network id to an analytics bucket; custom network ids are never sent. */
export function toAnalyticsNetwork(networkId: string | null | undefined): AnalyticsNetwork {
  const normalizedId = normalizeNetworkId(networkId ?? 'mainnet');

  if (normalizedId === 'mainnet') return 'mainnet';
  if (normalizedId === BASENET_NETWORK_ID) return 'basenet';

  return 'custom';
}

/** Maps an RPC URL to an analytics bucket; custom RPC URLs are never sent. */
export function toAnalyticsNetworkFromRpc(rpcUrl: string | null | undefined): AnalyticsNetwork {
  if (!rpcUrl) return 'custom';
  const url = trimSlashes(rpcUrl);

  if (MAINNET_RPC_URL && url === trimSlashes(MAINNET_RPC_URL)) return 'mainnet';
  if (BASENET_RPC_URL && url === trimSlashes(BASENET_RPC_URL)) return 'basenet';

  return 'custom';
}
