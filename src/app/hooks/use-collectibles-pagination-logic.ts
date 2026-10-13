import { METADATA_ITEMS_PER_PAGE, useMetadataPagination } from './use-metadata-pagination';

export const ITEMS_PER_PAGE = METADATA_ITEMS_PER_PAGE;

export const useCollectiblesPaginationLogic = (allSlugsSorted: string[], initialSize: number) =>
  useMetadataPagination('collectibles', allSlugsSorted, initialSize);
