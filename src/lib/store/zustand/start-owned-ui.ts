// Side-effect import placed right after `lib/load-perf/start` in page entries (before the app bundle evaluates).
import { startOwnedUIInitialization } from './ui-client';

startOwnedUIInitialization();
