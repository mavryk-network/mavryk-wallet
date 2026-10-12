import { getMessage } from 'lib/i18n';
import { ContactsUnavailableReason } from 'lib/temple/types';

export function getContactsUnavailableMessage(reason: ContactsUnavailableReason) {
  switch (reason) {
    case 'ledger':
      return getMessage('contactsUnavailableLedger');
    case 'watch-only':
      return getMessage('contactsUnavailableWatchOnly');
    case 'decrypt-failed':
      return getMessage('contactsDecryptFailed');
    case 'auth-unavailable':
      return getMessage('contactsAuthUnavailable');
    case 'missing-owner':
    case 'missing-account':
      return getMessage('contactsUnavailableAccount');
  }
}
