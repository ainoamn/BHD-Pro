/** Shared helpers for monthly ↔ yearly plan pricing with annual discount. */

export function clampDiscountPct(pct: number): number {
  if (!Number.isFinite(pct)) return 0;
  return Math.min(100, Math.max(0, pct));
}

export function roundMoney(n: number, digits = 3): number {
  if (!Number.isFinite(n)) return 0;
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/** Yearly list = monthly × 12, then apply yearly discount %. */
export function yearlyFromMonthly(
  monthly: number,
  yearlyDiscountPct = 20,
): number {
  const m = Number(monthly) || 0;
  const d = clampDiscountPct(Number(yearlyDiscountPct) || 0);
  return roundMoney(m * 12 * (1 - d / 100));
}

/** Effective monthly from a yearly total (yearly ÷ 12). */
export function monthlyFromYearly(yearly: number): number {
  return roundMoney((Number(yearly) || 0) / 12);
}

/** Implied discount % given monthly list and yearly charged. */
export function discountFromPrices(monthly: number, yearly: number): number {
  const list = (Number(monthly) || 0) * 12;
  if (list <= 0) return 0;
  const y = Number(yearly) || 0;
  return clampDiscountPct(roundMoney(((list - y) / list) * 100, 2));
}

export function yearlySavings(monthly: number, yearly: number): number {
  return roundMoney(Math.max(0, (Number(monthly) || 0) * 12 - (Number(yearly) || 0)));
}
