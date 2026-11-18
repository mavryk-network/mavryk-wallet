import { useEffect, useLayoutEffect, useRef } from 'react';

/**
 * Load-time instrumentation (docs/load-performance.md). Compiled to no-ops unless the build sets
 * `LOAD_PERF_MARKS=true`; never records PII, only mark names and timings relative to navigation start.
 */
export const IS_LOAD_PERF_ENABLED = process.env.LOAD_PERF_MARKS === 'true';

const MARK_PREFIX = 'we:';
const LONG_TASK_WINDOW_MS = 15_000;

export type LoadPerfMarkName =
  | 'entry-start'
  | 'entry-evaluated'
  | 'owner-snapshot'
  | 'redux-read'
  | 'redux-rehydrated'
  | 'app-committed'
  | 'get-state'
  | 'i18n'
  | 'fonts'
  | 'unlock-painted'
  | 'welcome-painted'
  | 'home-painted'
  | 'token-row-painted'
  | 'balances-fresh';

interface LoadPerfReport {
  timeOrigin: number;
  marks: Partial<Record<LoadPerfMarkName, number>>;
  longTasks: { start: number; duration: number }[];
}

declare global {
  interface Window {
    __WE_LOAD__?: LoadPerfReport;
  }
}

function getReport() {
  if (!window.__WE_LOAD__) window.__WE_LOAD__ = { timeOrigin: performance.timeOrigin, marks: {}, longTasks: [] };
  return window.__WE_LOAD__;
}

/** Record the first occurrence of a startup milestone; later calls with the same name are ignored. */
export function markLoad(name: LoadPerfMarkName) {
  if (!IS_LOAD_PERF_ENABLED) return;
  const { marks } = getReport();
  if (marks[name] !== undefined) return;
  marks[name] = performance.now();
  performance.mark(MARK_PREFIX + name);
}

/** Start collecting long tasks (>50 ms) for the first seconds of the page; called once from the entry module. */
export function startLoadPerf() {
  if (!IS_LOAD_PERF_ENABLED) return;
  markLoad('entry-start');
  if (typeof PerformanceObserver === 'undefined' || !PerformanceObserver.supportedEntryTypes?.includes('longtask'))
    return;
  const { longTasks } = getReport();
  const observer = new PerformanceObserver(list => {
    for (const entry of list.getEntries()) longTasks.push({ start: entry.startTime, duration: entry.duration });
  });
  observer.observe({ type: 'longtask', buffered: true });
  setTimeout(() => observer.disconnect(), LONG_TASK_WINDOW_MS);
}

/** Mark the first committed render of a component (before paint) once `isEnabled` holds. */
export function useLoadPerfMark(name: LoadPerfMarkName, isEnabled = true) {
  // Records a timing milestone on commit; no external resource is held, so no cleanup is needed.
  useLayoutEffect(() => {
    if (isEnabled) markLoad(name);
  }, [name, isEnabled]);
}

/** Mark the first successful settle after a loading period (for example, the first fresh balance sync). */
export function useLoadPerfSettledMark(name: LoadPerfMarkName, isLoading: boolean, hasError: boolean) {
  const hasLoadedRef = useRef(false);
  // Tracks the loading→settled transition to record one timing milestone; nothing to clean up.
  useEffect(() => {
    if (!IS_LOAD_PERF_ENABLED) return;
    if (isLoading) hasLoadedRef.current = true;
    else if (hasLoadedRef.current && !hasError) markLoad(name);
  }, [name, isLoading, hasError]);
}
