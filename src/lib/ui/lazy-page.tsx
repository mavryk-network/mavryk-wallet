import React, { ComponentType, FC, useEffect, useState } from 'react';

export interface LazyPage<P extends object> extends FC<P> {
  /** Starts loading the page module; resolves (never rejects) once the load has settled. */
  preload: () => Promise<void>;
}

/**
 * Route component whose module is loaded on first render or on `preload()`.
 *
 * A loaded page renders synchronously. A page that is not loaded yet renders `Fallback` and re-renders through
 * a normal state update once the module arrives, instead of suspending. With `React.lazy`, that re-render would
 * be a Suspense retry, and React 18 throttles a retry commit by up to ~500 ms whenever the page's own nested
 * boundaries suspend in it. A failed load is thrown to the nearest error boundary; the next mount retries it.
 *
 * @param load - Dynamic `import()` of the page module, mapped to its component.
 * @param Fallback - Rendered in place of the page while its module loads.
 * @returns Component with the same props as the page, plus `preload`.
 */
export function lazyPage<P extends object>(
  load: () => Promise<ComponentType<P>>,
  Fallback: ComponentType
): LazyPage<P> {
  let Page: ComponentType<P> | null = null;
  let pending: Promise<void> | null = null;
  let failure: { error: unknown } | null = null;

  const preload = () => {
    if (!pending) {
      failure = null;
      pending = load().then(
        loaded => {
          Page = loaded;
        },
        error => {
          pending = null;
          failure = { error };
        }
      );
    }

    return pending;
  };

  const LazyPageComponent: FC<P> = props => {
    const [loadFailure, setLoadFailure] = useState<{ error: unknown } | null>(null);
    const [, setIsLoaded] = useState(Page !== null);

    // Loads the page module when it was not preloaded and re-renders once it settles; cleanup ignores
    // a load that settles after unmount (the module stays cached for the next mount).
    useEffect(() => {
      if (Page) return undefined;

      let isActive = true;
      preload().then(() => {
        if (!isActive) return;
        if (failure) setLoadFailure(failure);
        else setIsLoaded(true);
      });

      return () => {
        isActive = false;
      };
    }, []);

    if (loadFailure) throw loadFailure.error;

    return Page ? <Page {...props} /> : <Fallback />;
  };

  return Object.assign(LazyPageComponent, { preload });
}

/**
 * Loads the given pages one by one while the main thread is idle.
 *
 * @param pages - Pages in priority order.
 * @returns Cancels the pages that have not started loading yet.
 */
export function preloadLazyPagesOnIdle(pages: ReadonlyArray<Pick<LazyPage<never>, 'preload'>>) {
  let isCancelled = false;
  let cancelScheduled = () => {};

  const scheduleIdle = (callback: () => void) => {
    if (typeof requestIdleCallback === 'function') {
      const handle = requestIdleCallback(callback, { timeout: 2_000 });
      cancelScheduled = () => cancelIdleCallback(handle);
    } else {
      const handle = setTimeout(callback, 1);
      cancelScheduled = () => clearTimeout(handle);
    }
  };

  const loadNext = (index: number) => {
    if (isCancelled || index >= pages.length) return;

    scheduleIdle(() => {
      if (isCancelled) return;
      // `preload` never rejects: a failure is kept for the next mount of that page, which retries it.
      pages[index].preload().then(() => loadNext(index + 1));
    });
  };

  loadNext(0);

  return () => {
    isCancelled = true;
    cancelScheduled();
  };
}
