# Hisaby Mobile (Capacitor)

Scaffold for a future native shell around the Next.js POS / dashboard.

## Status

- **Web POS** is production path today (browser + Web Serial for drawers/printers where supported).
- **Capacitor** is prepared here so Android/iOS builds can wrap `https://www.hisaby.pro` (or a local `frontend` export) when you are ready.
- **BLE** helpers live in `frontend/src/lib/capacitor-ble.ts` (vendor presets + stubs). Reliable BLE only works inside a native Capacitor build with a BLE plugin.

## Quick start (when ready)

```bash
npm create @capacitor/app@latest
# point webDir at a static export or load the hosted URL
npx cap add android
npx cap add ios
```

Recommended plugins later:

- `@capacitor-community/bluetooth-le` — thermal printers / scanners
- `@capacitor/preferences` — offline flags
- NFC plugin only for **badge dual-control**, never for partner card payments

## Partner pay vs NFC badge

| Feature | Channel |
|--------|---------|
| Customer card / wallet / tap-to-pay | Thawani / Stripe / PayPal via `POST /pos/sales/:invoiceId/partner-checkout` |
| Manager dual-control badge | NFC Web / Capacitor NFC — approval only |

Do not conflate the two.
