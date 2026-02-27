import React, { FC } from 'react';

import { useSuspenseQuery } from '@tanstack/react-query';
import FontFaceObserver from 'fontfaceobserver';

interface AwaitFontsProps extends PropsWithChildren {
  name: string;
  weights: number[];
  className: string;
}

const AwaitFonts: FC<AwaitFontsProps> = ({ name, weights, className, children }) => {
  useSuspenseQuery({
    queryKey: ['awaitFonts', name, weights, className],
    queryFn: () => awaitFonts([name, weights, className]),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false
  });

  return <>{children}</>;
};

export default AwaitFonts;

async function awaitFonts([name, weights, className]: [string, number[], string]) {
  try {
    const fonts = weights.map(weight => new FontFaceObserver(name, { weight }));
    await Promise.all(fonts.map(font => font.load()));
    document.body.classList.add(...className.split(' '));
  } catch (err: any) {
    console.error(err);
  }
  return null;
}
