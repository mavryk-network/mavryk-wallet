import { isProcessablePageMessage } from './page-message.helpers';

const createEvent = (source: MessageEvent['source'], origin: string): Pick<MessageEvent, 'origin' | 'source'> => ({
  source,
  origin
});

describe('isProcessablePageMessage', () => {
  it('accepts page messages from the current window with a concrete origin', () => {
    const currentWindow = window;

    expect(isProcessablePageMessage(createEvent(currentWindow, 'https://dapp.example'), currentWindow)).toBe(true);
  });

  it('does not require the event origin to equal the current window origin', () => {
    const currentWindow = window;

    expect(isProcessablePageMessage(createEvent(currentWindow, 'https://embedded-dapp.example'), currentWindow)).toBe(
      true
    );
  });

  it('rejects messages from other sources or opaque origins', () => {
    const currentWindow = window;
    const otherSource = { postMessage: jest.fn() } as unknown as Window;

    expect(isProcessablePageMessage(createEvent(otherSource, 'https://dapp.example'), currentWindow)).toBe(false);
    expect(isProcessablePageMessage(createEvent(currentWindow, ''), currentWindow)).toBe(false);
    expect(isProcessablePageMessage(createEvent(currentWindow, 'null'), currentWindow)).toBe(false);
  });
});
