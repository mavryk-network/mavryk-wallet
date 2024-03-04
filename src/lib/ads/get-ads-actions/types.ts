import type { AdStylesOverrides } from 'lib/apis/temple';

import { AdsResolution } from '../ads-resolutions';

export enum AdActionType {
  ReplaceAllChildren = 'replace-all-children',
  ReplaceElement = 'replace-element',
  SimpleInsertAd = 'simple-insert-ad',
  RemoveElement = 'remove-element',
  HideElement = 'hide-element'
}

interface AdActionBase {
  type: AdActionType;
}

interface InsertAdActionProps {
  adResolution: AdsResolution;
  shouldUseDivWrapper: boolean;
  divWrapperStyle?: Record<string, string>;
  elementStyle?: Record<string, string>;
  stylesOverrides?: AdStylesOverrides[];
}

export interface ReplaceAllChildrenWithAdAction extends AdActionBase, InsertAdActionProps {
  type: AdActionType.ReplaceAllChildren;
  parent: HTMLElement;
}

export interface ReplaceElementWithAdAction extends AdActionBase, InsertAdActionProps {
  type: AdActionType.ReplaceElement;
  element: HTMLElement;
}

export interface SimpleInsertAdAction extends AdActionBase, InsertAdActionProps {
  type: AdActionType.SimpleInsertAd;
  parent: HTMLElement;
  insertionIndex: number;
}

export interface RemoveElementAction extends AdActionBase {
  type: AdActionType.RemoveElement;
  element: HTMLElement;
}

export interface HideElementAction extends AdActionBase {
  type: AdActionType.HideElement;
  element: HTMLElement;
}

type InsertAdAction = ReplaceAllChildrenWithAdAction | ReplaceElementWithAdAction | SimpleInsertAdAction;

export type InsertAdActionWithoutAdResolution =
  | Omit<ReplaceAllChildrenWithAdAction, 'adResolution'>
  | Omit<ReplaceElementWithAdAction, 'adResolution'>
  | Omit<SimpleInsertAdAction, 'adResolution'>;

export type AdAction = InsertAdAction | RemoveElementAction | HideElementAction;
