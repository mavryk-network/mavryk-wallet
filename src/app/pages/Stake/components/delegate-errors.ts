import { isAddressValid, isKTAddress } from 'lib/temple/helpers';

export class UnchangedError extends Error {}

export class UnregisteredDelegateError extends Error {}

export function validateAddress(value: string) {
  switch (false) {
    case value?.length > 0:
      return true;

    case isAddressValid(value):
      return 'invalidAddress';

    case !isKTAddress(value):
      return 'unableToDelegateToKTAddress';

    default:
      return true;
  }
}
