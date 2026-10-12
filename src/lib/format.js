// Formatting helpers. Pure functions, no chain access.

const WAD = 10n ** 18n;

/** Format an 18-decimal bigint amount: whole units with separators, up to `dp` decimals. */
export function fmtToken(value, { dp = 2, decimals = 18 } = {}) {
  if (value === undefined || value === null) return '—';
  const base = 10n ** BigInt(decimals);
  const neg = value < 0n;
  const v = neg ? -value : value;
  const whole = v / base;
  let frac = v % base;
  let fracStr = '';
  if (dp > 0 && frac > 0n) {
    const scale = 10n ** BigInt(decimals - dp);
    // round half up at `dp`
    let f = (frac + scale / 2n) / scale;
    let w = whole;
    if (f >= 10n ** BigInt(dp)) { f -= 10n ** BigInt(dp); w += 1n; }
    fracStr = f.toString().padStart(dp, '0').replace(/0+$/, '');
    return (neg ? '-' : '') + group(w) + (fracStr ? '.' + fracStr : '');
  }
  return (neg ? '-' : '') + group(whole);
}

/** Compact form for chart axes: 1.2M, 950K. */
export function fmtCompact(value, decimals = 18) {
  if (value === undefined || value === null) return '—';
  const n = Number(value / 10n ** BigInt(Math.max(decimals - 6, 0))) / 1e6;
  if (n >= 1e9) return trim(n / 1e9) + 'B';
  if (n >= 1e6) return trim(n / 1e6) + 'M';
  if (n >= 1e3) return trim(n / 1e3) + 'K';
  return trim(n);
}
// Strip trailing zeros only after a decimal point ("590" stays "590", "1.50" -> "1.5").
const trim = (n) => (n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2)).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');

export function group(n) {
  return BigInt(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** ETH estimate for an OG amount, given ETH per 1 OG as a float. */
export function fmtEthEstimate(og, ethPerOg) {
  if (!ethPerOg || og === undefined || og === null) return null;
  const eth = (Number(og / 10n ** 12n) / 1e6) * ethPerOg;
  if (!Number.isFinite(eth) || eth <= 0) return null;
  if (eth >= 100) return eth.toFixed(1);
  if (eth >= 1) return eth.toFixed(3);
  if (eth >= 0.001) return eth.toFixed(4);
  return eth.toPrecision(2);
}

export const shortAddr = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');

export const pad4 = (n) => '#' + String(n).padStart(4, '0');

export function countdown(targetSec, nowMs = Date.now()) {
  let s = Math.max(0, Number(targetSec) - Math.floor(nowMs / 1000));
  const d = Math.floor(s / 86400); s -= d * 86400;
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60); s -= m * 60;
  return { done: d + h + m + s === 0, text: `${d}D ${String(h).padStart(2, '0')}H ${String(m).padStart(2, '0')}M ${String(s).padStart(2, '0')}S` };
}

export function ago(seconds) {
  if (seconds < 90) return `${Math.max(1, Math.round(seconds))}s ago`;
  if (seconds < 5400) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 172800) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / 86400)}d ago`;
}

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const pct = (num, den) => (den > 0n ? Number((num * 10000n) / den) / 100 : 0);

export { WAD };
