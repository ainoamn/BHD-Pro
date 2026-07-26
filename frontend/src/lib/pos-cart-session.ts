/** Persist unfinished POS cart across refresh / crash (per company + user). */

export type PosCartSessionLine = {
  productId: string;
  name: string;
  sku: string;
  barcode?: string | null;
  unitPrice: number;
  catalogPrice: number;
  quantity: number;
  discount: number;
  stock: number;
  isTracked: boolean;
  notes?: string;
};

export type PosCartSession = {
  savedAt: string;
  warehouseId: string;
  contactId: string;
  cartNotes: string;
  tipAmount: number;
  tipCustom: string;
  redeemPointsInput: string;
  cart: PosCartSessionLine[];
};

const PREFIX = "hisaby-pos-cart-session";
/** Discard sessions older than 12 hours */
export const POS_CART_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function key(companyId: string, userId: string) {
  return `${PREFIX}:${companyId}:${userId}`;
}

export function savePosCartSession(
  companyId: string,
  userId: string,
  data: Omit<PosCartSession, "savedAt">,
): void {
  if (!companyId || !userId) return;
  try {
    if (!data.cart.length) {
      clearPosCartSession(companyId, userId);
      return;
    }
    const payload: PosCartSession = {
      ...data,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(key(companyId, userId), JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function loadPosCartSession(
  companyId: string,
  userId: string,
): PosCartSession | null {
  if (!companyId || !userId) return null;
  try {
    const raw = localStorage.getItem(key(companyId, userId));
    if (!raw) return null;
    const data = JSON.parse(raw) as PosCartSession;
    if (!data?.cart?.length || !data.savedAt) {
      clearPosCartSession(companyId, userId);
      return null;
    }
    const age = Date.now() - new Date(data.savedAt).getTime();
    if (!Number.isFinite(age) || age > POS_CART_SESSION_TTL_MS) {
      clearPosCartSession(companyId, userId);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function clearPosCartSession(companyId: string, userId: string): void {
  if (!companyId || !userId) return;
  try {
    localStorage.removeItem(key(companyId, userId));
  } catch {
    /* ignore */
  }
}

/** Stable fingerprint for duplicate-sale soft-warn. */
export function posCartFingerprint(input: {
  warehouseId: string;
  contactId: string;
  total: number;
  cart: {
    productId: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
  }[];
}): string {
  const lines = input.cart
    .map(
      (l) =>
        `${l.productId}:${Number(l.quantity)}:${Number(l.unitPrice)}:${Number(l.discount || 0)}`,
    )
    .sort()
    .join("|");
  return `${input.warehouseId}|${input.contactId || ""}|${Number(input.total).toFixed(3)}|${lines}`;
}

const DUP_KEY = "hisaby-pos-last-sale-fp";
export const POS_DUP_SALE_WINDOW_MS = 60_000;

export function readLastSaleFingerprint(): { fp: string; at: number } | null {
  try {
    const raw = sessionStorage.getItem(DUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { fp?: string; at?: number };
    if (!parsed?.fp || !parsed.at) return null;
    return { fp: parsed.fp, at: parsed.at };
  } catch {
    return null;
  }
}

export function writeLastSaleFingerprint(fp: string): void {
  try {
    sessionStorage.setItem(
      DUP_KEY,
      JSON.stringify({ fp, at: Date.now() }),
    );
  } catch {
    /* ignore */
  }
}
