export const confirmOperationsMock = {
  type: 'confirm_operations',
  origin: 'https://front-dev.mavryk-finance-dapp-frontend.pages.dev',
  networkRpc: 'https://ghostnet.smartpy.io/',
  appMeta: {
    name: 'Maven',
    senderId: '46NbQhSejLd4y'
  },
  sourcePkh: 'tz1b3BQ8wFyQ9U5Gx8WWXimphY8ER8qorm7m',
  sourcePublicKey: 'edpkutgoG8KknR6EFViM33SfALiptofnbBRTthPU28VXzs4mCwjxNU',
  opParams: [
    {
      kind: 'transaction',
      to: 'KT1CKMJ1H4MGAmmyoXZ41gu7v6Xse1XuyJ9V',
      amount: 0,
      mutez: true,
      parameter: {
        entrypoint: 'unstakeMvn',
        value: {
          int: '12000000000'
        }
      },
      fee: 11514,
      gasLimit: 112030,
      storageLimit: 0
    }
  ],
  bytesToSign:
    '8f5c647eb10344683273efbc3483e373dd068ed8a501ef3c76dbbcfe4d398f6a6c00a8eab8e84a4ddaae8c5f4fe2246d793fd2182c6bfa598fafe9079eeb0600000128f600b0ae90a9b0220f5badf8f9c65c5790b28a00ffff0a756e7374616b654d766e000000060080e08bb459',
  rawToSign: {
    branch: 'BLoRJDPdsyjtQxehSo5rW8qn9Q53VZSPETNLEHPhQrMzWdacJKr',
    contents: [
      {
        kind: 'transaction',
        source: 'tz1b3BQ8wFyQ9U5Gx8WWXimphY8ER8qorm7m',
        fee: '11514',
        counter: '16406415',
        gas_limit: '112030',
        storage_limit: '0',
        amount: '0',
        destination: 'KT1CKMJ1H4MGAmmyoXZ41gu7v6Xse1XuyJ9V',
        parameters: {
          entrypoint: 'unstakeMvn',
          value: {
            int: '12000000000'
          }
        }
      }
    ]
  },
  estimates: [
    {
      _milligasLimit: 111929411,
      _storageLimit: 0,
      opSize: 111,
      minimalFeePerStorageByteMutez: 250,
      baseFeeMutez: 100,
      burnFeeMutez: 0,
      consumedMilligas: 111929411,
      gasLimit: 112030,
      minimalFeeMutez: 11414,
      storageLimit: 0,
      suggestedFeeMutez: 11514,
      totalCost: 11414,
      usingBaseFeeMutez: 11414
    }
  ]
};

export const connectWalletMock = {
  type: 'connect',
  origin: 'https://front-dev.mavryk-finance-dapp-frontend.pages.dev',
  networkRpc: 'https://ghostnet.smartpy.io/',
  appMeta: {
    senderId: '46NbQhSejLd4y',
    name: 'Maven'
  }
};
