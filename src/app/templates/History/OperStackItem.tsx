import React, { memo } from 'react';

import { HashChip } from 'app/atoms';
import { TID, T } from 'lib/i18n';
import { HistoryItemOpTypeTexts } from 'lib/temple/history/consts';
import { MoneyDiff, isZero } from 'lib/temple/history/helpers';
import {
  IndividualHistoryItem,
  HistoryItemOpTypeEnum,
  HistoryItemDelegationOp,
  HistoryItemTransactionOp,
  HistoryItemOtherOp
} from 'lib/temple/history/types';

import { MoneyDiffView } from '../activity/MoneyDiffView';

interface Props {
  item: IndividualHistoryItem;
  isTiny?: boolean;
  moneyDiff?: MoneyDiff;
}

export const OpertionStackItem = memo<Props>(({ item, isTiny, moneyDiff }) => {
  const Component = isTiny ? StackItemBaseTiny : StackItemBase;

  const componentBaseProps = {
    status: item.status,
    moneyDiff
  };

  switch (item.type) {
    case HistoryItemOpTypeEnum.Delegation:
      const opDelegate = item as HistoryItemDelegationOp;
      return (
        <Component
          {...componentBaseProps}
          titleNode={HistoryItemOpTypeTexts[item.type]}
          argsNode={<StackItemArgs i18nKey="delegationToSmb" args={[opDelegate.newDelegate?.address ?? 'unknown']} />}
        />
      );

    case HistoryItemOpTypeEnum.Origination:
      return <Component {...componentBaseProps} titleNode={HistoryItemOpTypeTexts[item.type]} />;

    case HistoryItemOpTypeEnum.Interaction:
      const opInteract = item as HistoryItemTransactionOp;
      return (
        <Component
          {...componentBaseProps}
          titleNode={HistoryItemOpTypeTexts[item.type]}
          argsNode={<StackItemArgs i18nKey="interactionWithContract" args={[opInteract.destination.address]} />}
        />
      );
    case HistoryItemOpTypeEnum.Swap:
      const opSwap = item as HistoryItemTransactionOp;
      return (
        <Component
          {...componentBaseProps}
          titleNode={HistoryItemOpTypeTexts[item.type]}
          argsNode={<StackItemArgs i18nKey="swappedContract" args={[opSwap.destination.address]} />}
        />
      );

    case HistoryItemOpTypeEnum.TransferFrom:
      const opFrom = item as HistoryItemTransactionOp;
      return (
        <Component
          {...componentBaseProps}
          titleNode={HistoryItemOpTypeTexts[item.type]}
          argsNode={<StackItemArgs i18nKey="transferFromSmb" args={[opFrom.source.address]} />}
        />
      );

    case HistoryItemOpTypeEnum.TransferTo:
      const opTo = item as HistoryItemTransactionOp;
      return (
        <Component
          {...componentBaseProps}
          titleNode={HistoryItemOpTypeTexts[item.type]}
          argsNode={<StackItemArgs i18nKey="transferToSmb" args={[opTo.destination.address]} />}
        />
      );
    // Other
    case HistoryItemOpTypeEnum.Other:
    default:
      console.log(item.type, 'other ?');
      const opOther = item as HistoryItemOtherOp;
      const titleNode =
        item.type === 5
          ? HistoryItemOpTypeTexts[item.type]
          : opOther.name
          ? opOther.name
              .split('_')
              .map(w => `${w.charAt(0).toUpperCase()}${w.substring(1)}`)
              .join(' ')
          : 'unknown';

      return <Component {...componentBaseProps} titleNode={titleNode} />;
  }
});

interface StackItemBaseProps {
  titleNode: React.ReactNode;
  argsNode?: React.ReactNode;
  moneyDiff?: MoneyDiff;
  status?: string;
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

const StackItemBaseTiny: React.FC<StackItemBaseProps> = ({ titleNode, argsNode, moneyDiff, status }) => {
  return (
    <div className="flex items-center justify-between text-white text-xs h-12 border-b border-divider">
      <div className="flex items-center">
        <div className="flex items-center">{titleNode}</div>
        <span>&nbsp;</span>
        {argsNode}
      </div>

      {moneyDiff && !isZero(moneyDiff.diff) && (
        <MoneyDiffView
          assetId={moneyDiff.assetSlug}
          diff={moneyDiff.diff}
          pending={status === 'pending'}
          className="flex flex-col"
          moneyClassname="text-sm"
        />
      )}
    </div>
  );
};

interface StackItemArgsProps {
  i18nKey: TID;
  args: string[];
}

const StackItemArgs = memo<StackItemArgsProps>(({ i18nKey, args }) => {
  const handleHashClick = (e: React.MouseEvent<HTMLSpanElement>) => {
    e.stopPropagation();
  };

  return (
    <span className="text-white">
      <T
        id={i18nKey}
        substitutions={args.map((value, index) => (
          <span key={index} onClick={handleHashClick}>
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
  );
});
