import React, { FC, ReactNode, ChangeEvent } from 'react';

import classNames from 'clsx';

import styles from './RadioButton.module.css';

export type RadioButtonProps = {
  id: string;
  name?: string;
  value?: string | number | readonly string[];
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  checked: boolean;
  label?: string | ReactNode;
  disabled?: boolean;
};

export const RadioButton: FC<RadioButtonProps> = ({ id, name, value, onChange, checked, label, disabled }) => {
  return (
    <label htmlFor={id} className={classNames(styles.radioLabel, disabled && styles.disabled)}>
      <input
        className={styles.radioInput}
        type="radio"
        name={name}
        id={id}
        value={value}
        onChange={onChange}
        checked={checked}
      />
      <span className={styles.customRadio} />
      {label && label}
    </label>
  );
};
