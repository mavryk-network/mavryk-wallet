export type Child = {
  children: JSX.Element;
};

export type DropDownProps = {
  initialShowState?: boolean;
} & Child;

export type CustomDropdownContextType = {
  show: boolean;
  toggle: () => void;
};
