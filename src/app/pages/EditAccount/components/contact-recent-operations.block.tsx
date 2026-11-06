import React, { FC, useCallback, useEffect, useState } from 'react';

import { SyncSpinner } from 'app/atoms';
import { useAppEnv } from 'app/env';
import { HistoryDetailsPopup } from 'app/templates/History/HistoryDetailsPopup';
import { HistoryItem } from 'app/templates/History/HistoryItem';
import { formatDate, T } from 'lib/i18n';
import { UserHistoryItem } from 'lib/temple/history';
import { useContactRecentOperations } from 'lib/temple/history/use-contact-recent-operations';
import { useRetryCountdown } from 'lib/temple/history/use-retry-countdown';

type ContactRecentOperationsProps = {
  /** Contact address; undefined while the contact has not resolved, so nothing is requested. */
  contactAddress: string | undefined;
};

const formatCheckTime = (updatedAt: string) => formatDate(updatedAt, 'HH:mm');

/** Contact's up-to-three recent operations, rendered from the contact's point of view. */
export const ContactRecentOperations: FC<ContactRecentOperationsProps> = ({ contactAddress }) => {
  const { popup } = useAppEnv();
  const { status, items, updatedAt, retryAvailableAt, retry } = useContactRecentOperations(contactAddress);
  const retrySecondsLeft = useRetryCountdown(retryAvailableAt ?? null);

  const [isOpen, setIsOpen] = useState(false);
  const [activeHistoryItem, setActiveHistoryItem] = useState<UserHistoryItem | null>(null);

  // Closes details when another contact is shown, so a card of the previous contact never stays open.
  // No cleanup is needed because this only resets local UI state.
  useEffect(() => {
    setIsOpen(false);
    setActiveHistoryItem(null);
  }, [contactAddress]);

  const handleRequestClose = useCallback(() => setIsOpen(false), []);

  const handleItemClick = useCallback(
    (id: string) => {
      setIsOpen(true);
      setActiveHistoryItem(items.find(item => item.id === id) ?? null);
    },
    [items]
  );

  const messageStyle = { height: popup ? 200 : 300 };
  const renderMessage = (content: React.ReactNode) => (
    <div style={messageStyle} className="text-sm text-secondary-white flex flex-col gap-2 items-center justify-center">
      {content}
    </div>
  );

  const renderRetry = () =>
    retrySecondsLeft > 0 ? (
      <span>
        <T id="retryInSeconds" substitutions={[String(retrySecondsLeft)]} />
      </span>
    ) : (
      <button type="button" className="text-accent-blue hover:underline" onClick={retry}>
        <T id="retry" />
      </button>
    );

  const renderBody = () => {
    if (status === 'unsupported') {
      return renderMessage(<T id="recentOperationsUnsupported" />);
    }

    if (!items.length) {
      switch (status) {
        case 'preparing':
          return renderMessage(
            <>
              <SyncSpinner />
              <T id="recentOperationsPreparing" />
            </>
          );
        case 'ready':
          return renderMessage(<T id="recentOperationsEmpty" />);
        case 'stale':
          return renderMessage(<T id="recentOperationsStaleEmpty" />);
        case 'error':
          return renderMessage(
            <>
              <T id="recentOperationsLoadError" />
              {renderRetry()}
            </>
          );
        default:
          return <SyncSpinner className="mt-4" />;
      }
    }

    return (
      <>
        {status === 'stale' && updatedAt && (
          <p className="text-xs text-secondary-white mb-2">
            <T id="recentOperationsUpdating" substitutions={[formatCheckTime(updatedAt)]} />
          </p>
        )}
        {status === 'error' && (
          <div className="flex items-center gap-2 text-xs text-secondary-white mb-2">
            {updatedAt && <T id="recentOperationsOutdated" substitutions={[formatCheckTime(updatedAt)]} />}
            <T id="recentOperationsLoadError" />
            {renderRetry()}
          </div>
        )}
        {items.map(historyItem => (
          <HistoryItem
            key={historyItem.id}
            address={contactAddress ?? ''}
            historyItem={historyItem}
            handleItemClick={handleItemClick}
            last={false}
          />
        ))}
        {status === 'loading' && <SyncSpinner className="mt-4" />}
      </>
    );
  };

  return (
    <>
      <p className="mb-2 text-white text-base-plus font-bold">
        <T id="recentOperations" />
      </p>

      <section>{renderBody()}</section>

      <HistoryDetailsPopup
        isOpen={isOpen}
        onRequestClose={handleRequestClose}
        historyItem={activeHistoryItem}
        perspectiveAddress={contactAddress}
      />
    </>
  );
};
