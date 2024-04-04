import React, { HTMLAttributes, forwardRef, useCallback, useEffect, useId, useState } from 'react';

import classNames from 'clsx';

import { checkedHandler } from 'lib/ui/inputHandlers';

import styles from './Swicther.module.css';

export type SwitcherProps = {
  on?: boolean;
  onChange?: (checked: boolean, event: React.ChangeEvent<HTMLInputElement>) => void;
  testId?: string;
  disabled?: boolean;
} & Omit<HTMLAttributes<HTMLInputElement>, 'onChange'>;

export const Switcher = forwardRef<HTMLInputElement, SwitcherProps>(
  ({ on = false, onClick, onChange, disabled, ...rest }, ref) => {
    const [localChecked, setLocalChecked] = useState(() => on ?? false);
    const id = useId();

    useEffect(() => {
      setLocalChecked(prevChecked => on ?? prevChecked);
    }, [setLocalChecked, on]);

    const handleChange = useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        const { checked: toChecked } = event.target;
        checkedHandler(event, onChange && (() => onChange(toChecked, event)), setLocalChecked);
      },
      [onChange, setLocalChecked]
    );

    return (
      <div className={classNames(styles['toggle-switch'], disabled && 'opacity-75 pointer-events-none')}>
        <input
          ref={ref}
          type="checkbox"
          className={styles['toggle-switch-checkbox']}
          name="toggleSwitch"
          id={id}
          checked={localChecked}
          onClick={onClick}
          onChange={handleChange}
          readOnly
          {...rest}
        />
        <label className={styles['toggle-switch-label']} htmlFor={id}>
          <span className={styles['toggle-switch-inner']} />
          <span className={styles['toggle-switch-switch']} />
        </label>
      </div>
    );
  }
);
