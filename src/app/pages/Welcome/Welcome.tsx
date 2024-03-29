import React, { FC } from 'react';

import classNames from 'clsx';

import DocBg from 'app/a11y/DocBg';
import { ReactComponent as ImportIcon } from 'app/icons/import.svg';
import { ReactComponent as PlusIcon } from 'app/icons/plus.svg';
import { ReactComponent as LogoDesktopIcon } from 'app/misc/logo-desktop.svg';
import { TestIDProps } from 'lib/analytics';
import { TID, T } from 'lib/i18n';
import { Link } from 'lib/woozie';

import { useABTestingLoading } from '../../hooks/use-ab-testing-loading';

import { WelcomeSelectors } from './Welcome.selectors';

interface TSign extends TestIDProps {
  key: string;
  linkTo: string;
  filled: boolean;
  Icon: ImportedSVGComponent;
  titleI18nKey: TID;
  descriptionI18nKey: TID;
}

const SIGNS: TSign[] = [
  {
    key: 'create',
    linkTo: '/create-wallet',
    filled: true,
    Icon: PlusIcon,
    titleI18nKey: 'createNewAccount',
    descriptionI18nKey: 'createNewAccountDescription',
    testID: WelcomeSelectors.createNewWallet
  },
  {
    key: 'import',
    linkTo: '/import-wallet',
    filled: false,
    Icon: ImportIcon,
    titleI18nKey: 'importExistingWallet',
    descriptionI18nKey: 'importExistingWalletDescription',
    testID: WelcomeSelectors.importExistingWallet
  }
];

const Welcome: FC = () => {
  useABTestingLoading();

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 219 }}>
      <DocBg bgClassName={'fullPageBg'} />
      <div className="py-9 flex justify-center">
        <LogoDesktopIcon />
      </div>
      <div
        className={classNames(
          'w-full max-w-screen-sm mx-auto',
          'px-20 pt-11 pb-21 bg-primary-bg',
          'flex flex-col items-center justify-center'
        )}
        style={{ maxWidth: 600 }}
      >
        <p className="text-xl leading-6 tracking-tight text-white mb-8">
          <T id="welcome" />
        </p>
        <div className={classNames('w-full', 'flex flex-col items-center gap-4')}>
          {SIGNS.map(({ key, linkTo, filled, Icon, titleI18nKey, descriptionI18nKey, testID }, idx) => (
            <div key={key} className={classNames('w-full')}>
              <Link
                to={linkTo}
                className={classNames(
                  'relative block',
                  'w-full h-154px',
                  'bg-accent-blue',
                  'overflow-hidden rounded-3xl',
                  'transition duration-300 ease-in-out',
                  'transform hover:scale-110 focus:scale-110',
                  'shadow-md hover:shadow-lg focus:shadow-lg'
                )}
                testID={testID}
              >
                <div className={classNames('absolute inset-0', 'p-2px rounded-3xl')}>
                  <div
                    className={classNames(
                      'w-full h-full',
                      'overflow-hidden rounded-3xl',
                      'px-11 pt-4 pb-6',
                      'flex flex-col',
                      filled ? 'text-white' : 'shadow-inner bg-primary-card text-white',
                      'text-shadow-black-orange'
                    )}
                  >
                    <div className={classNames('flex flex-col items-center justify-center mb-4')}>
                      <Icon className={classNames('w-8 h-8', filled && 'stroke-2 stroke-current')} />
                    </div>

                    <T id={titleI18nKey}>
                      {message => <h1 className="text-xl leading-6 tracking-tight text-center">{message}</h1>}
                    </T>

                    <div className="mt-2" style={{ width: idx === 0 ? 340 : 352 }}>
                      <T id={descriptionI18nKey}>
                        {message => <p className={classNames('text-center', 'text-sm', 'text-white')}>{message}</p>}
                      </T>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Welcome;
