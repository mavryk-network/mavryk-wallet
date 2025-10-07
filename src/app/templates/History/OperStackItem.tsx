import React, { ReactNode, memo } from 'react';

import clsx from 'clsx';

import { HashChip } from 'app/atoms';
import { TID, T, t } from 'lib/i18n';
import { useMultipleAssetsMetadata } from 'lib/metadata';
import { HistoryItemOpTypeTexts } from 'lib/temple/history/consts';
import { MoneyDiff, isZero } from 'lib/temple/history/helpers';
import {
  IndividualHistoryItem,
  HistoryItemOpTypeEnum,
  HistoryItemDelegationOp,
  HistoryItemTransactionOp,
  HistoryItemOtherOp,
  UserHistoryItem,
  HistoryItemOriginationOp,
  HistoryItemStakingOp
} from 'lib/temple/history/types';

import { MoneyDiffView } from './MoneyDiffView';
import { getAssetsFromOperations, getStakingMessage } from './utils';

interface Props {
  item: IndividualHistoryItem;
  isTiny?: boolean;
  moneyDiff?: MoneyDiff;
  originalHistoryItem?: UserHistoryItem;
  last?: boolean;
  userAddress: string;
}

export const OpertionStackItem = memo<Props>(({ item, isTiny, moneyDiff, originalHistoryItem, last, userAddress }) => {
  const Component = isTiny ? StackItemBaseTiny : StackItemBase;

  const componentBaseProps = {
    status: item.status,
    moneyDiff,
    last
  };

  const slugs = getAssetsFromOperations(originalHistoryItem);
  const tokensMetadata = useMultipleAssetsMetadata(slugs);

  switch (item.type) {
    case HistoryItemOpTypeEnum.Staking:
      const opStaking = item as HistoryItemStakingOp;
      const isValidator = opStaking.baker?.address === userAddress;
      const stakingMessage = getStakingMessage(
        opStaking.action,
        isValidator,
        opStaking.sender?.address ?? 'unknown',
        opStaking.baker?.address ?? 'unknown'
      );

      return (
        <Component
          {...componentBaseProps}
          titleNode={stakingMessage.titleNode}
          argsNode={<StackItemArgs i18nKey="emptyKey" args={stakingMessage.args} />}
        />
      );
    case HistoryItemOpTypeEnum.Delegation:
      const opDelegate = item as HistoryItemDelegationOp;

      const sourceAddress = opDelegate.source?.address;
      const isDelegator =
        opDelegate.prevDelegate?.address === userAddress || opDelegate.newDelegate?.address === userAddress;

      if (isDelegator) {
        const isDelegatorLeft =
          opDelegate.prevDelegate?.address === userAddress && opDelegate.newDelegate?.address !== userAddress;

        return (
          <Component
            {...componentBaseProps}
            titleNode={isDelegatorLeft ? 'Delegator' : 'New delegator'}
            argsNode={
              <StackItemArgs
                i18nKey="emptyKey"
                args={[sourceAddress ?? 'unknown', isDelegatorLeft ? <> left</> : '']}
              />
            }
          />
        );
      }

      const isPrevDelegate = opDelegate.prevDelegate?.address;
      return (
        <Component
          {...componentBaseProps}
          titleNode={isPrevDelegate ? 'Left delegate' : 'Delegate to'}
          argsNode={
            <StackItemArgs
              i18nKey="emptyKey"
              args={
                isPrevDelegate
                  ? [
                      opDelegate.prevDelegate?.address ?? 'unknown',
                      <> and re-delegate to </>,
                      opDelegate.newDelegate?.address
                    ]
                  : [opDelegate.newDelegate?.address]
              }
            />
          }
        />
      );

    case HistoryItemOpTypeEnum.Origination:
      const opOriginate = item as HistoryItemOriginationOp;
      return (
        <Component
          {...componentBaseProps}
          titleNode={HistoryItemOpTypeTexts[item.type]}
          argsNode={
            <StackItemArgs
              i18nKey="originationOnContract"
              args={[opOriginate.originatedContract?.address ?? opOriginate.hash]}
            />
          }
        />
      );

    case HistoryItemOpTypeEnum.Interaction:
      const opInteract = item as HistoryItemTransactionOp;

      return (
        <Component
          {...componentBaseProps}
          titleNode={HistoryItemOpTypeTexts[item.type]}
          argsNode={
            <StackItemArgs
              i18nKey="interactionOnContract"
              args={[
                <span className="text-accent-blue">{opInteract.entrypoint}</span>,
                (opInteract.destination?.address ?? opInteract.source?.address) || opInteract.hash
              ]}
            />
          }
        />
      );
    case HistoryItemOpTypeEnum.Multiple:
      const opMultiple = item as HistoryItemTransactionOp;
      return (
        <Component
          {...componentBaseProps}
          titleNode={'Called'}
          argsNode={
            <StackItemArgs
              i18nKey="multipleInteractionOnContract"
              args={[
                opMultiple.destination.address,
                <span>{originalHistoryItem ? originalHistoryItem?.operations.length - 1 : 1} more</span>
              ]}
            />
          }
        />
      );
    case HistoryItemOpTypeEnum.Swap:
      // const opSwap = item as HistoryItemTransactionOp;
      const symbol1 = (tokensMetadata && tokensMetadata[tokensMetadata.length - 1]?.symbol) ?? '?';
      const symbol2 = (tokensMetadata && tokensMetadata[0]?.symbol) ?? '?';

      return (
        <Component
          {...componentBaseProps}
          titleNode={HistoryItemOpTypeTexts[item.type]}
          argsNode={
            <div className="text-sm text-white">
              <span className="text-accent-blue">{symbol1}&nbsp;</span>
              to
              <span className="text-accent-blue">&nbsp;{symbol2}</span>
            </div>
          }
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
          argsNode={<StackItemArgs i18nKey="transferToSmb" args={[opTo.destination?.address ?? 'unkwonn']} />}
        />
      );
    case HistoryItemOpTypeEnum.Reveal:
      const opReveal = item as HistoryItemTransactionOp;
      return (
        <Component
          {...componentBaseProps}
          titleNode={HistoryItemOpTypeTexts[item.type]}
          argsNode={<StackItemArgs i18nKey="revealOperationType" args={[opReveal.source.address]} />}
        />
      );
    // Other
    case HistoryItemOpTypeEnum.Other:
    default:
      const opOther = item as HistoryItemOtherOp;

      const titleNode = opOther.name
        ? opOther.name
            .split('_')
            .map(w => `${w.charAt(0).toUpperCase()}${w.substring(1)}`)
            .join(' ')
        : opOther.type === 5
        ? HistoryItemOpTypeTexts[item.type]
        : 'unknown';

      return (
        <Component
          {...componentBaseProps}
          titleNode={titleNode}
          argsNode={
            <StackItemArgs
              // using reveal i18n to get empty string
              i18nKey="revealOperationType"
              args={[opOther.destination?.address || opOther.source.address || opOther.hash]}
            />
          }
        />
      );
  }
});

interface StackItemBaseProps {
  titleNode: React.ReactNode;
  argsNode?: React.ReactNode;
  moneyDiff?: MoneyDiff;
  status?: string;
  last?: boolean;
}

const StackItemBase: React.FC<StackItemBaseProps> = ({ titleNode, argsNode }) => {
  return (
    <div className="flex items-start text-white text-sm">
      <div>
        {titleNode}
        <span>&nbsp;</span>
        {argsNode}
      </div>
    </div>
  );
};

const StackItemBaseTiny: React.FC<StackItemBaseProps> = ({ titleNode, argsNode, moneyDiff, status, last = false }) => {
  return (
    <div
      className={clsx(
        'flex items-start justify-between text-white text-xs py-2',
        moneyDiff && !isZero(moneyDiff.diff) ? 'h-12' : 'h-9',
        !last ? 'border-b border-divider' : 'h-auto'
      )}
    >
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
          className="flex flex-col -mt-2px"
          moneyClassname="text-sm"
        />
      )}
    </div>
  );
};

interface StackItemArgsProps {
  i18nKey: TID;
  args: (string | ReactNode | Element)[];
}

const StackItemArgs = memo<StackItemArgsProps>(({ i18nKey, args }) => {
  const handleHashClick = (e: React.MouseEvent<HTMLSpanElement>) => {
    e.stopPropagation();
  };

  return (
    <span className="text-white break-all">
      <T
        id={i18nKey}
        substitutions={args.map((value, index) => {
          return typeof value === 'string' ? (
            <span key={index} onClick={handleHashClick}>
              <HashChip
                className="text-blue-200"
                firstCharsCount={5}
                key={index}
                hash={value}
                type="link"
                showIcon={false}
              />
            </span>
          ) : (
            value
          );
        })}
      />
    </span>
  );
});
