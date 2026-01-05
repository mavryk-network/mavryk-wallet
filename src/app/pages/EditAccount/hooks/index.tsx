import { useCallback, useMemo, useState } from 'react';

import { useFilteredContacts } from 'lib/temple/front';

export const useAccountNameInputHandlers = (accountName = '', ref: React.RefObject<HTMLInputElement>) => {
  const [value, setValue] = useState(accountName);
  const handleChange = useCallback((e: { target: { value: React.SetStateAction<string> } }) => {
    setValue(e.target.value);
  }, []);

  const handleClean = useCallback(() => {
    setValue('');
    if (ref.current) {
      ref.current.value = '';
    }
  }, []);

  return { value, handleChange, handleClean };
};

export const useAccountOwnership = (accHash?: string | null) => {
  const { allContacts: filteredContacts } = useFilteredContacts();

  const accToChange = useMemo(() => filteredContacts.find(acc => acc.address === accHash), [filteredContacts, accHash]);

  const isOwn = !!accToChange?.accountInWallet;

  return { accToChange, isOwn };
};

export const usePopupState = (initial = false) => {
  const [opened, setOpened] = useState(initial);
  const open = useCallback(() => setOpened(true), []);
  const close = useCallback(() => setOpened(false), []);
  return { opened, open, close };
};
