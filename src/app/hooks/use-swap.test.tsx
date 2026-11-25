import React from 'react';

import { createRoot, Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { useDispatch } from 'react-redux';

import { loadSwapParamsAction, resetSwapParamsAction } from 'app/store/swap/actions';
import { Route3SwapParamsRequestRaw } from 'lib/route3/interfaces';
import { useAccount, useChainId } from 'lib/temple/front';
import { useOnBlock } from 'lib/temple/front/chain';

import { SWAP_QUOTE_REFETCH_INTERVAL, useBlockAwareSwapParams } from './use-swap';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

jest.mock('react-redux', () => ({
  useDispatch: jest.fn()
}));

jest.mock('lib/temple/front', () => ({
  useAccount: jest.fn(),
  useChainId: jest.fn(),
  useTezos: jest.fn()
}));

jest.mock('lib/temple/front/chain', () => ({
  useOnBlock: jest.fn()
}));

jest.mock('lib/utils/swap.utils', () => ({
  getSwapTransferParams: jest.fn()
}));

const useDispatchMock = useDispatch as jest.Mock;
const useAccountMock = useAccount as jest.Mock;
const useChainIdMock = useChainId as jest.Mock;
const useOnBlockMock = useOnBlock as jest.Mock;

const REQUEST: Route3SwapParamsRequestRaw = {
  fromSymbol: 'MAV',
  toSymbol: 'USDt',
  amount: '1000',
  chainsLimit: 3
};

function HookHarness({ params }: { params: Route3SwapParamsRequestRaw | null }) {
  useBlockAwareSwapParams(params);

  return null;
}

function renderHookHarness(params: Route3SwapParamsRequestRaw | null) {
  const container = document.createElement('div');
  const root = createRoot(container);
  document.body.appendChild(container);

  act(() => {
    root.render(<HookHarness params={params} />);
  });

  return { container, root };
}

function cleanupHarness(root: Root, container: HTMLElement) {
  act(() => {
    root.unmount();
  });
  container.remove();
}

describe('useBlockAwareSwapParams', () => {
  let dispatch: jest.Mock;
  let onBlock: ((blockHash: string) => void) | undefined;

  beforeEach(() => {
    dispatch = jest.fn();
    onBlock = undefined;
    useDispatchMock.mockReturnValue(dispatch);
    useAccountMock.mockReturnValue({ publicKeyHash: 'mv1-account' });
    useChainIdMock.mockReturnValue('NetX');
    useOnBlockMock.mockImplementation((callback: (blockHash: string) => void) => {
      onBlock = callback;

      return true;
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('refreshes the active quote when a new block arrives', () => {
    const { container, root } = renderHookHarness(REQUEST);

    expect(dispatch).toHaveBeenCalledWith(loadSwapParamsAction.submit(REQUEST));

    act(() => {
      onBlock?.('block-hash-2');
    });

    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch).toHaveBeenLastCalledWith(loadSwapParamsAction.submit(REQUEST));
    expect(useOnBlockMock).toHaveBeenLastCalledWith(expect.any(Function), undefined, false);

    cleanupHarness(root, container);
  });

  it('falls back to block-time interval refetching when block subscription is unavailable', () => {
    jest.useFakeTimers();
    useOnBlockMock.mockImplementation(() => false);

    const { container, root } = renderHookHarness(REQUEST);

    expect(dispatch).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(SWAP_QUOTE_REFETCH_INTERVAL);
    });

    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch).toHaveBeenLastCalledWith(loadSwapParamsAction.submit(REQUEST));

    cleanupHarness(root, container);
  });

  it('uses disabled placeholder params without fetching when request inputs are incomplete', () => {
    const { container, root } = renderHookHarness({ ...REQUEST, amount: undefined });

    expect(dispatch).toHaveBeenCalledWith(resetSwapParamsAction());
    expect(useOnBlockMock).toHaveBeenLastCalledWith(expect.any(Function), undefined, true);

    cleanupHarness(root, container);
  });
});
