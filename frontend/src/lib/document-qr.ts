import QRCode from "qrcode";

/** Generate a PNG data URL QR for document authenticity verification. */
export async function buildDocumentQrDataUrl(url: string, size = 200): Promise<string> {
  return QRCode.toDataURL(url, {
    width: size,
    margin: 2,
    errorCorrectionLevel: "H",
    color: { dark: "#000000", light: "#ffffff" },
  });
}
