export const DEFAULT_DOCUMENT_COLOR = "#059669";

const PRESET_COLORS = [
  "#059669", // emerald
  "#0f766e", // teal
  "#0369a1", // sky/blue
  "#1d4ed8", // blue
  "#6d28d9", // violet
  "#be185d", // pink
  "#b45309", // amber
  "#b91c1c", // red
  "#334155", // slate
  "#0f172a", // near black
] as const;

export const DOCUMENT_COLOR_PRESETS = PRESET_COLORS;

/** Normalize to #RRGGBB or fall back to default. */
export function normalizeDocumentColor(color?: string | null): string {
  if (!color) return DEFAULT_DOCUMENT_COLOR;
  let c = color.trim();
  if (!c.startsWith("#")) c = `#${c}`;
  if (/^#[0-9A-Fa-f]{3}$/.test(c)) {
    const r = c[1];
    const g = c[2];
    const b = c[3];
    c = `#${r}${r}${g}${g}${b}${b}`;
  }
  if (!/^#[0-9A-Fa-f]{6}$/.test(c)) return DEFAULT_DOCUMENT_COLOR;
  return c.toUpperCase();
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const n = normalizeDocumentColor(hex).slice(1);
  const num = Number.parseInt(n, 16);
  if (Number.isNaN(num)) return null;
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

/** Soft tint for banners / backgrounds */
export function documentColorSoft(color?: string | null, alpha = 0.12): string {
  const rgb = hexToRgb(color || DEFAULT_DOCUMENT_COLOR);
  if (!rgb) return "rgba(5, 150, 105, 0.12)";
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

/** Slightly darker shade for strong text accents */
export function documentColorDark(color?: string | null): string {
  const rgb = hexToRgb(color || DEFAULT_DOCUMENT_COLOR);
  if (!rgb) return "#047857";
  const darken = (v: number) => Math.max(0, Math.round(v * 0.82));
  const toHex = (v: number) => v.toString(16).padStart(2, "0");
  return `#${toHex(darken(rgb.r))}${toHex(darken(rgb.g))}${toHex(darken(rgb.b))}`;
}
