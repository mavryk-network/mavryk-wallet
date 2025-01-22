import React, { FC, ReactNode, createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

import classNames from 'clsx';

import { Switcher } from 'app/atoms/Switcher';
import { useAppEnv } from 'app/env';
import { ButtonRounded } from 'app/molecules/ButtonRounded';
import { T } from 'lib/i18n';

import { PopupModalWithTitle } from '../PopupModalWithTitle';

import { SortDivider, SortListItem } from './components/SortList';
import { SortListItemType, SortPopupContext } from './SortPopup.types';

type SortPopupContentProps = {
  items: SortListItemType[];
  on?: boolean;
  toggle?: () => void;
  title?: ReactNode;
  alternativeLogic?: boolean;
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

/**
 * default logic - when selecting an option it executes it imidiately (often used within popup)
 * alternative logic - when selecting an option it wont execute it until u confirm it (more for desktop version)
 */
export const SortPopupContent: FC<SortPopupContentProps> = ({
  items,
  on,
  toggle,
  alternativeLogic = false,
  title = <T id="sortBy" />
}) => {
  const { popup } = useAppEnv();
  const [selectedItem, setSelectedItem] = useState(() => items.find(i => i.selected));
  const [internalToggleValue, setInternalToggleValue] = useState(on);
  const { opened, close } = useSortPopup();

  const handleButtonClick = useCallback(() => {
    selectedItem?.onClick?.();
    if (internalToggleValue !== on) toggle?.();
    close();
  }, [selectedItem, internalToggleValue, on, toggle, close]);

  const handleOptionSelect = useCallback((item: SortListItemType) => {
    setSelectedItem(item);
  }, []);

  const handleInternalToggle = useCallback(() => {
    setInternalToggleValue(!internalToggleValue);
  }, [internalToggleValue]);

  return (
    <PopupModalWithTitle
      isOpen={opened}
      contentPosition={popup ? 'bottom' : 'center'}
      onRequestClose={close}
      title={title}
      portalClassName="sort-popup"
    >
      <div className="flex flex-col mt-2">
        <ul className={classNames('flex flex-col', popup ? 'px-4' : 'px-12')}>
          {items.map(item => (
            <SortListItem
              key={item.id}
              item={item}
              handleOptionSelect={handleOptionSelect}
              alternativeLogic={alternativeLogic}
              selectedItemId={selectedItem?.id}
            />
          ))}
        </ul>
      </div>
      {on !== undefined && (
        <div className={classNames(popup ? 'px-4' : 'px-12')}>
          <SortDivider />
          <div className="flex justify-between items-center">
            <span className="text-sm tracking-normal text-white">
              <T id="hideZeroBalances" />
            </span>
            <Switcher on={on} onClick={alternativeLogic ? handleInternalToggle : toggle} />
          </div>
        </div>
      )}

      {alternativeLogic && (
        <div className={classNames('mt-8', popup ? 'px-4' : 'px-12')}>
          <ButtonRounded size="big" fill onClick={handleButtonClick} className={classNames('w-full')}>
            <T id="apply" />
          </ButtonRounded>
        </div>
      )}
    </PopupModalWithTitle>
  );
};

// Milti select Popup content
export const MultiSortPopupContent: FC<
  Omit<SortPopupContentProps, 'alternativeLogic'> & { onFiltersUpdate: (ids: string[]) => void }
> = ({ items, on, toggle, onFiltersUpdate, title = <T id="sortBy" /> }) => {
  const { popup } = useAppEnv();
  const [selectedItems, setSelectedItems] = useState<Map<string, SortListItemType>>(() => new Map());
  // handle toggle state inside popup
  const [internalToggleValue, setInternalToggleValue] = useState(on);
  const { opened, close } = useSortPopup();

  const keepOriginalSelectedItemsAfterUpdate = useCallback(() => {
    const originalSelectedItems = new Map();
    items.forEach(item => {
      item.selected && originalSelectedItems.set(item.id, item);
    });

    setSelectedItems(originalSelectedItems);
  }, [items]);

  const handleClose = useCallback(() => {
    keepOriginalSelectedItemsAfterUpdate();
    close();
  }, [close, keepOriginalSelectedItemsAfterUpdate]);

  const handleButtonClick = useCallback(async () => {
    onFiltersUpdate(Array.from(selectedItems.keys()));

    if (internalToggleValue !== on) toggle?.();

    close();
  }, [onFiltersUpdate, selectedItems, internalToggleValue, on, toggle, close]);

  const handleOptionSelect = useCallback((item: SortListItemType) => {
    setSelectedItems(prevSelectedItems => {
      // Create a copy of the Map
      const updatedItems = new Map(prevSelectedItems);

      if (updatedItems.has(item.id)) {
        updatedItems.delete(item.id);
      } else {
        updatedItems.set(item.id, item);
      }

      return updatedItems; // Return the updated Map
    });
  }, []);

  const handleInternalToggle = useCallback(() => {
    setInternalToggleValue(!internalToggleValue);
  }, [internalToggleValue]);

  const clearOptions = useCallback(async () => {
    setSelectedItems(new Map());
    onFiltersUpdate([]);
    close();
  }, [onFiltersUpdate, close]);

  return (
    <PopupModalWithTitle
      isOpen={opened}
      contentPosition={popup ? 'bottom' : 'center'}
      onRequestClose={handleClose}
      title={title}
      portalClassName="sort-popup"
    >
      <div className="flex flex-col mt-2">
        <ul className={classNames('flex flex-col', popup ? 'px-4' : 'px-12')}>
          {items.map(item => (
            <SortListItem
              key={item.id}
              item={item}
              handleOptionSelect={handleOptionSelect}
              alternativeLogic
              selectedItemId={selectedItems.get(item.id)?.id}
            />
          ))}
        </ul>
      </div>
      {on !== undefined && (
        <div className={classNames(popup ? 'px-4' : 'px-12')}>
          <SortDivider />
          <div className="flex justify-between items-center">
            <span className="text-sm tracking-normal text-white">
              <T id="hideZeroBalances" />
            </span>
            <Switcher on={on} onClick={handleInternalToggle} />
          </div>
        </div>
      )}

      <div className={classNames('mt-8 grid grid-cols-2 gap-4 justify-center', popup ? 'px-4' : 'px-12')}>
        <ButtonRounded size="big" onClick={clearOptions} disabled={selectedItems.size === 0} fill={false}>
          <T id="clean" />
        </ButtonRounded>
        <ButtonRounded size="big" fill onClick={handleButtonClick}>
          <T id="apply" />
        </ButtonRounded>
      </div>
    </PopupModalWithTitle>
  );
};
