import { buildApolloClient } from '../apollo';

export {
  buildGetCollectibleExtraQuery,
  buildGetCollectiblesQuery,
  buildGetGalleriesAttributesCountsQuery
} from './queries';

// TODO add mavrk api for tokens metadata
const OBJKT_API = 'https://data.objkt.com/v3/graphql/';

export const apolloObjktClient = buildApolloClient(OBJKT_API);
