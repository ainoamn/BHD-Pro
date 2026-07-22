/** Normalize country codes to Arabic labels when possible. */
export function formatCountryLabel(country?: string | null): string | null {
  if (!country?.trim()) return null;
  const code = country.trim().toUpperCase();
  if (code === "OM" || code === "OMN") return "سلطنة عمان";
  if (code === "SA" || code === "SAU") return "المملكة العربية السعودية";
  if (code === "AE" || code === "ARE") return "الإمارات العربية المتحدة";
  if (code === "KW" || code === "KWT") return "الكويت";
  if (code === "BH" || code === "BHR") return "البحرين";
  if (code === "QA" || code === "QAT") return "قطر";
  return country.trim();
}

function includesIgnoreCase(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

/**
 * Compact contact lines for invoices — avoids repeating city/country
 * when they are already present inside the street address.
 */
export function formatContactAddressLines(contact: {
  address?: string | null;
  city?: string | null;
  zipCode?: string | null;
  country?: string | null;
  phone?: string | null;
  phone2?: string | null;
  email?: string | null;
} | null | undefined): string[] {
  if (!contact) return [];

  const address = contact.address?.trim() || "";
  const city = contact.city?.trim() || "";
  const zip = contact.zipCode?.trim() || "";
  const countryLabel = formatCountryLabel(contact.country);

  const locationParts: string[] = [];
  if (city && !(address && includesIgnoreCase(address, city))) {
    locationParts.push(city);
  }
  if (zip) locationParts.push(zip);
  if (
    countryLabel &&
    !(address && includesIgnoreCase(address, countryLabel)) &&
    !(address && contact.country && includesIgnoreCase(address, contact.country))
  ) {
    locationParts.push(countryLabel);
  }

  const lines: string[] = [];
  if (address) lines.push(address);
  if (locationParts.length) lines.push(locationParts.join(" — "));

  const phones = [contact.phone?.trim(), contact.phone2?.trim()].filter(
    (p, i, arr): p is string => !!p && arr.indexOf(p) === i
  );
  if (phones.length) lines.push(phones.join(" · "));
  if (contact.email?.trim()) lines.push(contact.email.trim());
  return lines;
}

/** Single compact line for company header (address · city · phone). */
export function formatCompanyAddressCompact(company: {
  address?: string | null;
  city?: string | null;
  phone?: string | null;
} | null | undefined): string {
  if (!company) return "";
  const address = company.address?.trim() || "";
  const city = company.city?.trim() || "";
  const phone = company.phone?.trim() || "";
  const parts: string[] = [];
  if (address) parts.push(address);
  if (city && !(address && includesIgnoreCase(address, city))) parts.push(city);
  if (phone) parts.push(phone);
  return parts.join(" · ");
}
