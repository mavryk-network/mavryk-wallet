export const payloadMock = {
  type: 'operations',
  sourcePkh: 'tz1R9sdHVh9kwpuJByDGeAaLxVUqFaV4h1yG',
  networkRpc: 'https://rpc.ghostnet.teztnets.xyz',
  opParams: [
    {
      kind: 'delegation',
      source: 'tz1R9sdHVh9kwpuJByDGeAaLxVUqFaV4h1yG',
      fee: 471,
      delegate: 'tz1RuHDSj9P7mNNhfKxsyLGRDahTX5QD1DdP',
      gasLimit: 200,
      storageLimit: 0
    }
  ],
  bytesToSign:
    '3cb86bec37ef82074dfcad6f46c61cf5bf0b963240015af77eaf036bb91535df6b003c7d8a2e6a631be1fc109f798af2bb119ce29ee9f602bdd59e0b9811000020e8de3006ed50a996499a4848496f059364274f6d87f727a07cf5af05eff1316e003c7d8a2e6a631be1fc109f798af2bb119ce29ee9d703bed59e0bc80100ff0044b31e005479eba6449274d8c6dc423946f97607',
  rawToSign: {
    branch: 'BLB2Me21hCEN3LGhZFUKGjmjcLdKuWZ9aowXP94w1tZ6yacSRRh',
    contents: [
      {
        kind: 'reveal',
        source: 'tz1R9sdHVh9kwpuJByDGeAaLxVUqFaV4h1yG',
        fee: '374',
        counter: '23571133',
        gas_limit: '2200',
        storage_limit: '0',
        public_key: 'edpkttiZyzApM8YXggpmR9iunUXvKjQEJCvsk4G7WwK239FaMffge5'
      },
      {
        kind: 'delegation',
        source: 'tz1R9sdHVh9kwpuJByDGeAaLxVUqFaV4h1yG',
        fee: '471',
        counter: '23571134',
        gas_limit: '200',
        storage_limit: '0',
        delegate: 'tz1RuHDSj9P7mNNhfKxsyLGRDahTX5QD1DdP'
      }
    ]
  },
  estimates: [
    {
      _milligasLimit: 170835,
      _storageLimit: 0,
      opSize: 64,
      minimalFeePerStorageByteMutez: 250,
      baseFeeMutez: 100,
      burnFeeMutez: 0,
      consumedMilligas: 170835,
      gasLimit: 271,
      minimalFeeMutez: 192,
      storageLimit: 0,
      suggestedFeeMutez: 292,
      totalCost: 192,
      usingBaseFeeMutez: 192
    },
    {
      _milligasLimit: 100000,
      _storageLimit: 0,
      opSize: 152,
      minimalFeePerStorageByteMutez: 250,
      baseFeeMutez: 100,
      burnFeeMutez: 0,
      consumedMilligas: 100000,
      gasLimit: 200,
      minimalFeeMutez: 272,
      storageLimit: 0,
      suggestedFeeMutez: 372,
      totalCost: 272,
      usingBaseFeeMutez: 272
    }
  ]
};
