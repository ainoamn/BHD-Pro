/** Minimal ESC/POS builder + Web Serial / Bluetooth printer for Hisaby POS receipts. */

export type EscPosReceiptLine = { name: string; qty: number; lineTotal: number };

export type EscPosReceipt = {
  brand: string;
  companyName: string;
  vatNumber?: string;
  warehouseLabel?: string;
  number?: string;
  paymentMethod?: string;
  totalLabel: string;
  total: number;
  currency: string;
  lines: EscPosReceiptLine[];
};

const PREFER_THERMAL_KEY = "hisaby-pos-prefer-thermal";

export function getPreferThermalPrinter(): boolean {
  try {
    return localStorage.getItem(PREFER_THERMAL_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setPreferThermalPrinter(prefer: boolean): void {
  try {
    localStorage.setItem(PREFER_THERMAL_KEY, prefer ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function encode(text: string): Uint8Array {
  // ESC/POS code page 437-ish: strip non-ASCII for thermal compatibility
  const cleaned = text.replace(/[^\x20-\x7E\n\r\t]/g, "?");
  const out = new Uint8Array(cleaned.length);
  for (let i = 0; i < cleaned.length; i++) out[i] = cleaned.charCodeAt(i);
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function line(text: string): Uint8Array {
  return encode(`${text}\n`);
}

/** Build raw ESC/POS bytes for an 80mm receipt. */
export function buildEscPosReceipt(r: EscPosReceipt): Uint8Array {
  const INIT = new Uint8Array([0x1b, 0x40]); // ESC @
  const CENTER = new Uint8Array([0x1b, 0x61, 0x01]);
  const LEFT = new Uint8Array([0x1b, 0x61, 0x00]);
  const BOLD_ON = new Uint8Array([0x1b, 0x45, 0x01]);
  const BOLD_OFF = new Uint8Array([0x1b, 0x45, 0x00]);
  const CUT = new Uint8Array([0x1d, 0x56, 0x00]);
  const parts: Uint8Array[] = [INIT, CENTER, BOLD_ON, line(r.brand), BOLD_OFF, line(r.companyName)];
  if (r.vatNumber) parts.push(line(`VAT: ${r.vatNumber}`));
  if (r.warehouseLabel) parts.push(line(r.warehouseLabel));
  parts.push(LEFT, line("--------------------------------"));
  if (r.number) parts.push(line(r.number));
  if (r.paymentMethod) parts.push(line(r.paymentMethod));
  for (const l of r.lines) {
    const name = l.name.slice(0, 24);
    parts.push(line(`${name}`));
    parts.push(line(`  x${l.qty}  ${l.lineTotal.toFixed(3)} ${r.currency}`));
  }
  parts.push(line("--------------------------------"), BOLD_ON, line(`${r.totalLabel}: ${r.total.toFixed(3)} ${r.currency}`), BOLD_OFF);
  parts.push(CENTER, line("Hisaby POS"), line(""), line(""), CUT);
  return concat(...parts);
}

export function isWebSerialSupported(): boolean {
  return typeof navigator !== "undefined" && "serial" in navigator;
}

export function isWebBluetoothSupported(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

/** Request a serial port and print ESC/POS bytes. */
export async function printViaWebSerial(bytes: Uint8Array): Promise<void> {
  if (!isWebSerialSupported()) {
    throw new Error("Web Serial is not supported in this browser");
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nav = navigator as any;
  const port = await nav.serial.requestPort();
  await port.open({ baudRate: 9600 });
  const writer = port.writable.getWriter();
  try {
    await writer.write(bytes);
  } finally {
    writer.releaseLock();
    await port.close();
  }
}

/**
 * Best-effort BLE serial write. Vendor UUIDs vary widely for thermal printers;
 * this tries common Nordic UART-style services after the user picks a device.
 * Returns false if unsupported or no writable characteristic found.
 */
export async function printViaBluetoothSerial(bytes: Uint8Array): Promise<boolean> {
  if (!isWebBluetoothSupported()) return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nav = navigator as any;
  const COMMON_UART = [
    "0000ffe0-0000-1000-8000-00805f9b34fb",
    "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
    "49535343-fe7d-4ae5-8fa9-9fafd205e455",
  ];
  const device = await nav.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: COMMON_UART,
  });
  const server = await device.gatt.connect();
  for (const uuid of COMMON_UART) {
    try {
      const service = await server.getPrimaryService(uuid);
      const chars = await service.getCharacteristics();
      for (const ch of chars) {
        if (ch.properties.write || ch.properties.writeWithoutResponse) {
          const chunk = 20;
          for (let i = 0; i < bytes.length; i += chunk) {
            const slice = bytes.slice(i, i + chunk);
            if (ch.properties.writeWithoutResponse) {
              await ch.writeValueWithoutResponse(slice);
            } else {
              await ch.writeValue(slice);
            }
          }
          return true;
        }
      }
    } catch {
      /* try next service */
    }
  }
  return false;
}

/**
 * Try ESC/POS Web Serial; returns true if sent.
 * Caller should fall back to browser print on false/throw.
 */
export async function tryPrintEscPos(r: EscPosReceipt): Promise<boolean> {
  if (!isWebSerialSupported()) return false;
  const bytes = buildEscPosReceipt(r);
  await printViaWebSerial(bytes);
  return true;
}

/**
 * Prefer Web Serial, then attempt BLE serial stub, else return false
 * (caller falls back to browser print).
 */
export async function tryPrintEscPosSmart(r: EscPosReceipt): Promise<boolean> {
  const bytes = buildEscPosReceipt(r);
  if (isWebSerialSupported()) {
    try {
      await printViaWebSerial(bytes);
      return true;
    } catch {
      /* try Bluetooth */
    }
  }
  if (isWebBluetoothSupported()) {
    try {
      return await printViaBluetoothSerial(bytes);
    } catch {
      return false;
    }
  }
  return false;
}

/** Explicit thermal attempt — Serial first, then BLE. */
export async function tryPrintEscPosBluetooth(r: EscPosReceipt): Promise<boolean> {
  return tryPrintEscPosSmart(r);
}
