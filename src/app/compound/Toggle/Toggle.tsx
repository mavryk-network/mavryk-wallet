import React, { createContext, useCallback, useMemo } from 'react';

import { Switcher } from 'app/atoms/Switcher';

import { Child, ToggleContextType } from './Toggle.types';

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
export const ToggleContext = createContext<ToggleContextType>(undefined!);
ToggleContext.displayName = 'ToggleContext';

export function Toggle({ children, active = false }: Child & { active?: boolean }) {
  const [on, setOn] = React.useState(active);
  const toggle = useCallback(() => setOn(!on), [on]);

  const memoizedState = useMemo(() => ({ on, toggle }), [on, toggle]);

  return <ToggleContext.Provider value={memoizedState}>{children}</ToggleContext.Provider>;
}

export function useToggle() {
  const context = React.useContext(ToggleContext);
  if (context === undefined) {
    throw new Error('useToggle must be used within a <Toggle />');
  }
  return context;
}

export function ToggleOn({ children }: Child) {
  const { on } = useToggle();
  return on ? children : null;
}

export function ToggleOff({ children }: Child) {
  const { on } = useToggle();
  return on ? null : children;
}

export function ToggleButton({ ...props }) {
  const { on, toggle } = useToggle();
  return <Switcher on={on} onClick={toggle} {...props} />;
}
