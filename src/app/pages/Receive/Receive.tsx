import React, { FC, useEffect } from 'react';

import clsx from 'clsx';
import { QRCode } from 'react-qr-svg';

import { Alert, HashShortView } from 'app/atoms';
import CopyButton from 'app/atoms/CopyButton';
import { useAppEnv } from 'app/env';
import { ReactComponent as CopyIcon } from 'app/icons/copy.svg';
import { ReactComponent as GlobeIcon } from 'app/icons/globe.svg';
import { ReactComponent as HashIcon } from 'app/icons/hash.svg';
import PageLayout from 'app/layouts/PageLayout';
import { T, t } from 'lib/i18n';
import { useAccount, useTezosDomainsClient } from 'lib/temple/front';
import { useTezosDomainNameByAddress } from 'lib/temple/front/tzdns';
import { useSafeState } from 'lib/ui/hooks';

const ADDRESS_FIELD_VIEWS = [
  {
    Icon: GlobeIcon,
    key: 'domain',
    name: t('domain')
  },
  {
    Icon: HashIcon,
    key: 'hash',
    name: t('hash')
  }
];

const Receive: FC = () => {
  const account = useAccount();
  const { isSupported } = useTezosDomainsClient();
  const address = account.publicKeyHash;
  const { popup } = useAppEnv();

  const [activeView, setActiveView] = useSafeState(ADDRESS_FIELD_VIEWS[1]);

  const { data: reverseName } = useTezosDomainNameByAddress(address);

  useEffect(() => {
    if (!isSupported) {
      setActiveView(ADDRESS_FIELD_VIEWS[1]);
    }
  }, [isSupported, setActiveView]);

  const hash = activeView.key === 'hash' ? address : reverseName || '';

  return (
    <PageLayout isTopbarVisible={false} pageTitle={<>{t('receive')}</>}>
      <div>
        <div className={clsx('w-full mx-auto h-full pb-8', popup ? 'max-w-sm' : 'max-w-screen-xxs')}>
          <div className="text-primary-white text-base-plus mb-4">
            <T id="myAddress" />
          </div>

          <div className="p-4 rounded-2xl-plus bg-primary-card relative">
            <CopyButton type="button" text={hash}>
              <div className="w-11 absolute top-4 right-4 bg-transparent flex justify-end items-center">
                <CopyIcon className="w-6 h-6 text-blue-200 fill-current" />
              </div>
              <div className="break-all text-left text-base-plus" style={{ maxWidth: 271 }}>
                <HashShortView hash={hash} trim={false} />
              </div>
            </CopyButton>
          </div>

          <div className="flex flex-col items-center">
            <div className="p-6 bg-white rounded-2xl self-center my-7">
              <QRCode value={address} bgColor="#f4f4f4" fgColor="#000000" level="L" style={{ width: 196 }} />
            </div>

            <Alert type="warning" title={`${t('attention')}!`} description={t('receiveAlert')} />

            {/* <Deposit address={address} /> */}
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default Receive;

// type AddressFieldExtraSectionProps = {
//   activeView: ViewsSwitcherProps['activeItem'];
//   onSwitch: ViewsSwitcherProps['onChange'];
// };

// const AddressFieldExtraSection = memo<AddressFieldExtraSectionProps>(props => {
//   const { activeView, onSwitch } = props;

//   return (
//     <div className="mb-2 flex justify-end">
//       <ViewsSwitcher activeItem={activeView} items={ADDRESS_FIELD_VIEWS} onChange={onSwitch} />
//     </div>
//   );
// });
