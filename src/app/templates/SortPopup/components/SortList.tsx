import React, { FC, useCallback, useMemo } from 'react';

import classNames from 'clsx';

import { RadioButton } from 'app/atoms/RadioButton';
import { ReactComponent as SortIcon } from 'app/icons/sort.svg';
import { T } from 'lib/i18n';

import { useSortPopup } from '../SortPopup';
import { SortListItemType } from '../SortPopup.types';

export type SortListItemProps = {
  item: SortListItemType;
  handleOptionSelect: (item: SortListItemType) => void;
  alternativeLogic: boolean;
  selectedItemId: string | undefined;
};

export const SortListItem: FC<SortListItemProps> = ({ item, alternativeLogic, handleOptionSelect, selectedItemId }) => {
  const { nameI18nKey, selected, disabled = false, onClick, id } = item;

  const checked = useMemo(
    () => (alternativeLogic ? id === selectedItemId : selected),
    [alternativeLogic, id, selected, selectedItemId]
  );

  const handleRadioClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
  }, []);

  return (
    <div
      className="flex items-center justify-between py-3 cursor-pointer"
      onClick={alternativeLogic ? () => handleOptionSelect(item) : onClick}
    >
      <div className="flex items-center">
        <span className="text-base-plus text-white">
          <T id={nameI18nKey} />
        </span>
      </div>
      <RadioButton id={id} checked={checked} disabled={disabled} onClick={handleRadioClick} />
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

export const SortDivider = () => {
  return <div className="w-full h-0 border-b border-divider mt-4 mb-6" />;
};
