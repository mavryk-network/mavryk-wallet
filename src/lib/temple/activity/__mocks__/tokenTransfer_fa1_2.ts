const TOKEN_TRANFER_FA1_2 = {
  destination: 'KT1NbznEfpxZZyPUNcSWRm9Y8qZkdEgWEFaV',
  parameters: {
    entrypoint: 'transfer',
    value: {
      prim: 'Pair',
      args: [
        {
          string: 'mv3AievfzzVPWoQMkXcZTL1JXBiQwF37JyUr'
        },
        {
          prim: 'Pair',
          args: [
            {
              string: 'mv19wgwgca27Z3yv6siDZ9iDMRy8kGD4Fka5'
            },
            {
              int: '10000000000000000000'
            }
          ]
        }
      ]
    }
  }
};

export default TOKEN_TRANFER_FA1_2;
