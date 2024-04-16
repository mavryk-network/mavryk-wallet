import { Modifier } from '@popperjs/core';

export const translateYModifiers: Array<Modifier<string, any>> = [
  {
    name: 'translateFromTop',
    enabled: true,
    phase: 'beforeWrite',
    requires: ['computeStyles'],
    fn: ({ state }) => {
      state.styles.popper.top = `14px`;
    }
  }
];
