import React from 'react';

import { createRoot, Root } from 'react-dom/client';
import { act, Simulate } from 'react-dom/test-utils';

import { UNLOCK_INTERRUPTED_BY_LOCK_ERROR } from 'lib/constants';
import { TempleSharedStorageKey } from 'lib/temple/types';

import Unlock from './Unlock';

const mockUnlock = jest.fn();
const mockTrackSubmitFail = jest.fn();

jest.mock('app/env', () => ({ useAppEnv: () => ({ popup: true }) }));
jest.mock('lib/temple/front', () => ({ useTempleClient: () => ({ unlock: mockUnlock }) }));
jest.mock('react-redux', () => ({ useDispatch: () => jest.fn() }));
jest.mock('lib/analytics', () => ({
  useFormAnalytics: () => ({
    trackSubmit: jest.fn(),
    trackSubmitSuccess: jest.fn(),
    trackSubmitFail: mockTrackSubmitFail
  })
}));
jest.mock('lib/load-perf', () => ({ useLoadPerfMark: jest.fn() }));
jest.mock('lib/i18n', () => ({
  t: (id: string) => id,
  T: ({ id }: { id: string }) => id
}));
jest.mock('lib/utils', () => ({ delay: () => Promise.resolve() }));
jest.mock('lib/woozie', () => ({ Link: ({ children }: React.PropsWithChildren<{}>) => children }));
jest.mock('../../../lib/apis/temple', () => ({ ABTestGroup: { Unknown: 'Unknown', A: 'A' } }));
jest.mock('../../store/ab-testing/actions', () => ({ getUserTestingGroupNameActions: { submit: jest.fn() } }));
jest.mock('../../store/ab-testing/selectors', () => ({ useUserTestingGroupNameSelector: () => 'A' }));
jest.mock('../../templates/PageWithImageBg/PageWithImageBg', () => ({
  __esModule: true,
  default: ({ children }: React.PropsWithChildren<{}>) => children
}));
jest.mock('app/atoms', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    Alert: ({ description }: { description: string }) => <div data-alert>{description}</div>,
    FormField: React.forwardRef<
      HTMLInputElement,
      React.InputHTMLAttributes<HTMLInputElement> & { errorCaption?: string }
    >(({ name, type, disabled, errorCaption }, ref) => (
      <>
        <input ref={ref} name={name} type={type} disabled={disabled} />
        <span data-error>{errorCaption}</span>
      </>
    )),
    FormSubmitButton: ({ disabled, children }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <button type="submit" disabled={disabled}>
        {children}
      </button>
    )
  };
});

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  jest.restoreAllMocks();
});

const renderUnlock = async () => {
  await act(async () => {
    root.render(<Unlock canImportNew={false} />);
  });
};

const submitPassword = async (password: string) => {
  await act(async () => {
    const input = container.querySelector<HTMLInputElement>('input[name="password"]')!;
    input.value = password;
    Simulate.change(input);
    Simulate.submit(container.querySelector('form')!);
  });
};

const getErrorCaption = () => container.querySelector('[data-error]')!.textContent;
const getStoredNumber = (key: TempleSharedStorageKey) => JSON.parse(localStorage.getItem(key) ?? 'null');

describe('Unlock', () => {
  it('counts a wrong password towards the time-lock', async () => {
    mockUnlock.mockRejectedValue(new Error('Invalid password'));
    await renderUnlock();

    await submitPassword('wrong-password');

    expect(mockUnlock).toHaveBeenCalledWith('wrong-password');
    expect(mockTrackSubmitFail).toHaveBeenCalledTimes(1);
    expect(getStoredNumber(TempleSharedStorageKey.PasswordAttempts)).toBe(2);
    expect(getErrorCaption()).toBe('Invalid password');
  });

  it('shows the interrupted message without counting an attempt when a lock lands mid-unlock', async () => {
    localStorage.setItem(TempleSharedStorageKey.PasswordAttempts, JSON.stringify(3));
    mockUnlock.mockRejectedValue(new Error(UNLOCK_INTERRUPTED_BY_LOCK_ERROR));
    await renderUnlock();

    await submitPassword('correct-password');

    expect(mockUnlock).toHaveBeenCalledWith('correct-password');
    expect(getErrorCaption()).toBe('unlockInterruptedByLock');
    expect(getStoredNumber(TempleSharedStorageKey.PasswordAttempts)).toBe(3);
    expect(getStoredNumber(TempleSharedStorageKey.TimeLock)).toBeNull();
    expect(container.querySelector('[data-alert]')).toBeNull();
    expect(container.querySelector<HTMLInputElement>('input[name="password"]')!.disabled).toBe(false);
  });
});
