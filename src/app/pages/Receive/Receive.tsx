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
      <div className={clsx('w-full mx-auto h-full flex flex-col', popup ? 'max-w-sm pb-8' : 'max-w-screen-xxs pb-16 ')}>
        <div className="text-secondary-white text-sm mb-3">
          <T id="myAddress" />
        </div>

        <CopyButton
          type="button"
          text={hash}
          className="flex items-center gap-2 w-full px-3 py-3 rounded-xl bg-primary-card"
        >
          <div className="text-[14px] font-mono text-white flex-1 min-w-0 overflow-hidden whitespace-nowrap">
            <HashShortView hash={hash} trim={false} />
          </div>
          <CopyIcon className="w-4 h-4 text-blue-200 fill-current flex-shrink-0" />
        </CopyButton>

        <div className="flex flex-col items-center">
          <div className="p-6 bg-white rounded-2xl self-center my-6">
            <QRCode value={address} bgColor="#f4f4f4" fgColor="#000000" level="L" style={{ width: 196 }} />
          </div>

          <Alert type="warning" title={`${t('attention')}!`} description={t('receiveAlert')} />

          {/* <Deposit address={address} /> */}
        </div>
      </div>
      <div className="flex-1"></div>
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
