import { BadRequestException } from '@nestjs/common';

export type CountryPack = {
  country: string;
  currency: string;
  currencyScale: number;
  timezone: string;
  language: 'ar' | 'en';
  defaultVatRate: number;
  eInvoiceAdapter: 'OMAN' | 'ZATCA' | 'UAE' | null;
};

export const COUNTRY_PACKS: Record<string, CountryPack> = {
  OM: { country: 'OM', currency: 'OMR', currencyScale: 3, timezone: 'Asia/Muscat', language: 'ar', defaultVatRate: 5, eInvoiceAdapter: 'OMAN' },
  AE: { country: 'AE', currency: 'AED', currencyScale: 2, timezone: 'Asia/Dubai', language: 'ar', defaultVatRate: 5, eInvoiceAdapter: 'UAE' },
  SA: { country: 'SA', currency: 'SAR', currencyScale: 2, timezone: 'Asia/Riyadh', language: 'ar', defaultVatRate: 15, eInvoiceAdapter: 'ZATCA' },
  BH: { country: 'BH', currency: 'BHD', currencyScale: 3, timezone: 'Asia/Bahrain', language: 'ar', defaultVatRate: 10, eInvoiceAdapter: null },
  QA: { country: 'QA', currency: 'QAR', currencyScale: 2, timezone: 'Asia/Qatar', language: 'ar', defaultVatRate: 0, eInvoiceAdapter: null },
  KW: { country: 'KW', currency: 'KWD', currencyScale: 3, timezone: 'Asia/Kuwait', language: 'ar', defaultVatRate: 0, eInvoiceAdapter: null },
};

export function resolveCountryPack(code?: string | null): CountryPack {
  const normalized = String(code || 'OM').trim().toUpperCase();
  const pack = COUNTRY_PACKS[normalized];
  if (!pack) throw new BadRequestException('Country is not supported yet');
  return pack;
}

export function currencyScale(currency?: string | null): number {
  const code = String(currency || '').trim().toUpperCase();
  return Object.values(COUNTRY_PACKS).find((pack) => pack.currency === code)
    ?.currencyScale ?? 2;
}

