import type { CapacitorConfig } from '@capacitor/cli';

const serverUrl =
  process.env.HISABY_MOBILE_SERVER_URL || 'https://bhd-pro.vercel.app/pos';

const config: CapacitorConfig = {
  appId: 'pro.hisaby.pos',
  appName: 'Hisaby POS',
  webDir: 'www',
  server: {
    // Load the hosted Next.js POS (production path). Override with HISABY_MOBILE_SERVER_URL.
    url: serverUrl,
    cleartext: false,
  },
  plugins: {
    BluetoothLe: {
      displayStrings: {
        scanning: 'Scanning…',
        cancel: 'Cancel',
        availableServices: 'Available services',
        noDeviceFound: 'No device found',
      },
    },
  },
};

export default config;
