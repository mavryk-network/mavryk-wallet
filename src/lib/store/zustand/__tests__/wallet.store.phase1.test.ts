/**
 * Phase 1 tests for wallet.store additions:
 * - walletsSpecs state + setWalletsSpecs action
 * - useWalletsSpecs, useWalletIdle, useCustomNetworks, useAllNetworks, useWalletState selectors
 *
 * Hook selector tests use zustand's useShallow equality function directly
 * to verify shallow-comparison semantics without needing a React render environment.
 */

import { shallow } from 'zustand/shallow';

import { TempleStatus } from 'lib/temple/types';
import type { TempleNetwork } from 'lib/temple/types';

import { walletStore } from '../wallet.store';
import type { WalletStore } from '../wallet.store';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NETWORK_MAINNET: TempleNetwork = {
  id: 'mainnet',
  name: 'Mainnet',
  description: 'Mavryk Mainnet',
  type: 'main',
  rpcBaseURL: 'https://mainnet.mavryk.network',
  color: '#4E66D9',
  disabled: false
};

const NETWORK_GHOSTNET: TempleNetwork = {
  id: 'ghostnet',
  name: 'Ghostnet',
  description: 'Mavryk Ghostnet',
  type: 'test',
  rpcBaseURL: 'https://ghostnet.mavryk.network',
  color: '#A5A5A5',
  disabled: false
};

const NETWORK_CUSTOM: TempleNetwork = {
  id: 'custom1',
  name: 'Local Node',
  description: 'Local dev node',
  type: 'test',
  rpcBaseURL: 'http://localhost:8732',
  color: '#FF0000',
  disabled: false
};

/** Reset the store to its initial shape before each test. */
function resetStore() {
  // Partial reset: only reset state fields (actions are closures and must not be replaced)
  walletStore.setState({
    hydrated: false,
    status: TempleStatus.Idle,
    accounts: [],
    networks: [],
    settings: null,
    confirmation: null,
    confirmationId: null,
    idle: true,
    locked: false,
    ready: false,
    walletsSpecs: {}
  });
}

beforeEach(resetStore);

// ---------------------------------------------------------------------------
// walletsSpecs — store-level tests
// ---------------------------------------------------------------------------

describe('walletsSpecs store state', () => {
  it('initial state is an empty object', () => {
    expect(walletStore.getState().walletsSpecs).toEqual({});
  });

  it('setWalletsSpecs updates the store', () => {
    const specs = { mv1ABC: { name: 'Main Wallet', groups: [] } };
    walletStore.getState().setWalletsSpecs(specs as any);
    expect(walletStore.getState().walletsSpecs).toEqual(specs);
  });

  it('setWalletsSpecs replaces previous specs entirely (not merges)', () => {
    walletStore.getState().setWalletsSpecs({ mv1AAA: { name: 'Old', groups: [] } } as any);
    walletStore.getState().setWalletsSpecs({ mv1BBB: { name: 'New', groups: [] } } as any);
    const keys = Object.keys(walletStore.getState().walletsSpecs);
    expect(keys).toEqual(['mv1BBB']);
  });
});

// ---------------------------------------------------------------------------
// useWalletsSpecs selector — verify it reads walletsSpecs from the store
// ---------------------------------------------------------------------------

describe('useWalletsSpecs selector', () => {
  it('selector returns empty object in initial state', () => {
    const value = walletStore.getState().walletsSpecs;
    expect(value).toEqual({});
  });

  it('selector reflects updated walletsSpecs after setWalletsSpecs', () => {
    const specs = { mv1XYZ: { name: 'Test Wallet', groups: [] } };
    walletStore.getState().setWalletsSpecs(specs as any);
    expect(walletStore.getState().walletsSpecs).toEqual(specs);
  });
});

// ---------------------------------------------------------------------------
// useWalletIdle selector
// ---------------------------------------------------------------------------

describe('useWalletIdle selector', () => {
  it('idle is true in initial state', () => {
    expect(walletStore.getState().idle).toBe(true);
  });

  it('idle is false after syncState sets status to Ready', () => {
    walletStore.getState().syncState({
      status: TempleStatus.Ready,
      accounts: [],
      networks: [],
      settings: null
    });
    expect(walletStore.getState().idle).toBe(false);
  });

  it('idle is true after syncState sets status to Idle', () => {
    walletStore.getState().syncState({
      status: TempleStatus.Ready,
      accounts: [],
      networks: [],
      settings: null
    });
    walletStore.getState().syncState({
      status: TempleStatus.Idle,
      accounts: [],
      networks: [],
      settings: null
    });
    expect(walletStore.getState().idle).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// useCustomNetworks selector
// ---------------------------------------------------------------------------

describe('useCustomNetworks selector', () => {
  it('returns empty array when settings is null', () => {
    const networks = walletStore.getState().settings?.customNetworks ?? [];
    expect(networks).toEqual([]);
  });

  it('returns customNetworks from settings when present', () => {
    walletStore.getState().syncState({
      status: TempleStatus.Ready,
      accounts: [],
      networks: [],
      settings: { customNetworks: [NETWORK_CUSTOM] } as any
    });
    const networks = walletStore.getState().settings?.customNetworks ?? [];
    expect(networks).toEqual([NETWORK_CUSTOM]);
  });
});

// ---------------------------------------------------------------------------
// useAllNetworks — useShallow equality semantics
// ---------------------------------------------------------------------------

describe('useAllNetworks useShallow stability', () => {
  /**
   * Simulates what useAllNetworks does: derives an array from store state.
   * Uses useShallow to verify that equal-by-value arrays compare as equal.
   */
  function deriveAllNetworks(s: WalletStore): TempleNetwork[] {
    return [...s.networks, ...(s.settings?.customNetworks ?? [])];
  }

  it('returns merged networks + customNetworks', () => {
    walletStore.getState().syncState({
      status: TempleStatus.Ready,
      accounts: [],
      networks: [NETWORK_MAINNET],
      settings: { customNetworks: [NETWORK_CUSTOM] } as any
    });

    const result = deriveAllNetworks(walletStore.getState());
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('mainnet');
    expect(result[1].id).toBe('custom1');
  });

  it('shallow equality: same-value arrays compare equal (stable reference semantics)', () => {
    walletStore.getState().syncState({
      status: TempleStatus.Ready,
      accounts: [],
      networks: [NETWORK_MAINNET],
      settings: null
    });

    const state = walletStore.getState();
    const resultA = deriveAllNetworks(state);
    const resultB = deriveAllNetworks(state);

    // useAllNetworks uses useShallow — shallow([...], [...]) with same elements = equal → no re-render
    // We verify the equality function that useShallow relies on
    expect(shallow(resultA, resultB)).toBe(true);
  });

  it('returns a new (non-equal) result when networks change', () => {
    walletStore.getState().syncState({
      status: TempleStatus.Ready,
      accounts: [],
      networks: [NETWORK_MAINNET],
      settings: null
    });

    const before = deriveAllNetworks(walletStore.getState());

    walletStore.getState().syncState({
      status: TempleStatus.Ready,
      accounts: [],
      networks: [NETWORK_MAINNET, NETWORK_GHOSTNET],
      settings: null
    });

    const after = deriveAllNetworks(walletStore.getState());

    expect(before).toHaveLength(1);
    expect(after).toHaveLength(2);
    expect(before).not.toEqual(after);
  });
});

// ---------------------------------------------------------------------------
// useWalletState — useShallow stability
// ---------------------------------------------------------------------------

describe('useWalletState useShallow stability', () => {
  function deriveWalletState(s: WalletStore) {
    return {
      status: s.status,
      accounts: s.accounts,
      networks: s.networks,
      settings: s.settings
    };
  }

  it('returns correct shape in initial state', () => {
    const result = deriveWalletState(walletStore.getState());
    expect(result).toEqual({
      status: TempleStatus.Idle,
      accounts: [],
      networks: [],
      settings: null
    });
  });

  it('shallow equality: same-value state objects compare equal (no re-render)', () => {
    // useWalletState uses useShallow — verify the underlying equality function
    const stateA = deriveWalletState(walletStore.getState());
    const stateB = deriveWalletState(walletStore.getState());

    // Same field values → shallow equal → useShallow would return same reference → no re-render
    expect(shallow(stateA, stateB)).toBe(true);
  });

  it('shallow equality: detects change when a tracked field changes', () => {
    const before = deriveWalletState(walletStore.getState());

    walletStore.getState().syncState({
      status: TempleStatus.Ready,
      accounts: [],
      networks: [],
      settings: null
    });

    const after = deriveWalletState(walletStore.getState());

    // status changed → not shallow equal → useShallow would return new object → re-render
    expect(shallow(before, after)).toBe(false);
    expect(after.status).toBe(TempleStatus.Ready);
  });

  it('shallow equality: same result when only an untracked field (walletsSpecs) changes', () => {
    const before = deriveWalletState(walletStore.getState());

    // walletsSpecs is not in the derived shape — changing it doesn't affect tracked fields
    walletStore.getState().setWalletsSpecs({ mv1ABC: { name: 'Wallet', groups: [] } } as any);

    const after = deriveWalletState(walletStore.getState());

    // Same tracked fields → still shallow equal → no re-render would occur
    expect(shallow(before, after)).toBe(true);
  });
});
