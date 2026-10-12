// Post-build guard: fails if the bundle contains analytics/trackers or anything
// that looks like a secret. Run after `npm run build`: npm run check:bundle
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = new URL('../dist/', import.meta.url).pathname;
const BANNED = [
  /google-analytics|googletagmanager|gtag\(/i, /segment\.(io|com)/i, /sentry\.io/i, /posthog/i,
  /mixpanel/i, /plausible\.io/i, /hotjar/i, /fonts\.googleapis/i, /api\.telegram\.org\/bot/i,
  /\b\d{8,10}:[A-Za-z0-9_-]{35}\b/, // Telegram bot token shape
  /PRIVATE_KEY|BOT_TOKEN|MNEMONIC/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];

const files = [];
const walk = (d) => readdirSync(d).forEach((f) => { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : files.push(p); });
walk(DIST);

let bad = 0;
for (const f of files.filter((p) => /\.(js|html|css|json)$/.test(p))) {
  const text = readFileSync(f, 'utf8');
  for (const re of BANNED) {
    const m = text.match(re);
    if (m) { console.error(`${f}: matches ${re} -> "${m[0].slice(0, 40)}"`); bad++; }
  }
}
console.log(`${files.length} files checked`);
if (bad) process.exit(1);
console.log('clean: no trackers, no secrets');
