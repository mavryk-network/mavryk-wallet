import React, { ReactNode } from 'react';

import clsx from 'clsx';

interface Props {
  className: string;
  label: ReactNode;
  description?: ReactNode;
  warning?: ReactNode;
  id?: string;
}

export const FieldLabel: React.FC<Props> = ({ label, className, description, warning, id }) => (
  <label className={clsx(className, 'leading-tight flex flex-col')} htmlFor={id}>
    <span className="text-base font-normal text-primary-white">{label}</span>

    {description && <span className="mt-1 text-sm text-secondary-white">{description}</span>}

    {warning && <span className="mt-1 text-xs font-medium text-red-600">{warning}</span>}
  </label>
);
