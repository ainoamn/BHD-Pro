/** GCC dial codes keyed by ISO country (company.country). Default Oman. */
const DIAL_BY_COUNTRY: Record<string, string> = {
  OM: '968',
  SA: '966',
  AE: '971',
  KW: '965',
  BH: '973',
  QA: '974',
};

const DEFAULT_DIAL = '968';

export function dialCodeForCountry(country?: string | null): string {
  const key = String(country || 'OM')
    .trim()
    .toUpperCase();
  return DIAL_BY_COUNTRY[key] || DEFAULT_DIAL;
}

/**
 * Normalize a phone string to E.164 digits only (no +).
 * Uses defaultDial when the number has no country code.
 */
export function toE164Digits(
  phone: string | null | undefined,
  defaultDial: string = DEFAULT_DIAL,
): string {
  if (!phone?.trim()) return '';

  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  const dial = String(defaultDial || DEFAULT_DIAL).replace(/\D/g, '') || DEFAULT_DIAL;

  // Already includes dial code
  if (digits.startsWith(dial) && digits.length > dial.length + 5) {
    return digits;
  }

  // Local number — strip leading 0 trunk prefix
  const local = digits.replace(/^0+/, '');
  if (!local) return '';
  if (local.startsWith(dial) && local.length > dial.length + 5) {
    return local;
  }
  return `${dial}${local}`;
}

/** Rough mobile E.164 check: 8–15 digits total. */
export function isValidMobileE164(digits: string | null | undefined): boolean {
  const d = String(digits || '').replace(/\D/g, '');
  return d.length >= 8 && d.length <= 15;
}
