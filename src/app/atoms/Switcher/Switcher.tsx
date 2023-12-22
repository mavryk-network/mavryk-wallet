import React, { FC, HTMLAttributes } from 'react';

import classNames from 'clsx';

import styles from './Swicther.module.css';

export type SwitcherProps = {
  on: boolean;
} & HTMLAttributes<HTMLDivElement>;

export const Switcher: FC<SwitcherProps> = ({ on = false, onClick, className, ...rest }) => {
  return (
    <div className={classNames(styles['toggle-switch'], className)} {...rest}>
      <input
        type="checkbox"
        className={styles['toggle-switch-checkbox']}
        name="toggleSwitch"
        id="toggleSwitch"
        checked={on}
        onClick={onClick}
      />
      <label className={styles['toggle-switch-label']} htmlFor="toggleSwitch">
        <span className={styles['toggle-switch-inner']} />
        <span className={styles['toggle-switch-switch']} />
      </label>
    </div>
  );
};
