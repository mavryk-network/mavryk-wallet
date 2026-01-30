import React, { useCallback } from 'react';

import clsx from 'clsx';
import { useForm } from 'react-hook-form';

import { FormField, FormSubmitButton } from 'app/atoms';
import { ACCOUNT_NAME_PATTERN_STR } from 'app/defaults';
import { useAppEnv } from 'app/env';
import { ButtonRounded } from 'app/molecules/ButtonRounded';
import { SuccessStateType } from 'app/pages/SuccessScreen/SuccessScreen';
import { t, T } from 'lib/i18n';
import { isDomainNameValid, useTezosDomainsClient, useContactsActions } from 'lib/temple/front';
import { isAddressValid } from 'lib/temple/helpers';
import { delay } from 'lib/utils';
import { HistoryAction, goBack, navigate, useLocation } from 'lib/woozie';

import { AddressBookSelectors } from '../AddressBook.selectors';

export const ImportContacts: React.FC = () => {
  const { popup } = useAppEnv();
  return <div className={clsx('w-full h-full mx-auto flex-1 flex flex-col', popup && 'pb-8 max-w-sm')}>test</div>;
};
