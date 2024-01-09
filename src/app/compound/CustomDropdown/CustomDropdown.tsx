import React, { ReactNode, createContext, useCallback, useMemo } from 'react';

import classNames from 'clsx';

import { ReactComponent as ArrowIcon } from 'app/icons/chevron-down.svg';

import styles from './CustomDropdown.module.css';
import { Child, CustomDropdownContextType, DropDownProps } from './CustomDropdown.types';

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const CusromDropdownContext = createContext<CustomDropdownContextType>(undefined!);
CusromDropdownContext.displayName = 'CusromDropdownContext';

export function Dropdown({ children, initialShowState = false }: DropDownProps) {
  const [show, setShow] = React.useState(initialShowState);
  const toggle = useCallback(() => setShow(!show), [show]);

  const memoizedState = useMemo(() => ({ show, toggle }), [show, toggle]);

  return <CusromDropdownContext.Provider value={memoizedState}>{children}</CusromDropdownContext.Provider>;
}

export function useToggle() {
  const context = React.useContext(CusromDropdownContext);
  if (context === undefined) {
    throw new Error('useToggle must be used within a <Toggle />');
  }
  return context;
}

export function DropdownOpened({ children }: Child) {
  const { show } = useToggle();
  return show ? <div className={styles.showDropdown}>{children}</div> : null;
}

export function DropdownClosed({ children }: Child) {
  const { show } = useToggle();
  return show ? null : <div className={styles.hideDropdown}>{children}</div>;
}

type DropdownHeaderProps = {
  header: string | ReactNode;
  subHeader: string | ReactNode;
  className?: string;
  disabled?: boolean;
};

export function DropdownHeader({ header, subHeader, className, disabled = false }: DropdownHeaderProps) {
  const { show, toggle } = useToggle();

  return (
    <section
      className={classNames('w-full flex items-start gap-4 stroke-2 cursor-pointer', show && 'pb-4', className)}
      onClick={disabled ? undefined : toggle}
    >
      <div className="flex flex-col gap-1">
        <div className="text-white text-base-plus">{header}</div>
        <div className="text-sm text-secondary-white text-left">{subHeader}</div>
      </div>

      <ArrowIcon
        className={classNames(
          'w-8 h-auto stroke-white stroke-2 transition ease-in-out duration-200 cursor-pointer',
          show && 'transform rotate-180',
          disabled && 'pointer-events-none opacity-5'
        )}
      />
    </section>
  );
}
