import React from 'react';

import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { FileImportWrapper, FileTransferProvider, ImportResult } from './index';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

type ContactFixture = {
  address: string;
  name: string;
};

const CONTACTS_FIXTURE: ContactFixture[] = [{ address: 'mv1J7ZSCmLYkXnZb7m5qVLS84C8He5bHjVf5', name: 'Alice' }];

function ForwardingDropzone(props: React.HTMLAttributes<HTMLElement>) {
  return <section {...props}>Select a file or drag and drop here</section>;
}

function flushPromises() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

async function waitForImported(onImported: jest.Mock) {
  for (let i = 0; i < 10; i++) {
    if (onImported.mock.calls.length > 0) return;

    await act(async () => {
      await flushPromises();
    });
  }
}

function getDropzone(container: HTMLElement) {
  const dropzone = container.querySelector<HTMLElement>('section[role="button"]');
  expect(dropzone).not.toBeNull();

  return dropzone as HTMLElement;
}

function createDropEvent(file: File) {
  const event = new Event('drop', { bubbles: true, cancelable: true });

  Object.defineProperty(event, 'dataTransfer', {
    value: { files: [file] }
  });

  return event;
}

function renderImportWrapper(props: {
  onImported: (result: ImportResult<ContactFixture>) => void;
  onImportStart?: (file: File) => void;
}) {
  const container = document.createElement('div');
  const root = createRoot(container);
  document.body.appendChild(container);

  act(() => {
    root.render(
      <FileTransferProvider>
        <FileImportWrapper<ContactFixture> onImported={props.onImported} onImportStart={props.onImportStart}>
          <ForwardingDropzone />
        </FileImportWrapper>
      </FileTransferProvider>
    );
  });

  return { container, root };
}

describe('FileImportWrapper', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('opens the file picker and processes the selected file', async () => {
    const onImported = jest.fn();
    const file = new File([JSON.stringify(CONTACTS_FIXTURE)], 'contacts.json', { type: 'application/json' });
    const { container, root } = renderImportWrapper({ onImported });
    const inputClickSpy = jest
      .spyOn(HTMLInputElement.prototype, 'click')
      .mockImplementation(function (this: HTMLInputElement) {
        Object.defineProperty(this, 'files', {
          configurable: true,
          value: [file]
        });

        this.dispatchEvent(new Event('change', { bubbles: true }));
      });

    await act(async () => {
      getDropzone(container).dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushPromises();
    });
    await waitForImported(onImported);

    expect(inputClickSpy).toHaveBeenCalledTimes(1);
    expect(onImported).toHaveBeenCalledWith(expect.objectContaining({ data: CONTACTS_FIXTURE }));

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('processes a dropped file', async () => {
    const onImported = jest.fn();
    const onImportStart = jest.fn();
    const file = new File([JSON.stringify(CONTACTS_FIXTURE)], 'contacts.json', { type: 'application/json' });
    const { container, root } = renderImportWrapper({ onImported, onImportStart });

    await act(async () => {
      getDropzone(container).dispatchEvent(createDropEvent(file));
      await flushPromises();
    });
    await waitForImported(onImported);

    expect(onImportStart).toHaveBeenCalledWith(file);
    expect(onImported).toHaveBeenCalledWith(expect.objectContaining({ data: CONTACTS_FIXTURE }));

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
