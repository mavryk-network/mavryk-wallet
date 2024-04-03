const TOKEN_TRANSFER_FA2 = {
  destination: 'KT1RX7AdYr9hFZPQTZw5Fu8KkMwVtobHpTp6',
  parameter: {
    entrypoint: 'transfer',
    value: [
      {
        prim: 'Pair',
        args: [
          {
            string: 'mv3AievfzzVPWoQMkXcZTL1JXBiQwF37JyUr'
          },
          [
            {
              prim: 'Pair',
              args: [
                {
                  string: 'mv19wgwgca27Z3yv6siDZ9iDMRy8kGD4Fka5'
                },
                {
                  prim: 'Pair',
                  args: [
                    {
                      int: '0'
                    },
                    {
                      int: '500'
                    }
                  ]
                }
              ]
            }
          ]
        ]
      }
    ]
  }
};

export default TOKEN_TRANSFER_FA2;
