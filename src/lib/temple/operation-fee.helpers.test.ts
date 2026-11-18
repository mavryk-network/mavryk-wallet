import { mumavToTz } from './helpers';
import { sumOperationFeesMumav } from './operation-fee.helpers';

describe('sumOperationFeesMumav', () => {
  it('includes the reveal fee of the group', () => {
    const total = sumOperationFeesMumav([{ fee: '331' }, { fee: '287' }]);

    expect(total.toFixed()).toBe('618');
    expect(mumavToTz(total).toFixed()).toBe('0.000618');
  });

  it('treats missing or invalid fees as zero', () => {
    expect(sumOperationFeesMumav([{}, { fee: null }, { fee: 'abc' }, { fee: 100 }]).toFixed()).toBe('100');
    expect(sumOperationFeesMumav([]).toFixed()).toBe('0');
  });
});
