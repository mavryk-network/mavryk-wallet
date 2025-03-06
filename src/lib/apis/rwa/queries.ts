export const RWA_ASSETS_CONTRACTS_QUERY = `
    query MarketContracts {
    dodo_mav {
      base_token {
      address
      token_id
    }
  }
}
`;

export const RWA_TOKEN_METADATA_QUERY = `
    query MarketTokens($addresses: [String!]!) {
      token(where: { address: { _in: $addresses } }) {
        address
        token_id
        token_standard
        token_metadata
        metadata
      }
    }
  `;
