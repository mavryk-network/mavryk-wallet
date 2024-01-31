import React, { memo } from 'react';

import { HashChip } from 'app/atoms';
import { ReactComponent as ClipboardIcon } from 'app/icons/clipboard.svg';
import { TID, T } from 'lib/i18n';
import { OperStackItemInterface, OperStackItemTypeEnum } from 'lib/temple/activity-new/types';
import { ListItemDivider } from 'app/atoms/Divider';

interface Props {
  item: OperStackItemInterface;
  isTiny?: boolean;
}

// TODO delete this after transaction history update
export const OperStackItem = memo<Props>(({ item }) => {
  switch (item.type) {
    case OperStackItemTypeEnum.Delegation:
      return (
        <StackItemBase
          titleNode={<T id="delegation" />}
          argsNode={<StackItemArgs i18nKey="delegationToSmb" args={[item.to]} />}
        />
      );

    case OperStackItemTypeEnum.Origination:
      return <StackItemBase titleNode={<T id="origination" />} />;

    case OperStackItemTypeEnum.Interaction:
      return (
        <StackItemBase
          titleNode={
            <>
              <ClipboardIcon className="mr-1 h-3 w-auto stroke-current" />
              <T id="interaction" />
            </>
          }
          argsNode={<StackItemArgs i18nKey="interactionWithContract" args={[item.with]} />}
        />
      );

    case OperStackItemTypeEnum.TransferFrom:
      return (
        <StackItemBase
          titleNode={
            <>
              ↓ <T id="transfer" />
            </>
          }
          argsNode={<StackItemArgs i18nKey="transferFromSmb" args={[item.from]} />}
        />
      );

    case OperStackItemTypeEnum.TransferTo:
      return (
        <StackItemBase
          titleNode={
            <>
              ↑ <T id="transfer" />
            </>
          }
          argsNode={<StackItemArgs i18nKey="transferToSmb" args={[item.to]} />}
        />
      );

    case OperStackItemTypeEnum.Other:
      return (
        <StackItemBase
          titleNode={item.name
            .split('_')
            .map(w => `${w.charAt(0).toUpperCase()}${w.substring(1)}`)
            .join(' ')}
        />
      );
  }
});

// ---------------------------------

export const OpertionStackItem = memo<Props>(({ item, isTiny }) => {
  const Component = isTiny ? StackItemBaseTiny : StackItemBase;

  switch (item.type) {
    case OperStackItemTypeEnum.Delegation:
      return (
        <Component
          titleNode={<T id="delegation" />}
          argsNode={<StackItemArgs i18nKey="delegationToSmb" args={[item.to]} />}
        />
      );

    case OperStackItemTypeEnum.Origination:
      return <Component titleNode={<T id="origination" />} />;

    case OperStackItemTypeEnum.Interaction:
      return (
        <Component
          titleNode={
            <>
              <T id="interaction" />
            </>
          }
          argsNode={<StackItemArgs i18nKey="interactionWithContract" args={[item.with]} />}
        />
      );

    case OperStackItemTypeEnum.TransferFrom:
      return (
        <Component
          titleNode={
            <>
              <T id="transfer" />
            </>
          }
          argsNode={<StackItemArgs i18nKey="transferFromSmb" args={[item.from]} />}
        />
      );

    case OperStackItemTypeEnum.TransferTo:
      return (
        <Component
          titleNode={
            <>
              <T id="transfer" />
            </>
          }
          argsNode={<StackItemArgs i18nKey="transferToSmb" args={[item.to]} />}
        />
      );

    case OperStackItemTypeEnum.Other:
      return (
        <Component
          titleNode={item.name
            .split('_')
            .map(w => `${w.charAt(0).toUpperCase()}${w.substring(1)}`)
            .join(' ')}
        />
      );
  }
});

interface StackItemBaseProps {
  titleNode: React.ReactNode;
  argsNode?: React.ReactNode;
}

const StackItemBase: React.FC<StackItemBaseProps> = ({ titleNode, argsNode }) => {
  return (
    <div className="flex items-center text-white text-base-plus">
      <div className="flex items-center">{titleNode}</div>
      <span>&nbsp;</span>
      {argsNode}
    </div>
  );
};

const StackItemBaseTiny: React.FC<StackItemBaseProps> = ({ titleNode, argsNode }) => {
  return (
    <div className="flex items-center text-white text-xs">
      <div className="flex items-center">{titleNode}</div>
      <span>&nbsp;</span>
      {argsNode}
    </div>
  );
};

interface StackItemArgsProps {
  i18nKey: TID;
  args: string[];
}

const StackItemArgs = memo<StackItemArgsProps>(({ i18nKey, args }) => (
  <span className="text-white">
    <T
      id={i18nKey}
      substitutions={args.map((value, index) => (
        <span key={index}>
          <HashChip
            className="text-blue-200"
            firstCharsCount={5}
            key={index}
            hash={value}
            type="link"
            showIcon={false}
          />
          {index === args.length - 1 ? null : ', '}
        </span>
      ))}
    />
  </span>
));
