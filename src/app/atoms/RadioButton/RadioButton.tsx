import React, { FC, ReactNode, MouseEvent } from 'react';

import classNames from 'clsx';

import styles from './RadioButton.module.css';

export type RadioButtonProps = {
  id: string;
  name?: string;
  value?: string | number | readonly string[];
  onClick?: (e: MouseEvent<HTMLInputElement>) => void;
  checked: boolean;
  label?: string | ReactNode;
  disabled?: boolean;
  shouldUseChangeHandler?: boolean;
};

export const RadioButton: FC<RadioButtonProps> = ({
  id,
  name,
  value,
  onClick,
  checked,
  label,
  disabled,
  shouldUseChangeHandler = false
}) => {
  return (
    <label htmlFor={id} className={classNames(styles.radioLabel, disabled && styles.disabled)}>
      <input
        className={styles.radioInput}
        type="radio"
        name={name}
        id={id}
        value={value}
        onClick={shouldUseChangeHandler && checked ? undefined : onClick}
        checked={checked}
        readOnly
      />
      <span className={styles.customRadio} />
      {label && label}
    </label>
  );
};
