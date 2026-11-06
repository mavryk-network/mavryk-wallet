import { useSelector } from 'app/store/root-state.selector';
import { useDormantQuery } from 'lib/query/use-dormant-query';
import { advertisingKeys } from 'lib/query-keys';

/** Advertising remains disabled; retained content can be read without restoring removed surfaces or tracking. */
export const useAdvertisingPromotionQuery = () => {
  const legacy = useSelector(state => state.advertising.activePromotion.data);
  return useDormantQuery(advertisingKeys.active, legacy);
};
