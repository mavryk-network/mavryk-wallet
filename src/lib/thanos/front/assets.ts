import * as React from "react";
import { browser } from "webextension-polyfill-ts";
import {
  XTZ_ASSET,
  MAINNET_TOKENS,
  useNetwork,
  useTokens,
  useStorage,
  useAllAssetsRef,
  useAccount,
} from "lib/thanos/front";

export function useAssets() {
  const network = useNetwork();
  const { tokens } = useTokens();
  const allAssetsRef = useAllAssetsRef();

  const allAssets = React.useMemo(
    () => [
      XTZ_ASSET,
      ...(network.type === "main" ? MAINNET_TOKENS : []),
      ...tokens,
    ],
    [network.type, tokens]
  );

  React.useEffect(() => {
    allAssetsRef.current = allAssets;
  }, [allAssetsRef, allAssets]);

  const defaultAsset = React.useMemo(() => allAssets[0], [allAssets]);

  return { allAssets, defaultAsset };
}

export function useCurrentAsset() {
  const { allAssets, defaultAsset } = useAssets();

  const network = useNetwork();
  const account = useAccount();
  const [assetSymbol, setAssetSymbol] = useStorage(
    `assetsymbol_${network.id}_${account.publicKeyHash}`,
    defaultAsset.symbol
  );

  const currentAsset = React.useMemo(
    () => allAssets.find((a) => a.symbol === assetSymbol) ?? defaultAsset,
    [allAssets, assetSymbol, defaultAsset]
  );
  return {
    assetSymbol,
    setAssetSymbol,
    currentAsset,
  };
}

export function useSetAssetSymbol() {
  const network = useNetwork();
  const account = useAccount();

  const key = React.useMemo(
    () => `assetsymbol_${network.id}_${account.publicKeyHash}`,
    [network.id, account.publicKeyHash]
  );

  return React.useCallback(
    (symbol: string) => {
      browser.storage.local.set({ [key]: symbol });
    },
    [key]
  );
}
