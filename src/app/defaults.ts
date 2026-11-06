import { t } from 'lib/i18n';
import { TempleAccount, TempleAccountType } from 'lib/temple/types';

export const OP_STACK_PREVIEW_SIZE = 1;
export const OP_STACK_PREVIEW_MULTIPLE_SIZE = 2;

export class ArtificialError extends Error {}
export class NotEnoughFundsError extends ArtificialError {}
export class ZeroBalanceError extends NotEnoughFundsError {}
export class ZeroTEZBalanceError extends NotEnoughFundsError {}

export const ACCOUNT_NAME_PATTERN_STR = '^(?! )[\\p{L}\\p{N}\\p{Emoji} .\\-]{1,100}(?<! )$';
export const ACCOUNT_NAME_PATTERN = new RegExp(ACCOUNT_NAME_PATTERN_STR, 'u');

export const ACCOUNT_OR_GROUP_NAME_PATTERN = /^[^!@#$%^&*()_+\-=\]{};':"\\|,.<>?]{1,16}$/;

export const uppercaseLowercaseMixtureRegx = /(?=.*[a-z])(?=.*[A-Z])/;
export const lettersNumbersMixtureRegx = /(?=.*\d)(?=.*[A-Za-z])/;
export const specialCharacterRegx = /[!@#$%^&*()_+\-=\]{};':"\\|,.<>?]/;
const MIN_PASSWORD_LENGTH_PATTERN = /(?=.{8,})/;

export const PASSWORD_PATTERN = new RegExp(
  [
    '^',
    uppercaseLowercaseMixtureRegx.source,
    lettersNumbersMixtureRegx.source,
    `(?=.*${specialCharacterRegx.source})`,
    MIN_PASSWORD_LENGTH_PATTERN.source
  ].join('')
);

/** Returns the displayed requirements for a new vault password. */
export function getPasswordValidation(password: string) {
  return {
    minChar: MIN_PASSWORD_LENGTH_PATTERN.test(password),
    cases: uppercaseLowercaseMixtureRegx.test(password),
    number: lettersNumbersMixtureRegx.test(password),
    specialChar: specialCharacterRegx.test(password)
  };
}

/** Checks the complete new-vault policy; never use this for existing credentials. */
export function isPasswordValid(password: string) {
  return Object.values(getPasswordValidation(password)).every(Boolean);
}

export const URL_PATTERN =
  /(^(https:\/\/)?[\w.-]+(?:\.[\w.-]+)+[\w\-._~:/?#[\]@!$&'()*+,;=.]+$)|(^http(s)?:\/\/localhost:[0-9]+$)/;

export const DEFAULT_DERIVATION_PATH = "m/44'/1729'/0'/0'";
export const DEFAULT_LEDGER_DERIVATION_PATH = "m/44'/1969'/0'/0'";

export function formatMnemonic(m: string) {
  return m.replace(/\n/g, ' ').trim();
}

export function getAccountBadgeTitle(account: Pick<TempleAccount, 'type'>) {
  switch (account.type) {
    case TempleAccountType.Imported:
      return t('importedAccount');

    case TempleAccountType.Ledger:
      return t('ledger');

    case TempleAccountType.ManagedKT:
      return t('managedKTAccount');

    case TempleAccountType.WatchOnly:
      return t('watchOnlyAccount');

    default:
      return null;
  }
}
