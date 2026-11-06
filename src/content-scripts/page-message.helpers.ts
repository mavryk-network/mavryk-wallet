type PageMessageLike = Pick<MessageEvent, 'origin' | 'source'>;

export const isProcessablePageMessage = (evt: PageMessageLike, currentWindow: Window) =>
  evt.source === currentWindow && Boolean(evt.origin) && evt.origin !== 'null';
