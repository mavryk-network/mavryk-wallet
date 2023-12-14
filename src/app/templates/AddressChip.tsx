import React, { FC } from 'react';

import classNames from 'clsx';

import { HashChip } from 'app/atoms';
import { TestIDProps } from 'lib/analytics';
import { useStorage } from 'lib/temple/front';
import { useTezosDomainNameByAddress } from 'lib/temple/front/tzdns';

type Props = TestIDProps & {
  pkh: string;
  className?: string;
  small?: boolean;
  modeSwitch?: TestIDProps;
};

const TZDNS_MODE_ON_STORAGE_KEY = 'domain-displayed';

const AddressChip: FC<Props> = ({ pkh, className, small, modeSwitch, ...rest }) => {
  const { data: tzdnsName } = useTezosDomainNameByAddress(pkh);

  const [domainDisplayed] = useStorage(TZDNS_MODE_ON_STORAGE_KEY, false);

  return (
    <div className={classNames('flex', className)}>
      {tzdnsName && domainDisplayed ? (
        <HashChip hash={tzdnsName} firstCharsCount={7} lastCharsCount={10} small={small} {...rest} />
      ) : (
        <HashChip hash={pkh} small={small} {...rest} />
      )}
    </div>
  );
};

export default AddressChip;
