/** Customer-facing second screen via BroadcastChannel + localStorage mirror. */

export const POS_CUSTOMER_DISPLAY_CHANNEL = "hisaby-pos-customer-display-v1";

export type PosCustomerDisplayPhase = "idle" | "cart" | "pay" | "thankyou";

export type PosCustomerDisplayLine = {
  name: string;
  qty: number;
  total: number;
};

export type PosCustomerDisplayPayload = {
  v: 1;
  companyId: string;
  companyName: string;
  currency: string;
  locale: "ar" | "en";
  phase: PosCustomerDisplayPhase;
  lines: PosCustomerDisplayLine[];
  subtotal: number;
  tax: number;
  total: number;
  cashTendered?: number | null;
  change?: number | null;
  thankYouNumber?: string | null;
  updatedAt: number;
};

export function publishPosCustomerDisplay(payload: PosCustomerDisplayPayload) {
  try {
    const ch = new BroadcastChannel(POS_CUSTOMER_DISPLAY_CHANNEL);
    ch.postMessage(payload);
    ch.close();
  } catch {
    /* BroadcastChannel unsupported */
  }
  try {
    localStorage.setItem(POS_CUSTOMER_DISPLAY_CHANNEL, JSON.stringify(payload));
  } catch {
    /* ignore quota / private mode */
  }
}

export function readPosCustomerDisplay(): PosCustomerDisplayPayload | null {
  try {
    const raw = localStorage.getItem(POS_CUSTOMER_DISPLAY_CHANNEL);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PosCustomerDisplayPayload;
    if (!parsed || parsed.v !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function openPosCustomerDisplayWindow() {
  if (typeof window === "undefined") return;
  window.open("/pos/display", "hisaby-pos-display", "noopener,noreferrer");
}
