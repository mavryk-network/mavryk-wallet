import { buildTEZOpParams, createOpParams, getBackendHistoryFilters, mergeOpParams } from './filterParams';
import { HistoryItemOpTypeEnum } from './types';

it('merges conflicting null-entrypoint filters without mutating either input', () => {
  const filters = createOpParams('test-account');
  const incoming = filters[HistoryItemOpTypeEnum.TransferFrom];
  const outgoing = filters[HistoryItemOpTypeEnum.TransferTo];
  const interaction = filters[HistoryItemOpTypeEnum.Interaction];
  const snapshot = JSON.stringify(filters);

  expect(mergeOpParams(outgoing, interaction)['entrypoint.null']).toBeUndefined();
  expect(mergeOpParams(incoming, outgoing)).toMatchObject({ sender: 'test-account', target: 'test-account' });
  expect(getBackendHistoryFilters('test-account', interaction)).toBe('interaction');
  expect(buildTEZOpParams('test-account', mergeOpParams(incoming, outgoing))).toMatchObject({
    'anyof.sender.target': 'test-account'
  });
  expect(JSON.stringify(filters)).toBe(snapshot);
});
