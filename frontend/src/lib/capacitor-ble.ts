/** Capacitor / BLE helpers for native POS shells. */

export type BleVendorPreset = {
  id: string;
  name: string;
  serviceUuid?: string;
  namePrefixes: string[];
  notesAr: string;
};

export const BLE_VENDOR_PRESETS: BleVendorPreset[] = [
  {
    id: "generic-escpos",
    name: "Generic ESC/POS BLE printer",
    serviceUuid: "0000ffe0-0000-1000-8000-00805f9b34fb",
    namePrefixes: ["Printer", "POS", "BlueTooth Printer", "BTPrinter"],
    notesAr: "طباعة حرارية عامة عبر BLE.",
  },
  {
    id: "rpp",
    name: "RPP / portable thermal",
    serviceUuid: "0000ffe0-0000-1000-8000-00805f9b34fb",
    namePrefixes: ["RPP", "MTP", "InnerPrinter"],
    notesAr: "طابعات محمولة شائعة في نقاط البيع.",
  },
  {
    id: "nordic-uart",
    name: "Nordic UART (NUS)",
    serviceUuid: "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
    namePrefixes: ["Nordic", "UART", "NUS"],
    notesAr: "خدمة UART شائعة للطابعات المخصّصة.",
  },
];

const COMMON_UART = [
  "0000ffe0-0000-1000-8000-00805f9b34fb",
  "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
];

export function isCapacitorNative(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as Window & { Capacitor?: { isNativePlatform?: () => boolean } };
  return !!w.Capacitor?.isNativePlatform?.();
}

async function loadBle() {
  try {
    // Avoid bundler resolve — package only exists in Capacitor mobile builds.
    const specifier = "@capacitor-community/bluetooth-le";
    // eslint-disable-next-line no-new-func
    const dynamicImport = new Function("s", "return import(s)") as (
      s: string,
    ) => Promise<Record<string, unknown>>;
    const mod = await dynamicImport(specifier);
    return (mod.BleClient || mod.BluetoothLe || null) as {
      initialize: () => Promise<void>;
      requestLEScan: (opts: unknown, cb: (r: unknown) => void) => Promise<void>;
      stopLEScan: () => Promise<void>;
      connect: (id: string, opts?: unknown) => Promise<void>;
      disconnect: (id: string) => Promise<void>;
      getCharacteristics: (id: string, svc: string) => Promise<unknown>;
      write: (id: string, svc: string, uuid: string, data: Uint8Array) => Promise<void>;
    } | null;
  } catch {
    return null;
  }
}

export async function scanBlePrinters(): Promise<{
  available: boolean;
  devices: { id: string; name: string }[];
  error?: string;
}> {
  if (!isCapacitorNative()) {
    return { available: false, devices: [], error: "Not a Capacitor native shell" };
  }
  const BleClient = await loadBle();
  if (!BleClient) {
    return {
      available: false,
      devices: [],
      error: "Install @capacitor-community/bluetooth-le in mobile/ and sync",
    };
  }
  try {
    await BleClient.initialize();
    const devices: { id: string; name: string }[] = [];
    await BleClient.requestLEScan({ services: COMMON_UART }, (result: { device?: { deviceId?: string; name?: string } }) => {
      const d = result?.device;
      if (d?.deviceId) {
        devices.push({ id: d.deviceId, name: d.name || d.deviceId });
      }
    });
    await new Promise((r) => setTimeout(r, 4000));
    await BleClient.stopLEScan();
    const uniq = new Map(devices.map((d) => [d.id, d]));
    return { available: true, devices: Array.from(uniq.values()) };
  } catch (err) {
    return {
      available: true,
      devices: [],
      error: err instanceof Error ? err.message : "scan failed",
    };
  }
}

export async function connectBleDevice(deviceId: string): Promise<{ ok: boolean; error?: string }> {
  if (!isCapacitorNative()) {
    return { ok: false, error: "Capacitor native shell required for BLE" };
  }
  const BleClient = await loadBle();
  if (!BleClient) {
    return { ok: false, error: "BLE plugin not installed in this build" };
  }
  try {
    await BleClient.initialize();
    await BleClient.connect(deviceId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "connect failed" };
  }
}

/** Write ESC/POS bytes to a connected BLE printer (chunked). */
export async function writeBleEscPos(
  deviceId: string,
  bytes: Uint8Array,
  serviceUuid = COMMON_UART[0],
): Promise<{ ok: boolean; error?: string }> {
  if (!isCapacitorNative()) {
    return { ok: false, error: "Capacitor native shell required" };
  }
  const BleClient = await loadBle();
  if (!BleClient) {
    return { ok: false, error: "BLE plugin not installed" };
  }
  try {
    await BleClient.initialize();
    await BleClient.connect(deviceId, { timeout: 10000 });
    let written = false;
    for (const svc of [serviceUuid, ...COMMON_UART]) {
      try {
        const chars = await BleClient.getCharacteristics(deviceId, svc);
        const list = Array.isArray(chars)
          ? chars
          : ((chars as { characteristics?: unknown[] } | null)?.characteristics || []);
        for (const ch of list as {
          uuid?: string;
          characteristic?: string;
          properties?: Record<string, boolean>;
        }[]) {
          const uuid = ch.uuid || ch.characteristic;
          const props = ch.properties || {};
          if (props.write || props.writeWithoutResponse || props.Write || props.WriteWithoutResponse) {
            const chunk = 20;
            for (let i = 0; i < bytes.length; i += chunk) {
              const slice = bytes.slice(i, i + chunk);
              await BleClient.write(deviceId, svc, uuid, slice);
            }
            written = true;
            break;
          }
        }
      } catch {
        /* try next */
      }
      if (written) break;
    }
    try {
      await BleClient.disconnect(deviceId);
    } catch {
      /* ignore */
    }
    return written
      ? { ok: true }
      : { ok: false, error: "No writable UART characteristic found" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "write failed" };
  }
}

const LAST_BLE_PRINTER_KEY = "hisaby-pos-ble-printer-id";

export function getLastBlePrinterId(): string | null {
  try {
    return localStorage.getItem(LAST_BLE_PRINTER_KEY);
  } catch {
    return null;
  }
}

export function setLastBlePrinterId(id: string | null): void {
  try {
    if (!id) localStorage.removeItem(LAST_BLE_PRINTER_KEY);
    else localStorage.setItem(LAST_BLE_PRINTER_KEY, id);
  } catch {
    /* ignore */
  }
}
