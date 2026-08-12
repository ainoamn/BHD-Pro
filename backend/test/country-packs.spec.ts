import { currencyScale, resolveCountryPack } from '../src/common/country-packs';

describe('country packs', () => {
  it('resolves tax, currency and timezone defaults per market', () => {
    expect(resolveCountryPack('OM')).toMatchObject({
      currency: 'OMR', currencyScale: 3, timezone: 'Asia/Muscat', defaultVatRate: 5,
    });
    expect(resolveCountryPack('SA')).toMatchObject({
      currency: 'SAR', currencyScale: 2, defaultVatRate: 15, eInvoiceAdapter: 'ZATCA',
    });
    expect(currencyScale('KWD')).toBe(3);
    expect(currencyScale('AED')).toBe(2);
  });
});
