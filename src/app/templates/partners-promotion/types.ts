import { MouseEventHandler } from 'react';

export enum PartnersPromotionVariant {
  Text = 'Text',
  Image = 'Image'
}

export interface SingleProviderPromotionProps {
  variant: PartnersPromotionVariant;
  isVisible: boolean;
  pageName: string;
  onClose: MouseEventHandler<HTMLButtonElement>;
  onReady: EmptyFn;
  onError: EmptyFn;
  onAdRectSeen: EmptyFn;
}
