import QRCode from "qrcode";

/**
 * Generate a PNG data URL QR for document authenticity verification.
 * Use medium error correction + larger size so phone cameras scan short URLs reliably.
 */
export async function buildDocumentQrDataUrl(url: string, size = 280): Promise<string> {
  return QRCode.toDataURL(url, {
    width: size,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#000000", light: "#ffffff" },
  });
}
