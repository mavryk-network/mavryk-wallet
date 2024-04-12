import styles from '../pageLayout.module.css';

const bgRoutes: StringRecord<string> = {
  '/unlock': styles.unlockpageBg,
  '/success': styles.successpageBg
};

export function getFullScreenBgBasedOnRoute(route: string) {
  return bgRoutes[route] ?? styles.fullpageBg;
}
