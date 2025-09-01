import React, { FC, HTMLAttributes, ReactNode, useCallback, useEffect, useRef, useState } from 'react';

import classNames from 'clsx';
import { Collapse } from 'react-collapse';

import { ReactComponent as ErrorIcon } from 'app/icons/alert-error.svg';
import { ReactComponent as ChevronDownIcon } from 'app/icons/chevron-down.svg';
import { ReactComponent as CloseIcon } from 'app/icons/close.svg';
import { ReactComponent as InfoIcon } from 'app/icons/info-secondary.svg';
import { ReactComponent as AlertIcon } from 'app/icons/warning.svg';
import { setAnotherSelector, setTestID } from 'lib/analytics';
import { t } from 'lib/i18n';
import { merge } from 'lib/utils/merge';

import styles from './alert.module.css';
import { AlertSelectors } from './Alert.selectors';

type AlertType = 'success' | 'warning' | 'error' | 'delegate' | 'info';

type AlertProps = Omit<HTMLAttributes<HTMLDivElement>, 'title'> & {
  type?: AlertType;
  title?: ReactNode;
  description: ReactNode;
  autoFocus?: boolean;
  closable?: boolean;
  onClose?: () => void;
};

export const Alert: FC<AlertProps> = ({
  type = 'warning',
  title,
  description,
  autoFocus,
  className,
  closable,
  onClose,
  ...rest
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoFocus) {
      ref.current?.focus();
    }
  }, [autoFocus]);

  const [bgColorClassName, _, textColorClassName, titleColorClassName] = getColorsByType(type);
  const Icon = getIconByType(type);

  return (
    <div
      ref={ref}
      className={classNames(
        'relative w-full px-3 pb-3 pt-2',
        'flex items-center gap-3',
        'rounded-md',
        bgColorClassName,
        className
      )}
      tabIndex={-1}
      role="alert"
      aria-label={t('alert')}
      {...rest}
    >
      {Icon && <Icon className="w-6 h-6" style={{ minWidth: 24 }} />}
      <div>
        {title && (
          <h2
            className={classNames('text-base-plus', titleColorClassName)}
            {...setTestID(AlertSelectors.alertTitle)}
            {...setAnotherSelector('type', type)}
          >
            {title}
          </h2>
        )}
        {description && (
          <div
            className={classNames('text-sm break-words mt-1', textColorClassName)}
            {...setTestID(AlertSelectors.alertDescription)}
            style={{ wordBreak: 'break-word' }}
          >
            {description}
          </div>
        )}
      </div>
      {closable && (
        <button className="absolute top-3 right-3" onClick={onClose} type="button">
          <CloseIcon className="w-auto h-5 stroke-current" style={{ strokeWidth: 2 }} />
        </button>
      )}
    </div>
  );
};

type AlertWithCollapseProps = AlertProps & {
  children: React.ReactNode;
  wrapperClassName?: string;
};

export const AlertWithCollapse: FC<AlertWithCollapseProps> = ({ wrapperClassName, children, ...rest }) => {
  const [showDetails, setShowDetails] = useState(false);

  const toggleShowDetails = useCallback(() => setShowDetails(prevValue => !prevValue), []);

  const [_, borderColorClassName] = getColorsByType(rest.type ?? 'warning');

  return (
    <div
      className={merge(
        'mt-4 rounded-lg flex flex-col border-2 my-2 justify-center',
        borderColorClassName,
        wrapperClassName
      )}
    >
      <div className="relative flex justify-center">
        <Alert {...rest} />
        <button
          className={classNames(
            'absolute right-4 top-4 flex items-center justify-center w-6 h-6 rounded-lg',
            'text-white transform transition-transform duration-500',
            showDetails && 'rotate-180'
          )}
          onClick={toggleShowDetails}
        >
          <ChevronDownIcon className="w-6 h-6 stroke-1 stroke-white" />
        </button>
      </div>
      <Collapse
        theme={{ collapse: styles.ReactCollapse }}
        isOpened={showDetails}
        initialStyle={{ height: '0px', overflow: 'hidden' }}
      >
        <div className="flex flex-col py-2 px-1">{children}</div>
      </Collapse>
    </div>
  );
};

const getColorsByType = (type: AlertType) => {
  const [bgColorClassName, borderColorClassName, textColorClassName, titleColorClassName] = (() => {
    switch (type) {
      case 'success':
        return ['bg-primary-success-bg', 'border-primary-success-bg', 'text-white', 'text-white'];
      case 'warning':
        return ['bg-primary-alert-bg', 'border-primary-alert-bg', 'text-white', 'text-white'];
      case 'error':
        return ['bg-primary-alert-error', 'border-primary-alert-error', 'text-white', 'text-white'];
      case 'delegate':
        return ['bg-accent-blue-hover', 'border-accent-blue-hover', 'text-white', 'text-white'];
      case 'info':
        return ['bg-primary-info-hover', 'border-primary-info-hover', 'text-white', 'text-white'];
    }
  })();

  return [bgColorClassName, borderColorClassName, textColorClassName, titleColorClassName] as const;
};

const getIconByType = (type: AlertType) => {
  switch (type) {
    case 'warning':
      return AlertIcon;
    case 'error':
      return ErrorIcon;
    case 'info':
      return InfoIcon;
    default:
      return null;
  }
};
