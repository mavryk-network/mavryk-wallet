import React, { FC, ReactNode } from 'react';

import { ABTestGroup } from 'lib/apis/temple';

import { useAbTestGroupName } from 'lib/store/zustand/ui.store';

interface ABContainerProps {
  groupAComponent: ReactNode;
  groupBComponent: ReactNode;
}

const ABContainer: FC<ABContainerProps> = ({ groupAComponent, groupBComponent }) => {
  const abGroup = useAbTestGroupName();

  return abGroup === ABTestGroup.B ? <>{groupBComponent}</> : <>{groupAComponent}</>;
};

export default ABContainer;
