import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Explicit symbols — Intl can show ر.س for Arabic locales on some systems */
const CURRENCY_SYMBOLS: Record<string, { ar: string; en: string; decimals: number }> = {
  OMR: { ar: 'ر.ع', en: 'OMR', decimals: 3 },
  SAR: { ar: 'ر.س', en: 'SAR', decimals: 2 },
  AED: { ar: 'د.إ', en: 'AED', decimals: 2 },
  KWD: { ar: 'د.ك', en: 'KWD', decimals: 3 },
  BHD: { ar: 'د.ب', en: 'BHD', decimals: 3 },
  QAR: { ar: 'ر.ق', en: 'QAR', decimals: 2 },
  USD: { ar: '$', en: 'USD', decimals: 2 },
  EUR: { ar: '€', en: 'EUR', decimals: 2 },
};

export function getCurrencySymbol(currency: string = 'OMR', locale?: string): string {
  const code = (currency || 'OMR').toUpperCase();
  const meta = CURRENCY_SYMBOLS[code];
  const isEn =
    locale?.startsWith('en') ||
    (typeof document !== 'undefined' && document.documentElement.lang === 'en');
  if (!meta) return code;
  return isEn ? meta.en : meta.ar;
}

export function formatMoney(amount: number, currency: string = 'OMR', locale?: string): string {
  const code = (currency || 'OMR').toUpperCase();
  const meta = CURRENCY_SYMBOLS[code] || { ar: code, en: code, decimals: 3 };
  const loc =
    locale ||
    (typeof document !== 'undefined' && document.documentElement.lang === 'en' ? 'en-OM' : 'ar-OM');
  const formatted = new Intl.NumberFormat(loc, {
    minimumFractionDigits: meta.decimals,
    maximumFractionDigits: meta.decimals,
  }).format(Number(amount) || 0);
  const symbol = getCurrencySymbol(code, locale);
  return `${formatted} ${symbol}`;
}

export function formatDate(date: string | Date, locale?: string): string {
  const loc = locale || (typeof document !== 'undefined' && document.documentElement.lang === 'en' ? 'en-OM' : 'ar-OM');
  return new Date(date).toLocaleDateString(loc);
}

export function formatNumber(num: number, locale?: string): string {
  const loc = locale || (typeof document !== 'undefined' && document.documentElement.lang === 'en' ? 'en-OM' : 'ar-OM');
  return new Intl.NumberFormat(loc).format(num);
}

export function generateInvoiceNumber(companyId: string, count: number): string {
  const year = new Date().getFullYear();
  const seq = String(count + 1).padStart(3, '0');
  return `INV-${year}-${seq}`;
}

export function generateJournalNumber(companyId: string, count: number): string {
  const year = new Date().getFullYear();
  const seq = String(count + 1).padStart(3, '0');
  return `JV-${year}-${seq}`;
}

export function calculateTax(amount: number, rate: number = 5): number {
  return Number((amount * (rate / 100)).toFixed(3));
}

export function calculateTotal(subtotal: number, tax: number, discount: number = 0): number {
  return Number((subtotal + tax - discount).toFixed(3));
}

/** Convert Arabic digits and comma/Arabic decimal to a parseable string */
export function normalizeDecimalString(input: string): string {
  let s = input
    .replace(/[٠-٩]/g, (d) => "0123456789"["٠١٢٣٤٥٦٧٨٩".indexOf(d)])
    .replace(/[۰-۹]/g, (d) => "0123456789"["۰۱۲۳۴۵۶۷۸۹".indexOf(d)])
    .replace(/\s/g, "")
    .replace(/٫/g, ".");

  if (s.includes(",") && !s.includes(".")) {
    s = s.replace(",", ".");
  } else {
    s = s.replace(/,/g, "");
  }
  return s;
}

export function parseDecimalValue(input: string): number | null {
  const normalized = normalizeDecimalString(input);
  if (normalized === "" || normalized === ".") return null;
  const n = parseFloat(normalized);
  return Number.isNaN(n) ? null : n;
}

/** Extract tax from a tax-inclusive amount */
export function extractTaxFromInclusive(inclusive: number, rate: number): { net: number; tax: number } {
  if (rate <= 0) return { net: inclusive, tax: 0 };
  const net = Number((inclusive / (1 + rate / 100)).toFixed(3));
  const tax = Number((inclusive - net).toFixed(3));
  return { net, tax };
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
