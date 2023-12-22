import { ReactNode } from 'react';

export type Child = {
  children: ReactNode;
};

export type ToggleContextType = {
  on: boolean;
  toggle: () => void;
};
