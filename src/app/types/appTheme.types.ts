import { DARK_THEME, DARK_LIGHT_THEME, LIGHT_THEME } from 'app/consts/appTheme';

export type AppTheme = typeof DARK_THEME | typeof DARK_LIGHT_THEME | typeof LIGHT_THEME;

export type ComponentTheme = AppTheme;
