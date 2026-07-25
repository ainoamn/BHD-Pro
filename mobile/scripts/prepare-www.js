const fs = require('fs');
const path = require('path');

const www = path.join(__dirname, '..', 'www');
if (!fs.existsSync(www)) fs.mkdirSync(www, { recursive: true });
const index = path.join(www, 'index.html');
if (!fs.existsSync(index)) {
  console.error('www/index.html missing');
  process.exit(1);
}
console.log('www ready — Capacitor will load HISABY_MOBILE_SERVER_URL / capacitor.config.ts server.url');
