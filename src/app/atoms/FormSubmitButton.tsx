import React, { FC, useMemo } from 'react';

import classNames from 'clsx';

import { setAnotherSelector } from 'lib/analytics';

import { ButtonRounded } from '../molecules/ButtonRounded';

import { ButtonProps } from './Button';

interface FormSubmitButtonProps extends ButtonProps {
  keepChildrenWhenLoading?: boolean;
  loading?: boolean;
  small?: boolean;
  textClassNames?: string;
}

export const FormSubmitButton: FC<FormSubmitButtonProps> = ({
  loading,
  keepChildrenWhenLoading,
  small,
  disabled,
  className,
  textClassNames,
  children,
  ...rest
}) => {
  const classNameMemo = classNames(
    'relative flex items-center justify-center h-12 gap-x-2',
    'text-primary-white font-normal rounded-full border-2 border-accent-blue',
    'transition duration-200 ease-in-out w-max',
    small ? 'px-6 py-2 text-sm' : 'px-8 py-2.5 text-base',
    loading || disabled
      ? 'opacity-75 pointer-events-none'
      : 'hover:opacity-100 focus:opacity-100 shadow-sm hover:shadow focus:shadow',
    className
  );

  const otherProps = useMemo(() => (loading ? setAnotherSelector('loading', '') : null), [loading]);

  return (
    <ButtonRounded className={classNameMemo} disabled={disabled} isLoading={loading} {...rest} {...otherProps}>
      {loading ? keepChildrenWhenLoading && children : children}
    </ButtonRounded>
  );
};
