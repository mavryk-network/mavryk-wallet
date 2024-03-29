import React, { FC, ReactNode, createContext, useCallback, useContext, useMemo, useState } from 'react';

import classNames from 'clsx';

import { RadioButton } from 'app/atoms/RadioButton';
import { Switcher } from 'app/atoms/Switcher';
import { ReactComponent as SortIcon } from 'app/icons/sort.svg';
import { T } from 'lib/i18n';

import { PopupModalWithTitle } from '../PopupModalWithTitle';

import { SortListItemType, SortPopupContext } from './SortPopup.types';

type SortPopupContentProps = {
  items: SortListItemType[];
  on?: boolean;
  toggle?: () => void;
  title?: ReactNode;
};

type SortPopupProps = { children: ReactNode; isOpened?: boolean };

// Sort popup context
const sortPopupContext = createContext<SortPopupContext>(undefined!);

export const SortPopup: FC<SortPopupProps> = ({ children, isOpened = false }) => {
  const [opened, setOpened] = useState(isOpened);

  const close = useCallback(() => {
    setOpened(false);
  }, []);

  const open = useCallback(() => {
    setOpened(true);
  }, []);

  const memoizedCtxValue = useMemo(
    () => ({
      opened,
      open,
      close
    }),
    [close, open, opened]
  );

  return <sortPopupContext.Provider value={memoizedCtxValue}>{children}</sortPopupContext.Provider>;
};

SortPopup.displayName = 'SortPopupContext';

export const useSortPopup = () => {
  const ctx = useContext(sortPopupContext);

  if (!ctx) {
    throw new Error('useSortPopup must be used within sortPopupContext');
  }

  return ctx;
};

// Popup content
export const SortPopupContent: FC<SortPopupContentProps> = ({ items, on, toggle, title = <T id="sortBy" /> }) => {
  const { opened, close } = useSortPopup();

  return (
    <PopupModalWithTitle isOpen={opened} onRequestClose={close} title={title}>
      <div className="flex flex-col mt-2">
        <ul className="flex flex-col px-4">
          {items.map(item => (
            <SortListItem key={item.id} item={item} />
          ))}
        </ul>
      </div>
      {on !== undefined && (
        <div className="px-4">
          <SortDivider />
          <div className="flex justify-between items-center">
            <span className="text-sm tracking-normal text-white">
              <T id="hideZeroBalances" />
            </span>
            <Switcher on={on} onClick={toggle} />
          </div>
        </div>
      )}
    </PopupModalWithTitle>
  );
};

const SortListItem: FC<{ item: SortListItemType }> = ({ item }) => {
  const { nameI18nKey, selected, disabled = false, onClick, id } = item;

  const handleRadioClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
  }, []);

  return (
    <div className="flex items-center justify-between py-3 cursor-pointer" onClick={onClick}>
      <div className="flex items-center">
        <span className="text-base-plus text-white">
          <T id={nameI18nKey} />
        </span>
      </div>
      <RadioButton id={id} checked={selected} disabled={disabled} onClick={handleRadioClick} />
    </div>
  );
};

// Sort button
export const SortButton: FC<{ className?: string }> = ({ className }) => {
  const { open } = useSortPopup();

  return (
    <div className={classNames('p-1 cursor-pointer', className)} onClick={open}>
      <SortIcon className="w-6 h-auto" />
    </div>
  );
};

const SortDivider = () => {
  return <div className="w-full h-0 border-b border-divider mt-4 mb-6" />;
};
