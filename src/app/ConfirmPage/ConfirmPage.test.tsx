import React from 'react';

import { createRoot, Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { SWRConfig } from 'swr';

import { confirmOperationsMock } from 'app/mocks/confirmPage.mock';

import ConfirmPage from './ConfirmPage';
import { ConfirmPageSelectors } from './ConfirmPage.selectors';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const mockGetDAppPayload = jest.fn();

// Translations render as their message IDs so the tests can assert which copy is shown.
jest.mock('lib/i18n', () => ({
  t: (id: string) => id,
  T: ({ id }: { id: string }) => <>{id}</>
}));
jest.mock('lib/temple/front', () => ({
  useTempleClient: () => ({
    ready: true,
    getDAppPayload: mockGetDAppPayload,
    confirmDAppPermission: jest.fn(),
    confirmDAppOperation: jest.fn(),
    confirmDAppSign: jest.fn()
  }),
  useAccount: () => ({ publicKeyHash: 'mv1source' }),
  useRelevantAccounts: () => [],
  useChainIdValue: () => 'NetXchainid'
}));
jest.mock('lib/woozie', () => ({
  useLocation: () => ({ search: '?id=payload-id&token=payload-token' }),
  Link: ({ children }: React.PropsWithChildren) => <>{children}</>
}));
jest.mock('lib/analytics', () => ({
  CustomRpcContext: jest.requireActual('react').createContext(undefined)
}));
jest.mock('app/atoms', () => ({
  Alert: ({ description }: { description: React.ReactNode }) => <div data-testid="alert">{description}</div>,
  FormSubmitButton: ({
    disabled,
    testID,
    children
  }: React.PropsWithChildren<{ disabled?: boolean; testID?: string }>) => (
    <button data-testid={testID} disabled={disabled}>
      {children}
    </button>
  )
}));
jest.mock('app/atoms/Alert', () => ({
  AlertWithCollapse: ({ description }: { description: React.ReactNode }) => (
    <div data-testid="alert-with-collapse">{description}</div>
  )
}));
jest.mock('app/atoms/ConfirmLedgerOverlay', () => () => null);
jest.mock('app/atoms/Spinner/Spinner', () => () => null);
jest.mock('app/atoms/Divider', () => () => null);
jest.mock('app/molecules/ButtonRounded', () => ({
  ButtonRounded: ({ children }: React.PropsWithChildren) => <button>{children}</button>
}));
jest.mock('app/ErrorBoundary', () => ({ children }: React.PropsWithChildren) => <>{children}</>);
jest.mock('app/layouts/ContentContainer', () => ({ children }: React.PropsWithChildren) => <>{children}</>);
jest.mock('app/pages/Unlock/Unlock', () => () => null);
jest.mock('app/templates/AccountBanner', () => () => null);
jest.mock('app/templates/NetworkBanner', () => () => null);
jest.mock('app/templates/OperationsBanner/OperationsBanner', () => () => null);
jest.mock('app/templates/OperationView', () => () => null);
jest.mock('app/ConfirmPage/components/AccountDropdown', () => ({ AccountDropdown: () => null }));

let container: HTMLDivElement;
let root: Root;

const renderWithPayload = async (payload: object) => {
  mockGetDAppPayload.mockResolvedValue(payload);

  await act(async () => {
    root.render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <ConfirmPage />
      </SWRConfig>
    );
  });
};

const getConfirmButton = () =>
  container.querySelector<HTMLButtonElement>(
    `[data-testid="${ConfirmPageSelectors.ConfirmOperationsAction_ConfirmButton}"]`
  );

const queryByTestId = (testId: string) => container.querySelector(`[data-testid="${testId}"]`);

beforeEach(() => {
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  mockGetDAppPayload.mockReset();
});

describe('ConfirmPage operation verification', () => {
  it('disables Confirm and explains why when the operation has no locally forged rawToSign', async () => {
    const { rawToSign: _rawToSign, ...unverifiedPayload } = confirmOperationsMock;

    await renderWithPayload(unverifiedPayload);

    expect(mockGetDAppPayload).toHaveBeenCalledWith('payload-id', 'payload-token');
    expect(getConfirmButton()?.disabled).toBe(true);
    expect(queryByTestId('alert')?.textContent).toBe('operationCannotBeVerified');
    expect(queryByTestId('alert-with-collapse')).toBeNull();
  });

  it('shows the cannot-be-verified copy in the error collapse when the estimation failed', async () => {
    const { rawToSign: _rawToSign, ...unverifiedPayload } = confirmOperationsMock;

    await renderWithPayload({ ...unverifiedPayload, error: [{ id: 'proto.counter_in_the_past' }] });

    expect(getConfirmButton()?.disabled).toBe(true);
    expect(queryByTestId('alert-with-collapse')?.textContent).toBe('operationCannotBeVerified');
    expect(container.textContent).not.toContain('txIsLikelyToFail');
    expect(queryByTestId('alert')).toBeNull();
  });

  it('enables Confirm when the payload carries the locally forged rawToSign', async () => {
    await renderWithPayload(confirmOperationsMock);

    expect(getConfirmButton()?.disabled).toBe(false);
    expect(container.textContent).not.toContain('operationCannotBeVerified');
  });
});
