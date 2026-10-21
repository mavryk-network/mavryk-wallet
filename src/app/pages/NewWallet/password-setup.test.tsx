import React from 'react';

import { createRoot, Root } from 'react-dom/client';
import { act, Simulate } from 'react-dom/test-utils';

import { getPasswordValidation, isPasswordValid, PASSWORD_PATTERN } from 'app/defaults';
import PasswordStrengthIndicator from 'lib/ui/PasswordStrengthIndicator';

import { useCreareOrRestorePassword } from './import/useCreareOrRestorePassword';
import { ImportWallet } from './ImportWallet';
import { SetWalletPassword } from './setWalletPassword/SetWalletPassword';

const mockRegisterWallet = jest.fn().mockResolvedValue('account');
const mockDecrypt = jest.fn().mockResolvedValue('file seed');
const mockDispatch = jest.fn();
const mockStorage = jest.fn();
const mockOnboarding = jest.fn();
const mockTrack = jest.fn();
let mockFullPage = true;

jest.mock('app/env', () => ({ useAppEnv: () => ({ fullPage: mockFullPage, popup: !mockFullPage }) }));
jest.mock('lib/temple/front', () => ({
  useTempleClient: () => ({ registerWallet: mockRegisterWallet, ready: false, locked: false }),
  decryptKukaiSeedPhrase: (...args: unknown[]) => mockDecrypt(...args)
}));
jest.mock('react-redux', () => ({ useDispatch: () => mockDispatch }));
jest.mock('lib/storage', () => ({ putToStorage: (...args: unknown[]) => mockStorage(...args) }));
jest.mock('lib/analytics', () => ({
  useAnalytics: () => ({ trackEvent: mockTrack }),
  AnalyticsEventCategory: { General: 'general' }
}));
jest.mock('lib/utils', () => ({ delay: () => Promise.resolve() }));
jest.mock('lib/woozie', () => ({ navigate: jest.fn() }));
jest.mock('../Onboarding/hooks/useOnboardingProgress.hook', () => ({
  useOnboardingProgress: () => ({ setOnboardingCompleted: mockOnboarding })
}));
jest.mock('app/store/newsletter/newsletter-actions', () => ({ shouldShowNewsletterModalAction: jest.fn() }));
jest.mock('app/store/partners-promotion/actions', () => ({ togglePartnersPromotionAction: jest.fn() }));
jest.mock('app/store/settings/actions', () => ({
  setIsAnalyticsEnabledAction: jest.fn(),
  setOnRampPossibilityAction: jest.fn()
}));
jest.mock('lib/i18n', () => ({
  t: (id: string) => id,
  T: ({ id, children }: { id: string; children?: (id: string) => React.ReactNode }) => (children ? children(id) : id)
}));
jest.mock('lib/ui', () => ({ useAlert: () => jest.fn() }));
jest.mock('app/icons/close.svg', () => ({ ReactComponent: () => null }));
jest.mock('app/icons/file.svg', () => ({ ReactComponent: () => null }));
jest.mock('app/layouts/PageLayout', () => ({
  __esModule: true,
  default: ({ children }: React.PropsWithChildren<{}>) => children
}));
jest.mock('app/atoms/ImportTabSwitcher', () => () => null);
jest.mock('./LockedWalletExists', () => ({ LockedWalletExists: () => null }));
jest.mock('./import/ImportSeedPhrase/ImportFromSeedPhrase', () => ({
  ImportFromSeedPhrase: ({
    setSeedPhrase,
    setIsSeedEntered
  }: {
    setSeedPhrase: (seed: string) => void;
    setIsSeedEntered: (entered: boolean) => void;
  }) => (
    <button
      onClick={() => {
        setSeedPhrase('restored seed');
        setIsSeedEntered(true);
      }}
    >
      seed
    </button>
  )
}));
jest.mock('app/atoms/Switcher', () => ({
  Switcher: ({ on, onClick }: { on: boolean; onClick: () => void }) => (
    <button type="button" data-toggle aria-pressed={on} onClick={onClick}>
      reuse
    </button>
  )
}));
jest.mock('app/atoms', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    PASSWORD_ERROR_CAPTION: 'PASSWORD_ERROR_CAPTION',
    FormField: React.forwardRef<
      HTMLInputElement,
      React.InputHTMLAttributes<HTMLInputElement> & { errorCaption?: string }
    >(({ name, type, onChange, onFocus, errorCaption }, ref) => (
      <>
        <input ref={ref} name={name} type={type} onChange={onChange} onFocus={onFocus} />
        <span>{errorCaption}</span>
      </>
    )),
    FormSubmitButton: ({ disabled, children }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <button type="submit" disabled={disabled}>
        {children}
      </button>
    ),
    FileInput: ({ name, onChange }: { name: string; onChange: (files: FileList | null) => void }) => (
      <input type="file" name={name} onChange={event => onChange(event.target.files)} />
    )
  };
});
jest.mock('./import/importPartialFormCheckboxes/ImportPartialFormCheckboxes', () => ({
  ImportPartialFormCheckboxes: ({
    register
  }: {
    register: ReturnType<typeof useCreareOrRestorePassword>['register'];
  }) => (
    <>
      <input type="checkbox" name="termsAccepted" ref={register({ required: true })} />
      <input type="checkbox" name="betaAgreement" ref={register({ required: true })} />
    </>
  )
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  jest.clearAllMocks();
  mockFullPage = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = async (element: React.ReactElement) => {
  await act(async () => {
    root.render(element);
  });
};
const input = (name: string) => container.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
async function change(name: string, value: string | boolean) {
  await act(async () => {
    const element = input(name);
    if (typeof value === 'boolean') element.checked = value;
    else element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    Simulate.change(element);
  });
}
async function agree() {
  await change('termsAccepted', true);
  await change('betaAgreement', true);
}
async function submit() {
  await act(async () => {
    Simulate.submit(container.querySelector('form')!);
  });
}
async function click(selector: string) {
  await act(async () => {
    Simulate.click(container.querySelector(selector)!);
  });
}
function expectNoWrites() {
  for (const mock of [mockRegisterWallet, mockDispatch, mockStorage, mockOnboarding, mockTrack])
    expect(mock).not.toHaveBeenCalled();
}

it.each(['Abcdefg1', 'abcdef1!', 'ABCDEFG1!', 'Abcdefg!', 'Abcde1!', 'Abcdef1 ', 'Abcdef1[', 'Abcdef1/'])(
  'rejects %s consistently',
  password => {
    expect(isPasswordValid(password)).toBe(false);
    expect(PASSWORD_PATTERN.test(password)).toBe(false);
  }
);
it.each(['Abcdef1!', 'Abcdefg1!', 'Abcdef1]', 'Abcdef1\\'])('accepts %s consistently', password => {
  expect(isPasswordValid(password)).toBe(true);
  expect(PASSWORD_PATTERN.test(password)).toBe(true);
  expect(Object.values(getPasswordValidation(password))).toEqual([true, true, true, true]);
});

it.each([false, true])(
  'enforces creation and seed restore forms (ownMnemonic=%s) in both layouts',
  async ownMnemonic => {
    for (const fullPage of [true, false]) {
      mockFullPage = fullPage;
      await render(<SetWalletPassword key={String(fullPage)} ownMnemonic={ownMnemonic} seedPhrase="chosen seed" />);
      await agree();
      await change('password', 'Abcdefg1');
      await change('repeatPassword', 'Abcdefg1');
      await submit(); // Native form submission also covers the Enter path, independent of the disabled button.
      expectNoWrites();
      const special = Array.from(container.querySelectorAll('li')).find(
        li => li.textContent === 'atLeast1SpecialCharacter'
      )!;
      expect(special.style.color).toBe('rgb(255, 62, 62)');
      await change('password', 'Abcdefg1!'); // Whole-value change also exercises pasted input.
      await submit();
      expectNoWrites();
      expect(container.textContent).toContain('mustBeEqualToPasswordAbove');
      await change('repeatPassword', 'Abcdefg1!');
      expect(container.querySelector('button')!.disabled).toBe(false);
      await change('password', 'Changed1!');
      expect(container.textContent).toContain('mustBeEqualToPasswordAbove');
      await change('repeatPassword', 'Changed1!');
      await submit();
      expect(mockRegisterWallet).toHaveBeenCalledWith('Changed1!', 'chosen seed');
      jest.clearAllMocks();
    }
  }
);

async function decryptFile(password: string) {
  await render(<ImportWallet ownMnemonic tabSlug="keystore-file" />);
  const file = { name: 'legacy.mav', text: async () => 'encrypted file' };
  const files = { 0: file, length: 1, item: () => file };
  await act(async () => {
    Object.defineProperty(input('keystoreFile'), 'files', { value: files, configurable: true });
    Simulate.change(input('keystoreFile'));
  });
  await change('keystorePassword', password);
  await submit();
  expect(mockDecrypt).toHaveBeenCalledWith('encrypted file', password);
}

it('decrypts a weak legacy password, visibly blocks reuse, and saves the replacement', async () => {
  await decryptFile('old');
  await click('[data-toggle]');
  await agree();
  expect(container.querySelector('[role="alert"]')!.textContent).toContain('weakKeystorePassword');
  expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
  await submit();
  expectNoWrites();
  await click('[data-toggle]');
  expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
  await submit();
  await change('password', 'Replacement1!');
  await change('repeatPassword', 'Replacement1!');
  await agree();
  await submit();
  expect(mockRegisterWallet).toHaveBeenCalledWith('Replacement1!', 'file seed');
});
it('reuses a compliant file password without requiring hidden replacement fields', async () => {
  await decryptFile('Original1!');
  await click('[data-toggle]');
  await submit();
  expectNoWrites();
  await agree();
  await submit();
  expect(mockRegisterWallet).toHaveBeenCalledWith('Original1!', 'file seed');
});
it('saves a replacement even when the original file password is compliant', async () => {
  await decryptFile('Original1!');
  await submit();
  await agree();
  await change('password', 'Replacement1!');
  await change('repeatPassword', 'Replacement1!');
  await submit();
  expect(mockRegisterWallet).toHaveBeenCalledWith('Replacement1!', 'file seed');
});
it('resets file-derived state when switching to seed import', async () => {
  await decryptFile('Original1!');
  await render(<ImportWallet ownMnemonic tabSlug="seed-phrase" />);
  expect(input('password')).toBeNull();
  await click('button');
  await agree();
  await change('password', 'SeedPass1!');
  await change('repeatPassword', 'SeedPass1!');
  await submit();
  expect(mockRegisterWallet).toHaveBeenCalledWith('SeedPass1!', 'restored seed');
});
it('guards the actual selected password before any onboarding side effects even without registered fields', async () => {
  let hook: ReturnType<typeof useCreareOrRestorePassword>;
  function Harness() {
    hook = useCreareOrRestorePassword(false, 'seed');
    return null;
  }
  await render(<Harness />);
  await act(async () => {
    await hook.onSubmit({ password: 'Abcdefg1', termsAccepted: true, betaAgreement: true, viewAds: false });
  });
  expectNoWrites();
  expect(hook!.isPasswordError).toBe(true);
});

it('keeps untouched punctuation neutral, invalid punctuation red and valid punctuation green', async () => {
  for (const [password, isPasswordError, color] of [
    ['Abcdefg1', false, ''],
    ['Abcdefg1', true, 'rgb(255, 62, 62)'],
    ['Abcdefg1!', true, 'rgb(0, 183, 29)']
  ] as const) {
    await render(
      <PasswordStrengthIndicator validation={getPasswordValidation(password)} isPasswordError={isPasswordError} />
    );
    const special = Array.from(container.querySelectorAll('li')).find(
      li => li.textContent === 'atLeast1SpecialCharacter'
    )!;
    expect(special.style.color).toBe(color);
  }
});
