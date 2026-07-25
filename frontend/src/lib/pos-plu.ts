/**
 * GS1-style variable-measure EAN-13 (prefix 2):
 * 2 + AAAAA (article) + VVVVV (value) + C (check)
 * Value = weight in grams → qty kg = value/1000
 * or embedded price in fils/baisa → unit price = value/1000
 */

export type PluParse = {
  articleCode: string;
  valueInt: number;
  /** weight → quantity in kg; price → override unit price */
  mode: "weight" | "price";
};

export function parseVariableMeasureBarcode(raw: string): PluParse | null {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length !== 13) return null;
  if (digits[0] !== "2") return null;
  const articleCode = digits.slice(1, 6);
  const valueInt = parseInt(digits.slice(6, 11), 10);
  if (!articleCode || Number.isNaN(valueInt)) return null;
  // Heuristic: values ≥ 100 typically grams/fils; small values still valid
  return { articleCode, valueInt, mode: "weight" };
}

export function pluWeightQty(valueInt: number): number {
  const kg = valueInt / 1000;
  if (kg <= 0) return 0.001;
  return Math.round(kg * 1000) / 1000;
}

export function pluEmbeddedPrice(valueInt: number): number {
  return Math.round((valueInt / 1000) * 1000) / 1000;
}

/** Match PLU article against product barcode/sku (exact or trailing 5). */
export function productMatchesPluArticle(
  product: { barcode?: string | null; sku?: string | null },
  articleCode: string,
): boolean {
  const art = articleCode.replace(/\D/g, "");
  if (!art) return false;
  const bc = (product.barcode || "").replace(/\D/g, "");
  const sku = (product.sku || "").trim();
  if (bc === art || bc.endsWith(art)) return true;
  if (sku === art || sku.replace(/\D/g, "").endsWith(art)) return true;
  return false;
}
