import { useMemo } from 'react';

import { isDomainNameValid, useTezosDomainsClient, useTezosAddressByDomainName } from 'lib/temple/front/tzdns';
import { isAddressValid } from 'lib/temple/helpers';

/**
 * Resolves a raw input value (address or domain name) into a validated address.
 * Shared by SendForm, DelegateForm, and other address-input forms.
 */
export function useAddressResolution(inputValue: string | undefined) {
  const domainsClient = useTezosDomainsClient();

  const toFilledWithAddress = useMemo(() => Boolean(inputValue && isAddressValid(inputValue)), [inputValue]);

  const toFilledWithDomain = useMemo(
    () => inputValue && isDomainNameValid(inputValue, domainsClient),
    [inputValue, domainsClient]
  );

  const { data: resolvedAddress } = useTezosAddressByDomainName(inputValue ?? '');

  const toFilled = useMemo(
    () => Boolean(resolvedAddress ? toFilledWithDomain : toFilledWithAddress),
    [toFilledWithAddress, toFilledWithDomain, resolvedAddress]
  );

  const toResolved = useMemo(() => resolvedAddress || inputValue || '', [resolvedAddress, inputValue]);

  return { resolvedAddress, toFilled, toResolved };
}
