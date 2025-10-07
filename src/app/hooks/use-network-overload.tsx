/* eslint-disable no-type-assertion/no-type-assertion */
import { useState, useRef, useEffect } from 'react';

import { RpcClientInterface } from '@mavrykdynamics/taquito-rpc';

import { useTezos } from 'lib/temple/front';

const DEFAULT_LATENCY = 2500;
const LATENCY_SAMPLES_COUNT = 10;

interface UseNetworkOverloadOptions {
  /** How many recent RPC calls to average */
  sampleSize?: number;
  /** Threshold (in ms) above which the network is considered overloaded */
  overloadThreshold?: number;
}

export function useNetworkOverload(options: UseNetworkOverloadOptions = {}) {
  const { sampleSize = LATENCY_SAMPLES_COUNT, overloadThreshold = DEFAULT_LATENCY } = options;
  const [isOverloaded, setIsOverloaded] = useState(false);
  const latencies = useRef<number[]>([]);
  const tezosToolkit = useTezos();

  useEffect(() => {
    const rpc: RpcClientInterface & { __patched?: boolean } = tezosToolkit.rpc;
    if (rpc.__patched) return; // don’t patch twice

    // Helper to wrap an RPC method
    const wrap = <T extends (...args: any[]) => Promise<any>>(method: T, _: string): T => {
      return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
        const start = performance.now();
        try {
          return await method(...args);
        } finally {
          const latency = performance.now() - start;
          latencies.current.push(latency);
          if (latencies.current.length > sampleSize) latencies.current.shift();

          const avg = latencies.current.reduce((a, b) => a + b, 0) / latencies.current.length;

          setIsOverloaded(avg > overloadThreshold);
        }
      }) as T;
    };

    // Patch all functions in the rpc client
    for (const key of Object.keys(rpc)) {
      const value = (rpc as any)[key];
      if (typeof value === 'function') {
        (rpc as any)[key] = wrap(value.bind(rpc), key);
      }
    }

    rpc.__patched = true;
  }, [tezosToolkit, sampleSize, overloadThreshold]);

  return { isOverloaded };
}
