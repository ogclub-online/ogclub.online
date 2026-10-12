// App controller: state, polling, events. Takes the chain `api` as a parameter
// so the UI can also run against a mock for design review.
import * as R from './ui/render.js';
import { countdown, fmtToken, pad4 } from './lib/format.js';
import { CHAIN_ID, POLL_MS } from './config.js';

export function start(api) {
  const s = {
    g: null, gErr: null, curve: null, act: null, actErr: null, ethPerOg: undefined, rootOk: null,
    wallet: { account: null, chainId: null, providers: [], walletName: null },
    user: null, pickerOpen: false,
    ack: { buy: false, sellFounder: false },
    tx: {}, chartW: 720,
  };

  const $ = (id) => document.getElementById(id);
  const sections = {
    hdr: () => R.header(s), hero: () => R.hero(s), curve: () => R.curve(s), trade: () => R.trade(s),
    founders: () => R.founders(s), members: () => R.members(s), ledger: () => R.ledger(s),
  };
  // Batch renders into one frame. `only` limits which sections re-render
  // (keeps focus in checkboxes); a full render wins over partial ones.
  let pending = null; // null = nothing queued, 'all', or a Set of ids
  let refocus = null;
  function render(only) {
    const first = pending === null;
    if (!only) pending = 'all';
    else if (pending !== 'all') { pending ??= new Set(); only.forEach((id) => pending.add(id)); }
    if (!first) return;
    requestAnimationFrame(() => {
      const which = pending;
      pending = null;
      for (const [id, fn] of Object.entries(sections)) {
        if (which !== 'all' && !which.has(id)) continue;
        const el = $(id);
        if (el) el.innerHTML = fn();
      }
      if (refocus) { document.querySelector(`[data-ack="${refocus}"]`)?.focus(); refocus = null; }
      bindChart();
      measureChart();
    });
  }
  // Re-draw the chart at its real width (no stretched text on phones).
  function measureChart() {
    const box = document.getElementById('chart');
    const w = box?.clientWidth;
    if (w && Math.abs(w - s.chartW) > 2) { s.chartW = w; render(['curve']); }
  }
  let rz = null;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(measureChart, 120); });
  const set = (patch, only) => { Object.assign(s, patch); render(only); };
  const setTx = (key, t) => { s.tx = { ...s.tx, [key]: t }; render(); };

  // ------------------------------------------------------------ data loading
  let inflight = false;
  async function refresh() {
    if (inflight) return;
    inflight = true;
    try {
      const g = await api.loadGlobal();
      const curveLen = Number(g.publicSupply) + 100;
      set({ g, gErr: null });
      if (s.rootOk === null) api.rootMatches(g.founderRoot).then((ok) => set({ rootOk: ok }));
      const [curve, eth] = await Promise.all([
        s.curve?.length === curveLen ? s.curve : api.loadCurve(curveLen).catch(() => s.curve),
        api.loadEthPerOg().catch(() => null),
      ]);
      set({ curve, ethPerOg: eth });
      try {
        const act = await api.loadActivity(g.blockNumber);
        set({ act, actErr: null });
      } catch (e) {
        set({ actErr: 'Could not read event logs from the public RPCs. Retrying…' });
      }
      await refreshUser();
    } catch (e) {
      console.error(e);
      set({ gErr: 'Could not reach Ethereum through the public RPCs. Retrying…' });
    } finally {
      inflight = false;
    }
  }

  async function refreshUser() {
    const a = s.wallet.account;
    if (!a) return set({ user: null });
    try {
      const user = await api.loadUser(a, s.act?.logs);
      if (s.wallet.account === a) set({ user });
    } catch (e) {
      console.error(e);
    }
  }

  // ------------------------------------------------------------ wallet
  api.wallet.onChange((w) => {
    const changed = w.account !== s.wallet.account;
    s.wallet = w;
    if (changed) { s.user = null; s.tx = {}; s.ack = { buy: false, sellFounder: false }; refreshUser(); }
    if (w.account && s.pickerOpen) s.pickerOpen = false;
    render();
  });

  // ------------------------------------------------------------ actions
  const msgs = {
    quote: () => 'Reading the current price…',
    approve: (e) => `Approve exactly ${fmtToken(e.quote, { dp: 0 })} OG in your wallet…`,
    moved: (e) => `Price moved from ${fmtToken(e.from, { dp: 0 })} to ${fmtToken(e.to, { dp: 0 })} OG. Re-quoting and re-approving…`,
    buy: (e) => `Confirm buy(maxPrice = ${fmtToken(e.quote, { dp: 0 })} OG) in your wallet…`,
    sell: (e) => `Confirm sell(minOut = ${fmtToken(e.payout, { dp: 0 })} OG) in your wallet…`,
    claim: () => 'Confirm claimFounder in your wallet…',
    sellFounder: () => 'Confirm sellFounder in your wallet…',
  };
  async function run(key, fn, doneMsg) {
    const step = (e) => setTx(key, { stage: e.stage, msg: msgs[e.stage]?.(e) ?? '' });
    try {
      const res = await fn(step);
      setTx(key, { done: true, msg: typeof doneMsg === 'function' ? doneMsg(res) : doneMsg, hash: res?.hash });
      await refresh();
    } catch (e) {
      console.error(e);
      setTx(key, { err: api.describeError(e) });
    }
  }

  async function onAction(act, el) {
    switch (act) {
      case 'connect': {
        const list = s.wallet.providers;
        if (list.length === 1) {
          try { await api.wallet.connect(list[0].rdns); } catch (e) { setTx('connect', { err: api.describeError(e) }); }
        } else set({ pickerOpen: true });
        break;
      }
      case 'pick':
        try { await api.wallet.connect(el.dataset.rdns); } catch (e) { console.error(e); }
        break;
      case 'close-picker': set({ pickerOpen: false }); break;
      case 'disconnect': api.wallet.disconnect(); break;
      case 'switch': try { await api.wallet.switchToMainnet(); } catch (e) { console.error(e); } break;
      case 'refresh': refresh(); break;
      case 'buy': run('buy', api.buy, (r) => `Welcome to the club. Paid ${fmtToken(r.quote, { dp: 0 })} OG.`); break;
      case 'sell': if (s.user?.tokenId != null) run('sell', (st) => api.sell(s.user.tokenId, st), (r) => `Sold. Received ${fmtToken(r.payout, { dp: 0 })} OG.`); break;
      case 'claim': run('claim', api.claimFounder, 'Founder pass claimed. Welcome.'); break;
      case 'sellFounder': if (s.user?.tokenId != null) run('sellFounder', (st) => api.sellFounder(s.user.tokenId, st), `Founder pass ${pad4(s.user.tokenId)} sold back.`); break;
    }
  }

  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-act]');
    if (el && !el.disabled) { ev.preventDefault(); onAction(el.dataset.act, el); return; }
    if (ev.target.classList?.contains('modal')) set({ pickerOpen: false });
  });
  document.addEventListener('change', (ev) => {
    const k = ev.target.dataset?.ack;
    if (k) { s.ack = { ...s.ack, [k]: ev.target.checked }; refocus = k; render(['trade', 'founders']); }
  });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && s.pickerOpen) set({ pickerOpen: false }); });

  // ------------------------------------------------------------ chart hover
  function bindChart() {
    const svg = document.querySelector('#chart svg');
    const tip = $('chart-tip');
    if (!svg || !tip || svg.dataset.bound) return;
    svg.dataset.bound = '1';
    const n = Number(svg.dataset.n), L = Number(svg.dataset.l), Rr = Number(svg.dataset.r), W = Number(svg.dataset.w);
    const col = svg.querySelector('.hover-col');
    const move = (ev) => {
      const box = svg.getBoundingClientRect();
      const x = ((ev.clientX - box.left) / box.width) * W;
      const i = Math.min(n - 1, Math.max(0, Math.floor(((x - L) / (W - L - Rr)) * n)));
      const bw = (W - L - Rr) / n;
      col.setAttribute('x', (L + i * bw).toFixed(2));
      col.setAttribute('width', Math.max(bw, 1.5).toFixed(2));
      const num = i + 1, supply = Number(s.g.publicSupply);
      const tag = num <= supply ? 'ISSUED' : num === supply + 1 ? 'NEXT' : 'AHEAD';
      tip.textContent = `${pad4(num)} · ${fmtToken(s.curve[i], { dp: 0 })} OG · ${tag}`;
    };
    svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerdown', move);
    svg.addEventListener('pointerleave', () => { col.setAttribute('width', '0'); tip.textContent = 'HOVER OR TAP THE CHART'; });
  }

  // ------------------------------------------------------------ timers
  setInterval(() => {
    document.querySelectorAll('[data-countdown]').forEach((el) => {
      el.textContent = countdown(el.dataset.countdown).text;
    });
  }, 1000);
  let timer = null;
  const schedule = () => { clearInterval(timer); timer = setInterval(() => { if (!document.hidden) refresh(); }, POLL_MS); };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });

  // ------------------------------------------------------------ boot
  $('ftr').innerHTML = R.footer();
  render();
  api.wallet.discover();
  refresh();
  schedule();
  return { state: s, refresh, CHAIN_ID };
}
