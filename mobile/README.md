# Hisaby Mobile (Capacitor)

Native shell around the hosted Next.js POS (`/pos`). **Web POS remains the production path**; this package wraps it for Android/iOS (camera, BLE printers, NFC badge).

## Status

| Piece | Status |
|-------|--------|
| `package.json` + `capacitor.config.ts` | Ready |
| `www/` fallback | Ready |
| Android / iOS projects | Run `npm i` then `npm run add:android` / `add:ios` locally |
| BLE plugin | `@capacitor-community/bluetooth-le` — wired from `frontend/src/lib/capacitor-ble.ts` when native |
| Partner card tap-to-pay | SoftPOS/hosted gateway via API `terminal-tap` — **not** badge NFC |

## Quick start

```bash
cd mobile
npm install
npm run build:web
# optional override:
# set HISABY_MOBILE_SERVER_URL=https://your-frontend/pos
npx cap add android
npx cap sync
npx cap open android
```

## Partner pay vs NFC badge

| Feature | Channel |
|--------|---------|
| Customer card / wallet / tap-to-pay | `POST /pos/sales/:id/terminal-tap` or partner-checkout |
| Manager dual-control badge | Web NFC / Capacitor NFC — approval only |

Do not conflate the two.
