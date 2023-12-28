import { TID } from 'lib/i18n';

export type SortPopupContext = {
  opened: boolean;
  open: () => void;
  close: () => void;
};

export type SortListItemType = {
  id: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  nameI18nKey: TID;
};
