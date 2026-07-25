/** Capacitor / BLE helpers for native POS shells (stubs until Capacitor app is built). */

export type BleVendorPreset = {
  id: string;
  name: string;
  serviceUuid?: string;
  /** ESC/POS printers commonly advertise these name prefixes */
  namePrefixes: string[];
  notesAr: string;
};

export const BLE_VENDOR_PRESETS: BleVendorPreset[] = [
  {
    id: "generic-escpos",
    name: "Generic ESC/POS BLE printer",
    namePrefixes: ["Printer", "POS", "BlueTooth Printer"],
    notesAr: "طباعة حرارية عامة عبر BLE — يتطلب تطبيق Capacitor مبني.",
  },
  {
    id: "rpp",
    name: "RPP / portable thermal",
    namePrefixes: ["RPP", "MTP"],
    notesAr: "طابعات محمولة شائعة في نقاط البيع.",
  },
];

export function isCapacitorNative(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as Window & { Capacitor?: { isNativePlatform?: () => boolean } };
  return !!w.Capacitor?.isNativePlatform?.();
}

export async function scanBlePrinters(): Promise<{ available: boolean; devices: { id: string; name: string }[] }> {
  if (!isCapacitorNative()) {
    return { available: false, devices: [] };
  }
  // Native plugin wiring lands with the Capacitor shell (see mobile/README.md).
  return { available: true, devices: [] };
}

export async function connectBleDevice(_deviceId: string): Promise<{ ok: boolean; error?: string }> {
  if (!isCapacitorNative()) {
    return { ok: false, error: "Capacitor native shell required for BLE" };
  }
  return { ok: false, error: "BLE plugin not installed in this build" };
}
