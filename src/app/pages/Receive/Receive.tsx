import React, { FC, memo, useEffect } from 'react';

import { QRCode } from 'react-qr-svg';

import { HashChip } from 'app/atoms';
import { ReactComponent as GlobeIcon } from 'app/icons/globe.svg';
import { ReactComponent as HashIcon } from 'app/icons/hash.svg';
import PageLayout from 'app/layouts/PageLayout';
import ViewsSwitcher, { ViewsSwitcherProps } from 'app/templates/ViewsSwitcher/ViewsSwitcher';
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

  const [activeView, setActiveView] = useSafeState(ADDRESS_FIELD_VIEWS[1]);

  const { data: reverseName } = useTezosDomainNameByAddress(address);

  useEffect(() => {
    if (!isSupported) {
      setActiveView(ADDRESS_FIELD_VIEWS[1]);
    }
  }, [isSupported, setActiveView]);

  return (
    <PageLayout isTopbarVisible={false} pageTitle={<>{t('receive')}</>}>
      <div className="">
        <div className="w-full max-w-sm mx-auto">
          <div className="text-primary-white text-base-plus mb-4">
            <T id="myAddress" />
          </div>

          <div className="p-4 rounded-2xl-plus bg-primary-card">
            <HashChip hash={activeView.key === 'hash' ? address : reverseName || ''} trim={false} />
          </div>

          <div className="flex flex-col items-center">
            <div className="mb-2 leading-tight text-center">
              <span className="text-sm font-semibold text-gray-700">
                <T id="qrCode" />
              </span>
            </div>

            {/* <div className="p-1 bg-gray-100 border-2 border-gray-300 rounded" style={{ maxWidth: '60%' }}>
              <QRCode bgColor="#f7fafc" fgColor="#000000" level="Q" style={{ width: '100%' }} value={address} />
            </div> */}

            <div className="p-6 mb-8 bg-white rounded-2xl self-center">
              <QRCode value={address} bgColor="#f4f4f4" fgColor="#000000" level="L" style={{ width: 216 }} />
            </div>

            {/* <Deposit address={address} /> */}
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default Receive;

type AddressFieldExtraSectionProps = {
  activeView: ViewsSwitcherProps['activeItem'];
  onSwitch: ViewsSwitcherProps['onChange'];
};

const AddressFieldExtraSection = memo<AddressFieldExtraSectionProps>(props => {
  const { activeView, onSwitch } = props;

  return (
    <div className="mb-2 flex justify-end">
      <ViewsSwitcher activeItem={activeView} items={ADDRESS_FIELD_VIEWS} onChange={onSwitch} />
    </div>
  );
});
