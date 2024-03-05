import React, { FC, HTMLAttributes, ReactNode, useCallback, useEffect, useRef, useState } from 'react';

import classNames from 'clsx';
import { Collapse } from 'react-collapse';

import { ReactComponent as ChevronDownIcon } from 'app/icons/chevron-down.svg';
import { ReactComponent as CloseIcon } from 'app/icons/close.svg';
import { ReactComponent as AlertIcon } from 'app/icons/warning.svg';
import { setAnotherSelector, setTestID } from 'lib/analytics';
import { T, t } from 'lib/i18n';
import { merge } from 'lib/utils/merge';

import styles from './alert.module.css';
import { AlertSelectors } from './Alert.selectors';

type AlertType = 'success' | 'warning' | 'error' | 'delegate';

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

  const [bgColorClassName, borderColorClassName, textColorClassName, titleColorClassName] = getColorsByType(type);

  return (
    <div
      ref={ref}
      className={classNames(
        'relative w-full px-3 pb-3 pt-2',
        'flex items-center gap-3',
        bgColorClassName,
        // 'border',
        // borderColorClassName,
        'rounded-md',
        className
      )}
      tabIndex={-1}
      role="alert"
      aria-label={t('alert')}
      {...rest}
    >
      {type === 'warning' && <AlertIcon className="w-6 h-6" style={{ minWidth: 24 }} />}
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

  const [bgColorClassName, borderColorClassName] = getColorsByType(rest.type ?? 'warning');

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
            'absolute right-0 top-0 flex items-center justify-center w-6 h-6 rounded',
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
        return ['bg-green-100', 'border-green-100', 'text-green-700', 'text-green-700'];
      case 'warning':
        return ['bg-primary-alert-bg', 'border-primary-alert-bg', 'text-white', 'text-white'];
      case 'error':
        return ['bg-red-100', 'border-red-700', 'text-red-700', 'text-red-700'];
      case 'delegate':
        return ['bg-blue-150', 'border-blue-750', 'text-blue-750', 'text-blue-500'];
    }
  })();

  return [bgColorClassName, borderColorClassName, textColorClassName, titleColorClassName] as const;
};
