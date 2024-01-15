import * as React from 'react';

import classNames from 'clsx';

import { ReactComponent as LoadingSvg } from 'app/icons/loading.svg';
import { AnalyticsEventCategory, setTestID, TestIDProps, useAnalytics } from 'lib/analytics';

export type ButtonRoundedSizeType = 'small' | 'big';

export type ButtonRoundedProps = React.PropsWithRef<
  React.DetailedHTMLProps<React.ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>
> & { size?: ButtonRoundedSizeType; isLoading?: boolean; fill?: boolean } & TestIDProps;

const btnSmall = 'px-4 py-2 text-base-plus text-white rounded-2xl-plus';
const btnBig = 'px-11 py-3.5 text-base-plus text-white rounded-full';

export const ButtonRounded = React.forwardRef<HTMLButtonElement, ButtonRoundedProps>(
  (
    {
      testID,
      testIDProperties,
      onClick,
      className,
      size = 'small',
      isLoading = false,
      fill = true,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const { trackEvent } = useAnalytics();

    const handleClick = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      testID && trackEvent(testID, AnalyticsEventCategory.ButtonPress, testIDProperties);

      return onClick?.(e);
    };

    return (
      <button
        ref={ref}
        onClick={handleClick}
        disabled={disabled}
        className={classNames(
          'transition ease-in-out duration-100',
          size === 'small' && btnSmall,
          size === 'big' && btnBig,
          fill && !disabled
            ? 'bg-accent-blue hover:bg-accent-blue-hover'
            : 'bg-transparent  border-2 border-solid border-accent-blue',
          isLoading && ' flex justify-center w-24 align-middle',
          disabled && 'bg-gray-40 pointer-events-none cursor-not-allowed border-none text-gray-15',
          className
        )}
        {...props}
        {...setTestID(testID)}
      >
        {isLoading ? (
          <div className="animate-spin">
            <LoadingSvg style={{ width: 16, height: 16 }} />
          </div>
        ) : (
          children
        )}
      </button>
    );
  }
);
