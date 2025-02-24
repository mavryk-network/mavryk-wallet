import * as React from 'react';

import classNames from 'clsx';

import { ReactComponent as LoadingSvg } from 'app/icons/loading.svg';
import { AnalyticsEventCategory, setTestID, TestIDProps, useAnalytics } from 'lib/analytics';

export const BTN_PRIMARY = 'primary';
export const BTN_ERROR = 'error';

export type ButtonRoundedType = typeof BTN_PRIMARY | typeof BTN_ERROR;

export type ButtonRoundedSizeType = 'small' | 'big' | 'xs';

export type ButtonRoundedProps = React.PropsWithRef<
  React.DetailedHTMLProps<React.ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>
> & {
  size?: ButtonRoundedSizeType;
  btnType?: ButtonRoundedType;
  isLoading?: boolean;
  fill?: boolean;
} & TestIDProps;

const btnXs = 'px-4 py-1 text-base-plus text-white rounded-2xl-plus';
const btnSmall = 'px-4 py-2 text-base-plus text-white rounded-2xl-plus';
const btnBig = 'px-11 py-3.5 text-base-plus text-white rounded-full';

export const ButtonRounded = React.forwardRef<HTMLButtonElement, ButtonRoundedProps>(
  (
    {
      btnType = BTN_PRIMARY,
      size = 'small',
      isLoading = false,
      fill = true,
      onClick,
      className,
      disabled,
      testID,
      testIDProperties,
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

    const [bgColor, bgColorHover, borderColor] = (() => {
      switch (btnType) {
        case BTN_PRIMARY:
          return ['bg-accent-blue', 'bg-accent-blue-hover', 'accent-blue'];
        case BTN_ERROR:
          return ['bg-primary-error', 'bg-red-800', 'primary-error'];
      }
    })();

    return (
      <button
        ref={ref}
        onClick={handleClick}
        disabled={disabled}
        className={classNames(
          'transition ease-in-out duration-200',
          size === 'small' && btnSmall,
          size === 'big' && btnBig,
          size === 'xs' && btnXs,
          fill
            ? `${bgColor} hover:${bgColorHover} border`
            : classNames('bg-transparent', size === 'xs' ? 'border' : 'border-2', `border-solid hover:${bgColorHover}`), // fill | outline styles
          disabled ? 'border-transparent' : `border-${borderColor}`, // border color
          isLoading && ' flex justify-center w-24 align-middle', // loading
          disabled && 'bg-gray-40 pointer-events-none cursor-not-allowed  text-gray-15', // disabled styles
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
