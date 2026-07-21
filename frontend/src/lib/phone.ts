/** GCC + common dial codes for WhatsApp (wa.me requires full international number) */
export const PHONE_DIAL_CODES = [
  { code: "968", country: "OM", labelAr: "🇴🇲 +968 عُمان", labelEn: "🇴🇲 +968 Oman" },
  { code: "966", country: "SA", labelAr: "🇸🇦 +966 السعودية", labelEn: "🇸🇦 +966 Saudi Arabia" },
  { code: "971", country: "AE", labelAr: "🇦🇪 +971 الإمارات", labelEn: "🇦🇪 +971 UAE" },
  { code: "965", country: "KW", labelAr: "🇰🇼 +965 الكويت", labelEn: "🇰🇼 +965 Kuwait" },
  { code: "973", country: "BH", labelAr: "🇧🇭 +973 البحرين", labelEn: "🇧🇭 +973 Bahrain" },
  { code: "974", country: "QA", labelAr: "🇶🇦 +974 قطر", labelEn: "🇶🇦 +974 Qatar" },
  { code: "962", country: "JO", labelAr: "🇯🇴 +962 الأردن", labelEn: "🇯🇴 +962 Jordan" },
  { code: "20", country: "EG", labelAr: "🇪🇬 +20 مصر", labelEn: "🇪🇬 +20 Egypt" },
  { code: "91", country: "IN", labelAr: "🇮🇳 +91 الهند", labelEn: "🇮🇳 +91 India" },
  { code: "92", country: "PK", labelAr: "🇵🇰 +92 باكستان", labelEn: "🇵🇰 +92 Pakistan" },
  { code: "1", country: "US", labelAr: "🇺🇸 +1 أمريكا", labelEn: "🇺🇸 +1 USA" },
  { code: "44", country: "GB", labelAr: "🇬🇧 +44 بريطانيا", labelEn: "🇬🇧 +44 UK" },
] as const;

export const DEFAULT_DIAL_CODE = "968";

export function splitPhone(
  phone?: string | null,
  defaultDialCode: string = DEFAULT_DIAL_CODE
): { dialCode: string; local: string } {
  if (!phone?.trim()) {
    return { dialCode: defaultDialCode, local: "" };
  }

  let digits = phone.replace(/\D/g, "");

  // Strip leading 00 international prefix
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  const sorted = [...PHONE_DIAL_CODES].sort((a, b) => b.code.length - a.code.length);
  for (const entry of sorted) {
    if (digits.startsWith(entry.code) && digits.length > entry.code.length) {
      return {
        dialCode: entry.code,
        local: digits.slice(entry.code.length),
      };
    }
  }

  // Local number without country code (e.g. 91234567)
  if (digits.length >= 7 && digits.length <= 10) {
    return { dialCode: defaultDialCode, local: digits.replace(/^0+/, "") };
  }

  return { dialCode: defaultDialCode, local: digits };
}

export function combinePhone(dialCode: string, local: string): string {
  const code = dialCode.replace(/\D/g, "") || DEFAULT_DIAL_CODE;
  const localDigits = local.replace(/\D/g, "").replace(/^0+/, "");
  if (!localDigits) return "";
  return `+${code}${localDigits}`;
}

/** Digits only for wa.me — must include country code */
export function formatPhoneForWhatsApp(
  phone?: string | null,
  defaultDialCode: string = DEFAULT_DIAL_CODE
): string | undefined {
  const combined = phone?.trim();
  if (!combined) return undefined;

  const { dialCode, local } = splitPhone(combined, defaultDialCode);
  const full = combinePhone(dialCode, local);
  const digits = full.replace(/\D/g, "");
  return digits.length >= 10 ? digits : undefined;
}

export function formatPhoneDisplay(
  phone?: string | null,
  defaultDialCode: string = DEFAULT_DIAL_CODE
): string {
  if (!phone?.trim()) return "";
  const { dialCode, local } = splitPhone(phone, defaultDialCode);
  if (!local) return phone;
  return `+${dialCode} ${local}`;
}

export function buildContactWhatsAppLink(
  phone: string | undefined,
  contactName: string,
  message?: string
): string {
  const waPhone = formatPhoneForWhatsApp(phone);
  const text = encodeURIComponent(message || `مرحباً ${contactName}،`);
  if (waPhone) {
    return `https://wa.me/${waPhone}?text=${text}`;
  }
  return `https://wa.me/?text=${text}`;
}
