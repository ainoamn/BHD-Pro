import { calculateTaxLine } from '../src/common/money';

describe('decimal money calculations', () => {
  it('avoids binary floating point drift and rounds half-up to currency scale', () => {
    const line = calculateTaxLine({
      quantity: '3',
      unitPrice: '0.1',
      discount: '0',
      taxRate: '5',
    });
    expect(line.lineSubtotal.toFixed(3)).toBe('0.300');
    expect(line.taxAmount.toFixed(3)).toBe('0.015');
    expect(line.total.toFixed(3)).toBe('0.315');
  });
});
