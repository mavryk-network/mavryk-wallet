export const buildCurrentBackendAuthChallengeMessage = ({
  expiresAt,
  nonce,
  timestamp,
  walletAddress
}: {
  expiresAt: string;
  nonce: string;
  timestamp: string;
  walletAddress: string;
}) =>
  [
    'Mavryk Wallet Authentication',
    '',
    'Please sign this message to authenticate.',
    '',
    `Wallet Address: ${walletAddress}`,
    `Nonce: ${nonce}`,
    `Timestamp: ${timestamp}`,
    `Expires: ${expiresAt}`,
    '',
    'This request will not trigger a blockchain transaction or cost any gas fees.'
  ].join('\n');
