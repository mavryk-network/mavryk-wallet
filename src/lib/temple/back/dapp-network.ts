import { MavrykWalletDAppErrorType, MavrykWalletDAppNetwork } from '@mavrykdynamics/mavryk-wallet-dapp/dist/types';
import { HttpResponseError, STATUS_CODE } from '@mavrykdynamics/webmavryk-http-utils';
import { RpcClient } from '@mavrykdynamics/webmavryk-rpc';
import { b58cencode, prefix, Prefix } from '@mavrykdynamics/webmavryk-utils';
import browser from 'webextension-polyfill';

import { loadChainId, loadChainIdStrict } from 'lib/temple/helpers';
import {
  migrateLegacyAtlasnetStorage,
  normalizeLegacyAtlasnetNetworkSnapshot,
  normalizeNetworkId
} from 'lib/temple/network-storage';
import { NETWORK_IDS, NETWORKS } from 'lib/temple/networks';
import { TempleDAppSession } from 'lib/temple/types';
import { delay } from 'lib/utils';

import { PublicError } from './PublicError';

const LOOPBACK_HOSTNAMES = ['localhost', '127.0.0.1', '[::1]'];
/** Built-in networks whose chain id is known: a dApp RPC reporting one of these chains is never used. */
const BUILT_IN_CHAIN_NETWORKS = NETWORKS.filter(n => Array.from(NETWORK_IDS.values()).includes(n.id));
/** One 10 s mainnet block plus the clock tolerance on each side, so a node keeping up has a head made after signing. */
const BRANCH_RECHECK_DELAY_MS = 14_000;
/** Allowed gap between the local clock and block timestamps, including blocks a validator sends slightly early. */
const CLOCK_TOLERANCE_MS = 2_000;
/** A dApp RPC is asked for its chain id inside the shared dApp queue, so one that never answers must not stall it */
export const DAPP_RPC_CHAIN_ID_TIMEOUT_MS = 10_000;

/** `isDAppRpc` marks an RPC chosen by the dApp itself, which only ever serves a chain no built-in network serves. */
export type ResolvedNetwork = { rpc: string; chainId?: string; isDAppRpc?: boolean };

export async function getNetworkRPC(net: MavrykWalletDAppNetwork) {
  return (await resolveNetwork(net)).rpc;
}

export async function resolveNetwork(net: MavrykWalletDAppNetwork): Promise<ResolvedNetwork> {
  if (typeof net !== 'string') {
    return resolveCustomNetwork(net.rpc);
  }

  const targetRpc = NETWORKS.find(n => n.id === normalizeNetworkId(net))!.rpcBaseURL;

  try {
    const current = await getCurrentTempleNetwork();
    const [currentChainId, targetChainId] = await Promise.all([
      loadChainId(current.rpcBaseURL),
      loadChainId(targetRpc).catch(() => null)
    ]);

    return { rpc: targetChainId === null || currentChainId === targetChainId ? current.rpcBaseURL : targetRpc };
  } catch {
    return { rpc: targetRpc };
  }
}

/**
 * A dApp-supplied RPC is bound to the chain it reports: it must be https (http only on loopback) and report a
 * chain id. When that chain is the user's current one, the user's own RPC is used; when it is a built-in network's
 * chain, that network's public RPC is used. The dApp's RPC is only ever used for a chain the wallet does not know.
 */
async function resolveCustomNetwork(rawRpc: unknown): Promise<ResolvedNetwork> {
  if (typeof rawRpc !== 'string' || !isAllowedCustomRpcUrl(rawRpc)) {
    throw new Error(MavrykWalletDAppErrorType.InvalidParams);
  }

  const targetRpc = removeLastSlash(rawRpc);
  const current = await getCurrentTempleNetwork();
  const [chainId, currentChainId] = await Promise.all([
    loadChainIdWithTimeout(targetRpc),
    loadChainId(current.rpcBaseURL).catch(() => null)
  ]);

  if (!chainId) {
    throw new Error(MavrykWalletDAppErrorType.InvalidParams);
  }

  if (chainId === currentChainId) {
    return { rpc: current.rpcBaseURL, chainId };
  }

  const builtIn = BUILT_IN_CHAIN_NETWORKS.find(n => NETWORK_IDS.get(chainId) === n.id);

  return builtIn ? { rpc: builtIn.rpcBaseURL, chainId } : { rpc: targetRpc, chainId, isDAppRpc: true };
}

/** Resolves to null when the RPC fails or does not answer within DAPP_RPC_CHAIN_ID_TIMEOUT_MS. */
function loadChainIdWithTimeout(rpc: string): Promise<string | null> {
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(null), DAPP_RPC_CHAIN_ID_TIMEOUT_MS);
    loadChainIdStrict(rpc)
      .then(resolve, () => resolve(null))
      .finally(() => clearTimeout(timer));
  });
}

/**
 * The RPC shown with a dApp sign request. Signing a payload needs no RPC, so a custom-RPC session is mapped from its
 * stored chain binding instead of asking the dApp's RPC, which could stall the sign flow and the shared dApp queue.
 */
export async function getSignRequestRpc(dApp: TempleDAppSession) {
  if (typeof dApp.network === 'string') {
    return getNetworkRPC(dApp.network);
  }

  const builtIn = BUILT_IN_CHAIN_NETWORKS.find(n => NETWORK_IDS.get(dApp.chainId ?? '') === n.id);

  return builtIn ? builtIn.rpcBaseURL : removeLastSlash(dApp.network.rpc);
}

/** RpcClient appends paths to the raw URL, so a query, fragment or userinfo would let a page shape the request. */
export function isAllowedCustomRpcUrl(rpc: string) {
  try {
    const { protocol, hostname, username, password } = new URL(rpc);
    const isAllowedOrigin = protocol === 'https:' || (protocol === 'http:' && LOOPBACK_HOSTNAMES.includes(hostname));

    return isAllowedOrigin && !/[?#]/.test(rpc) && !username && !password;
  } catch {
    return false;
  }
}

/** Refuses to act for a chain-bound session once its RPC reports a different chain id. */
export async function assertSessionChainId(dApp: TempleDAppSession, networkRpc: string) {
  if (typeof dApp.network === 'string') return;

  const chainId = await loadChainIdWithTimeout(networkRpc);

  if (chainId !== dApp.chainId) {
    throw new Error(MavrykWalletDAppErrorType.InvalidParams);
  }
}

/**
 * A dApp RPC can claim any chain id while serving another chain's branch, which would make the signed operation
 * valid on that chain. Before signing for a dApp-chosen RPC, the branch must be unknown to every built-in network.
 * Fails closed: a built-in RPC that cannot answer blocks the signature, even when none can (offline), since a network
 * attacker who blocks the public RPCs could otherwise get a known chain's branch signed. A 404 is conclusive when the
 * node's head, read before the lookup, could not have had a successor yet; otherwise the node may be behind the head,
 * so that node is asked again after about one block, when a 404 counts only once its head was made after signing
 * began. A node still behind then fails closed. A dApp RPC serving the wallet's selected network's chain is never
 * guarded: selecting a local node avoids this.
 */
export async function assertBranchNotOnBuiltInChain(opBytes: string) {
  const branch = b58cencode(opBytes.slice(0, 64), prefix[Prefix.B]);
  const signingAt = Date.now();
  const lookups = await Promise.all(
    BUILT_IN_CHAIN_NETWORKS.map(n => lookUpBranchAtHead(new RpcClient(n.rpcBaseURL), branch, signingAt))
  );
  assertBranchUnknown(lookups);

  const behindRpcs = BUILT_IN_CHAIN_NETWORKS.filter((_, i) => lookups[i] === 'maybe-behind');
  if (behindRpcs.length === 0) return;

  await delay(BRANCH_RECHECK_DELAY_MS);
  assertBranchUnknown(
    await Promise.all(behindRpcs.map(n => lookUpBranchAfter(new RpcClient(n.rpcBaseURL), branch, signingAt)))
  );
}

type BranchLookup = 'found' | 'missing' | 'maybe-behind' | 'unreachable';

async function lookUpBranchAtHead(rpc: RpcClient, branch: string, signingAt: number): Promise<BranchLookup> {
  try {
    const [{ timestamp }, { minimal_block_delay }] = await Promise.all([rpc.getBlockHeader(), rpc.getConstants()]);
    const headAt = new Date(timestamp).getTime();
    const nextBlockAt = headAt + Number(minimal_block_delay) * 1000;
    const isAtHead = headAt <= signingAt + CLOCK_TOLERANCE_MS && signingAt < nextBlockAt - CLOCK_TOLERANCE_MS;
    const lookup = await lookUpBranch(rpc, branch);

    return lookup === 'missing' && !isAtHead ? 'maybe-behind' : lookup;
  } catch {
    return 'unreachable';
  }
}

/** A 404 proves the branch unknown only when the node's head, read first, did not yet exist when signing began. */
async function lookUpBranchAfter(rpc: RpcClient, branch: string, signingAt: number): Promise<BranchLookup> {
  try {
    const { timestamp } = await rpc.getBlockHeader();
    const lookup = await lookUpBranch(rpc, branch);
    const hasHeadAfterSigning = new Date(timestamp).getTime() > signingAt + CLOCK_TOLERANCE_MS;

    return lookup === 'missing' && !hasHeadAfterSigning ? 'unreachable' : lookup;
  } catch {
    return 'unreachable';
  }
}

function lookUpBranch(rpc: RpcClient, branch: string): Promise<BranchLookup> {
  return rpc.getBlockHash({ block: branch }).then(
    () => 'found' as const,
    err => (err instanceof HttpResponseError && err.status === STATUS_CODE.NOT_FOUND ? 'missing' : 'unreachable')
  );
}

function assertBranchUnknown(lookups: BranchLookup[]) {
  if (lookups.includes('found')) {
    throw new PublicError('This RPC serves an operation for a known Mavryk network. Signing was refused.');
  }

  if (lookups.includes('unreachable')) {
    throw new PublicError(
      'Could not verify the operation branch against Mavryk networks; check your connection. Signing was refused. ' +
        'To sign for a local node, select that node as the wallet network and try again.'
    );
  }
}

/**
 * The RPC disclosed to a dApp. Internal callers use getNetworkRPC: this never hands out the URL of a network the
 * user added themselves, which may carry a private host or provider key. The value is always a built-in
 * rpcBaseURL or the dApp's own RPC.
 */
export async function getDAppVisibleRpc(net: MavrykWalletDAppNetwork) {
  if (typeof net !== 'string') {
    return removeLastSlash(net.rpc);
  }

  const builtIn = NETWORKS.find(n => n.id === normalizeNetworkId(net));
  const current = await getCurrentTempleNetwork();

  return builtIn && !NETWORKS.some(n => n.id === current.id) ? builtIn.rpcBaseURL : getNetworkRPC(net);
}

async function getCurrentTempleNetwork() {
  await migrateLegacyAtlasnetStorage();

  const { network_id: networkId, custom_networks_snapshot: customNetworksSnapshot } = await browser.storage.local.get([
    'network_id',
    'custom_networks_snapshot'
  ]);
  const normalizedNetworkId = normalizeNetworkId(networkId);
  const normalizedCustomNetworksSnapshot = normalizeLegacyAtlasnetNetworkSnapshot(customNetworksSnapshot);

  return [...NETWORKS, ...normalizedCustomNetworksSnapshot].find(n => n.id === normalizedNetworkId) ?? NETWORKS[0];
}

export function removeLastSlash(str: string) {
  return str.endsWith('/') ? str.slice(0, -1) : str;
}
