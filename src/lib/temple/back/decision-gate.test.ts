import { createDecisionGate } from './decision-gate';

describe('createDecisionGate', () => {
  it('declines immediately when no decision is in progress', () => {
    const declineAndClose = jest.fn();
    const gate = createDecisionGate(declineAndClose);

    gate.declineOrDefer();

    expect(declineAndClose).toHaveBeenCalledTimes(1);
  });

  it('rejects a second decision while one is being processed', () => {
    const gate = createDecisionGate(jest.fn());

    gate.begin();

    expect(() => gate.begin()).toThrow('Confirmation is already being processed');
  });

  it('defers a decline during a decision and applies it on release', () => {
    const declineAndClose = jest.fn();
    const gate = createDecisionGate(declineAndClose);

    gate.begin();
    gate.declineOrDefer();
    expect(declineAndClose).not.toHaveBeenCalled();

    gate.release();
    expect(declineAndClose).toHaveBeenCalledTimes(1);
  });

  it('does not decline on release when nothing was deferred', () => {
    const declineAndClose = jest.fn();
    const gate = createDecisionGate(declineAndClose);

    gate.begin();
    gate.release();

    expect(declineAndClose).not.toHaveBeenCalled();
    expect(() => gate.begin()).not.toThrow();
  });
});
