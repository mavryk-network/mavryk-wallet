import { METADATA_ITEMS_PER_PAGE, useMetadataPagination } from './use-metadata-pagination';

export const ITEMS_PER_PAGE = METADATA_ITEMS_PER_PAGE;

export const useRwasPaginationLogic = (allSlugsSorted: string[], initialSize: number) =>
  useMetadataPagination('rwas', allSlugsSorted, initialSize);
