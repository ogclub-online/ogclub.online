// Pure rendering: state in, HTML out. No chain access, no viem.
import { pixelText as px, crownSvg } from '../lib/pixel.js';
import { fmtToken, fmtCompact, fmtEthEstimate, shortAddr, pad4, countdown, ago, esc, group } from '../lib/format.js';
import {
  OGPASS_ADDRESS, OG_TOKEN, EXPLORER, DISCLAIMER, SWARM_MAP_URL, CHAIN_ID,
} from '../config.js';

const og = (v, dp = 2) => fmtToken(v, { dp });
const ext = (href, label) => `<a class="lnk" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(label)} <span class="arr" aria-hidden="true">↗</span></a>`;
const addrLink = (a) => `<a class="mono-link" href="${EXPLORER}/address/${a}" target="_blank" rel="noopener noreferrer">${shortAddr(a)}</a>`;
const txLink = (h, label = 'view tx') => `<a class="lnk" href="${EXPLORER}/tx/${h}" target="_blank" rel="noopener noreferrer">${label} <span class="arr" aria-hidden="true">↗</span></a>`;
const eth = (amount, s) => {
  const e = fmtEthEstimate(amount, s.ethPerOg);
  return e ? `<span class="eth">≈ ${e} ETH</span>` : '';
};
const loading = (w = '6ch') => `<span class="skel" style="width:${w}" aria-label="loading"></span>`;

export function walletState(s) {
  const w = s.wallet;
  if (!w.account) return 'disconnected';
  if (w.chainId !== CHAIN_ID) return 'wrong-chain';
  return 'ready';
}

function badge(s) {
  if (!s.user) return '';
  if (!s.user.isMember) return `<span class="badge badge-none">NO PASS</span>`;
  return s.user.isFounderPass ? `<span class="badge badge-founder">FOUNDER</span>` : `<span class="badge badge-public">PUBLIC</span>`;
}

// ---------------------------------------------------------------- header
export function header(s) {
  const ws = walletState(s);
  let right;
  if (ws === 'disconnected') {
    right = `<button class="btn btn-sm" data-act="connect">CONNECT WALLET</button>`;
  } else {
    right = `
      <div class="who">
        ${badge(s)}
        <span class="who-bal">${s.user ? `${og(s.user.ogBalance, 0)} <b>OG</b>` : loading('7ch')}</span>
        <button class="who-addr" data-act="disconnect" title="Disconnect ${esc(s.wallet.walletName ?? '')}">${shortAddr(s.wallet.account)}</button>
      </div>`;
  }
  const guard = ws === 'wrong-chain'
    ? `<div class="guard" role="alert"><span>WRONG NETWORK. OG CLUB LIVES ON ETHEREUM MAINNET.</span><button class="btn btn-sm btn-orange" data-act="switch">SWITCH TO ETHEREUM</button></div>`
    : '';
  const picker = s.pickerOpen ? walletPicker(s) : '';
  return `
    <div class="hdr-in wrap">
      <a class="hdr-mark" href="#top" aria-label="OG Club home">${px('OG CLUB.', { accentLast: true, cls: 'px-mark' })}</a>
      <nav class="hdr-nav" aria-label="Sections">
        <a href="#curve">CURVE</a><a href="#trade">BUY</a><a href="#founders">FOUNDERS</a><a href="#members">MEMBERS</a><a href="#ledger">LEDGER</a>
      </nav>
      <div class="hdr-right ${ws === 'disconnected' ? '' : 'is-conn'}">${right}</div>
    </div>
    ${guard}${picker}`;
}

function walletPicker(s) {
  const list = s.wallet.providers;
  const items = list.length
    ? list.map((p) => `<button class="pick" data-act="pick" data-rdns="${esc(p.rdns)}">${p.icon ? `<img src="${esc(p.icon)}" alt="" width="24" height="24">` : '<span class="pick-dot"></span>'}<span>${esc(p.name)}</span></button>`).join('')
    : `<p class="muted">No browser wallet found. Install one that supports EIP-6963 (MetaMask, Rabby, Coinbase Wallet…) and reload.</p>`;
  return `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="pick-title">
      <div class="modal-card card">
        <div class="card-head"><h2 id="pick-title">${px('CHOOSE A WALLET')}</h2><button class="x" data-act="close-picker" aria-label="Close">×</button></div>
        <div class="pick-list">${items}</div>
        <p class="fine">Injected wallets only. This site has no analytics and never sees your keys.</p>
      </div>
    </div>`;
}

// ---------------------------------------------------------------- hero
export function hero(s) {
  const g = s.g;
  const issued = g ? g.publicSupply + g.founderOutstanding : null;
  const max = g?.maxSupply ?? 1000n;
  const seg = (v) => (g ? (Number(v) / Number(max)) * 100 : 0);
  const u = s.user;
  const status = !s.wallet.account ? 'CONNECT TO SEE YOURS'
    : !u ? 'READING…'
    : !u.isMember ? 'NOT A MEMBER YET'
    : u.isFounderPass ? 'FOUNDER' : 'PUBLIC';
  const tone = u?.isMember ? (u.isFounderPass ? 'tone-founder' : 'tone-public') : 'tone-guest';
  const title = u?.isMember && u.tokenId !== null ? pad4(u.tokenId) : 'OG PASS';

  return `
  <div class="wrap hero-grid">
    <div class="hero-copy">
      <h1 class="wordmark">${px('OG CLUB.', { accentLast: true, gap: 0.82 })}</h1>
      <hr class="rule-orange">
      <p class="hero-sub">${px('MEMBERS ONLY.')}<br>${px('PRICED BY THE CURVE.')}</p>
      <p class="hero-lines">
        1,000 NON-TRANSFERABLE PASSES.<br>
        49 FOUNDER SEATS. THE REST ON A PUBLIC CURVE.<br>
        PAID IN OG. 7.5% OF EVERY EXIT IS BURNED.
      </p>
      <a class="lnk" href="#trade">GET A PASS <span class="arr" aria-hidden="true">↓</span></a>

      <div class="supply">
        <div class="supply-head"><span class="label">PASSES ISSUED</span><button class="lnk lnk-btn" data-act="refresh">REFRESH <span aria-hidden="true">↻</span></button></div>
        <div class="supply-num">${g ? `${px(group(issued))}<span class="slash">/</span>${px(group(max), { cls: 'px-dim' })}` : loading('10ch')}</div>
        <div class="bar" role="img" aria-label="${g ? `${issued} of ${max} issued: ${g.publicSupply} public, ${g.founderOutstanding} founder, ${g.reservedFounderSlots} founder slots reserved` : 'loading'}">
          <span class="bar-pub" style="width:${seg(g?.publicSupply ?? 0n)}%"></span>
          <span class="bar-fnd" style="width:${seg(g?.founderOutstanding ?? 0n)}%"></span>
          <span class="bar-res" style="width:${seg(g?.reservedFounderSlots ?? 0n)}%"></span>
        </div>
        <div class="legend">
          <span><i class="sw sw-pub"></i>PUBLIC ${g ? group(g.publicSupply) : '…'}</span>
          <span><i class="sw sw-fnd"></i>FOUNDER ${g ? group(g.founderOutstanding) : '…'}</span>
          <span><i class="sw sw-res"></i>RESERVED ${g ? group(g.reservedFounderSlots) : '…'}</span>
        </div>
        <p class="fine">${g ? `READ AT BLOCK ${group(g.blockNumber)}` : s.gErr ? `<span class="err">${esc(s.gErr)}</span>` : 'READING ETHEREUM…'}</p>
      </div>
    </div>

    <figure class="hero-card">
      <div class="card card-lime pass ${tone}">
        <div class="emblem-wrap">${crownSvg('OG Club pass emblem')}</div>
        <div class="card-row">
          <span class="card-title">${px(title)}</span>
          <span class="status">${esc(status)}</span>
        </div>
        <hr class="rule-lime">
        <p class="traits">NON-TRANSFERABLE <i>/</i> ONE PER WALLET <i>/</i> CURVE BUYBACK</p>
      </div>
      <figcaption class="cap"><span>24 × 24 PIXELS</span><span>ETHEREUM MAINNET</span></figcaption>
    </figure>
  </div>`;
}

// ---------------------------------------------------------------- curve
export function curve(s) {
  const g = s.g;
  const head = `
    <div class="sec-head">
      <h2>${px('THE CURVE')}</h2>
      ${ext(`${EXPLORER}/address/${OGPASS_ADDRESS}#code`, 'VERIFIED CONTRACT')}
    </div>`;
  if (!g) return `<div class="wrap">${head}<div class="card pad">${s.gErr ? `<p class="err">${esc(s.gErr)}</p>` : loading('100%')}</div></div>`;

  const nextN = g.publicSupply + 1n;
  const burnNow = g.lastPrice - g.sellPrice;
  const tiles = `
    <div class="tiles">
      <div class="tile">
        <span class="label">NEXT PASS ${pad4(nextN)} · BUY</span>
        <span class="big">${g.soldOut ? px('SOLD OUT', { cls: 'px-orange' }) : px(og(g.buyPrice, 0))}</span>
        <span class="unit">OG ${g.soldOut ? '' : eth(g.buyPrice, s)}</span>
      </div>
      <div class="tile">
        <span class="label">SELL PAYOUT NOW</span>
        <span class="big">${g.publicSupply > 0n ? px(og(g.sellPrice, 0)) : px('—')}</span>
        <span class="unit">OG ${g.publicSupply > 0n ? eth(g.sellPrice, s) : ''}</span>
        ${g.publicSupply > 0n ? `<span class="fine">92.5% OF ${og(g.lastPrice, 0)} · ${og(burnNow, 0)} BURNED</span>` : '<span class="fine">NO PUBLIC PASSES YET</span>'}
      </div>
    </div>`;

  const stats = [
    ['CURVE RESERVE', `${og(g.curveReserve, 0)} OG`],
    ['PUBLIC SUPPLY', group(g.publicSupply)],
    ['FOUNDER CLAIMED', `${group(g.founderClaimed)} / ${group(g.founderCount)}`],
    ['FOUNDER OUTSTANDING', group(g.founderOutstanding)],
    ['RESERVED FOUNDER SLOTS', group(g.reservedFounderSlots)],
    ['MAX SUPPLY', group(g.maxSupply)],
    ['OG BURNED BY THE CLUB', s.act ? `${og(s.act.burned, 0)} OG` : loading('8ch')],
    ['OG/ETH SPOT', s.ethPerOg ? `1 ETH ≈ ${fmtCompact(BigInt(Math.round(1 / s.ethPerOg)) * 10n ** 18n)} OG` : s.ethPerOg === null ? 'UNAVAILABLE' : loading('8ch')],
  ];

  return `
  <div class="wrap">
    ${head}
    ${g.soldOut ? `<div class="banner banner-orange" role="status">${px('SOLD OUT')} <span>PUBLIC SUPPLY + FOUNDER PASSES + RESERVED FOUNDER SLOTS HAVE REACHED THE ${group(g.maxSupply)} CAP. BUY WOULD REVERT.</span></div>` : ''}
    ${g.buysPaused ? `<div class="banner" role="status"><b>BUYS ARE PAUSED BY THE OWNER.</b> SELLING STILL WORKS.</div>` : ''}
    ${tiles}
    <div class="card chart-card">
      <div class="chart-top">
        <span class="label">PRICE OF PASS N · priceOf(n), n = 1 → ${group(g.publicSupply + 100n)}</span>
        <span class="chart-tip" id="chart-tip" aria-live="polite">HOVER OR TAP THE CHART</span>
      </div>
      <div class="chart" id="chart">${s.curve ? chartSvg(s.curve, g, s.chartW) : `<div class="chart-loading">${loading('100%')}</div>`}</div>
      <div class="legend">
        <span><i class="sw sw-pub"></i>ISSUED</span>
        <span><i class="sw sw-next"></i>NEXT PASS</span>
        <span><i class="sw sw-future"></i>AHEAD</span>
      </div>
    </div>
    <dl class="stats">${stats.map(([k, v]) => `<div class="stat"><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
  </div>`;
}

export function chartSvg(prices, g, width = 720) {
  // Drawn at the real pixel width of its box so text and bars never stretch.
  const W = Math.max(280, Math.round(width)), H = W < 560 ? 220 : 280, L = 48, R = 8, T = 22, B = 24;
  const n = prices.length;
  const max = prices[n - 1] ?? 1n;
  const min = 0n;
  const y = (p) => T + (H - T - B) * (1 - Number(((p - min) * 10000n) / (max - min || 1n)) / 10000);
  const bw = (W - L - R) / n;
  const gap = bw > 4 ? 1 : bw > 2 ? 0.5 : 0;
  const supply = Number(g.publicSupply);
  let bars = '';
  for (let i = 0; i < n; i++) {
    const num = i + 1;
    const cls = num <= supply ? 'b-sold' : num === supply + 1 ? 'b-next' : 'b-future';
    const top = y(prices[i]);
    bars += `<rect class="${cls}" x="${(L + i * bw).toFixed(2)}" y="${top.toFixed(2)}" width="${Math.max(bw - gap, 0.4).toFixed(2)}" height="${(H - B - top).toFixed(2)}"/>`;
  }
  // y gridlines: 4 ticks
  let grid = '';
  for (let k = 0; k <= 4; k++) {
    const v = (max * BigInt(k)) / 4n;
    const yy = y(v);
    grid += `<line class="grid" x1="${L}" x2="${W - R}" y1="${yy.toFixed(1)}" y2="${yy.toFixed(1)}"/><text class="tick" x="${L - 6}" y="${(yy + 3).toFixed(1)}" text-anchor="end">${fmtCompact(v)}</text>`;
  }
  // x ticks
  const ticksFit = Math.max(2, Math.floor((W - L - R) / 70));
  const step = [10, 20, 25, 50, 100, 200, 250, 500].find((st) => n / st <= ticksFit) ?? 1000;
  let xt = '';
  for (let t = step; t <= n; t += step) {
    const xx = L + (t - 0.5) * bw;
    xt += `<text class="tick" x="${xx.toFixed(1)}" y="${H - 8}" text-anchor="middle">${t}</text>`;
  }
  xt += `<text class="tick" x="${(L + 0.5 * bw).toFixed(1)}" y="${H - 8}" text-anchor="start">1</text>`;
  // supply marker
  const mx = L + supply * bw;
  const fw = String(supply).length * 6.5 + 56;
  const fx = mx + fw + 4 > W ? mx - fw - 3 : mx + 3;
  const marker = `
    <line class="mark-line" x1="${mx.toFixed(2)}" x2="${mx.toFixed(2)}" y1="${T - 18}" y2="${H - B}"/>
    <rect class="mark-flag" x="${fx.toFixed(1)}" y="${T - 18}" width="${fw.toFixed(1)}" height="15"/>
    <text class="mark-text" x="${(fx + 5).toFixed(1)}" y="${T - 7}">SUPPLY ${supply}</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Bonding curve: price rises linearly from ${fmtCompact(prices[0])} OG for pass 1 to ${fmtCompact(max)} OG for pass ${n}. Current supply ${supply}." data-n="${n}" data-l="${L}" data-r="${R}" data-w="${W}">
    ${grid}<g>${bars}</g>${xt}${marker}<rect class="hover-col" x="0" y="${T}" width="0" height="${H - B - T}"/></svg>`;
}

// ---------------------------------------------------------------- trade
const WARN_CURVE = `
  <ul class="warns">
    <li>Early buyers can sell above what late buyers paid. Late buyers lose at least 7.5% if they sell.</li>
    <li>The buy-back price follows the public curve and goes down as other members sell.</li>
    <li>Never send OG directly to the contract. It is stuck there forever.</li>
  </ul>`;

function txBox(t) {
  if (!t) return '';
  const cls = t.err ? 'tx tx-err' : t.done ? 'tx tx-ok' : 'tx';
  return `<div class="${cls}" role="status" aria-live="polite">${t.err ? `<b>FAILED.</b> ${esc(t.err)}` : esc(t.msg ?? '')}${t.hash ? ` ${txLink(t.hash)}` : ''}</div>`;
}

function primaryButton(s, { label, act, disabled, reason }) {
  const ws = walletState(s);
  if (ws === 'disconnected') return `<button class="btn btn-wide" data-act="connect">CONNECT WALLET</button>`;
  if (ws === 'wrong-chain') return `<button class="btn btn-wide btn-orange" data-act="switch">SWITCH TO ETHEREUM</button>`;
  return `<button class="btn btn-wide" data-act="${act}" ${disabled ? 'disabled' : ''}>${esc(disabled && reason ? reason : label)}</button>`;
}

export function trade(s) {
  const g = s.g;
  const u = s.user;
  const busy = !!(s.tx.buy && !s.tx.buy.err && !s.tx.buy.done);
  let disabled = true, reason = 'LOADING…';
  if (g) {
    if (g.soldOut) reason = 'SOLD OUT';
    else if (g.buysPaused) reason = 'BUYS PAUSED';
    else if (u?.isMember) reason = 'YOU ALREADY HOLD A PASS';
    else if (u && u.ogBalance < g.buyPrice) reason = 'NOT ENOUGH OG';
    else if (!s.ack.buy) reason = 'TICK THE NOTICE TO CONTINUE';
    else if (busy) reason = 'WORKING…';
    else if (!u) reason = 'READING WALLET…';
    else disabled = false;
  }
  const label = g ? `BUY ${pad4(g.publicSupply + 1n)} FOR ${og(g.buyPrice, 0)} OG` : 'BUY';
  const approveNote = g ? `<ol class="steps">
      <li class="${stepCls(s.tx.buy, 'approve')}"><b>1</b><span>APPROVE EXACTLY ${og(g.buyPrice, 0)} OG. NEVER UNLIMITED.</span></li>
      <li class="${stepCls(s.tx.buy, 'buy')}"><b>2</b><span>BUY WITH maxPrice = QUOTE, DEADLINE 10 MIN.</span></li>
    </ol>` : '';

  const buyCard = `
    <div class="card pad card-buy">
      <div class="card-head"><h3>${px('BUY A PASS')}</h3><span class="status">${g ? `${group(g.publicSupply)} PUBLIC` : ''}</span></div>
      ${g ? `<p class="quote">${px(og(g.buyPrice, 0))} <span class="unit">OG ${eth(g.buyPrice, s)}</span></p>` : loading('12ch')}
      ${approveNote}
      ${WARN_CURVE}
      <div class="notice">
        <p class="label">BEFORE YOU BUY</p>
        <p class="disclaimer">${esc(DISCLAIMER)}</p>
        <label class="check"><input type="checkbox" data-ack="buy" ${s.ack.buy ? 'checked' : ''}><span>I have read this. A pass is a membership, not an investment.</span></label>
      </div>
      ${primaryButton(s, { label, act: 'buy', disabled, reason })}
      ${txBox(s.tx.buy)}
    </div>`;

  // Your pass (sell)
  let sellBody;
  if (!s.wallet.account) sellBody = `<p class="muted">Connect a wallet to see your pass.</p>`;
  else if (!u) sellBody = loading('100%');
  else if (!u.isMember) sellBody = `<p class="muted">No pass in this wallet.</p>`;
  else if (u.tokenId === null) sellBody = `<p class="muted">You are a member. Locating your pass in the Transfer logs…</p>`;
  else if (u.isFounderPass) sellBody = `<p>You hold founder pass <b>${pad4(u.tokenId)}</b>. Founder passes are not sold on the curve; see the <a class="lnk" href="#founders">founder buyback</a>.</p>`;
  else if (g) {
    const sBusy = !!(s.tx.sell && !s.tx.sell.err && !s.tx.sell.done);
    sellBody = `
      <p>You hold public pass <b>${pad4(u.tokenId)}</b>.</p>
      <dl class="kv">
        <div><dt>CURVE PRICE (${pad4(g.publicSupply)})</dt><dd>${og(g.lastPrice, 0)} OG</dd></div>
        <div><dt>YOU RECEIVE · 92.5%</dt><dd class="hi">${og(g.sellPrice, 0)} OG ${eth(g.sellPrice, s)}</dd></div>
        <div><dt>BURNED · 7.5%</dt><dd>${og(g.lastPrice - g.sellPrice, 0)} OG</dd></div>
      </dl>
      <p class="fine">minOut = the payout above. If the price drops before your transaction lands, it reverts instead of paying less.</p>
      <p class="warn-inline">Selling ends your membership.</p>
      ${primaryButton(s, { label: `SELL ${pad4(u.tokenId)} FOR ${og(g.sellPrice, 0)} OG`, act: 'sell', disabled: sBusy, reason: 'WORKING…' })}
      ${txBox(s.tx.sell)}`;
  } else sellBody = loading('100%');

  const sellCard = `
    <div class="card pad card-sell">
      <div class="card-head"><h3>${px('YOUR PASS')}</h3><span class="status">${u?.isMember ? (u.isFounderPass ? 'FOUNDER' : 'PUBLIC') : ''}</span></div>
      ${sellBody}
    </div>`;

  return `<div class="wrap">
    <div class="sec-head"><h2>${px('BUY / SELL')}</h2>${ext(`${EXPLORER}/token/${OG_TOKEN}`, 'OG TOKEN')}</div>
    <div class="two">${buyCard}${sellCard}</div>
  </div>`;
}

function stepCls(t, stage) {
  if (!t || t.err) return '';
  const order = ['quote', 'approve', 'moved', 'buy'];
  const cur = order.indexOf(t.stage);
  if (t.done) return 'done';
  if (t.stage === stage) return 'on';
  return order.indexOf(stage) < cur ? 'done' : '';
}

// ---------------------------------------------------------------- founders
export function founders(s) {
  const g = s.g;
  const u = s.user;
  const head = `<div class="sec-head"><h2>${px('FOUNDERS')}</h2><span class="label">${g ? `${group(g.founderClaimed)} / ${group(g.founderCount)} CLAIMED` : ''}</span></div>`;
  if (!g) return `<div class="wrap">${head}<div class="card pad">${loading('100%')}</div></div>`;

  const now = Math.floor(Date.now() / 1000);
  const open = now < Number(g.claimDeadline);
  const needed = g.founderBuyback * g.founderOutstanding;
  const funded = g.founderReserve >= g.founderBuyback;
  const coverage = g.founderBuyback > 0n ? g.founderReserve / g.founderBuyback : 0n;
  const reserveLine = `
    <dl class="kv">
      <div><dt>BUYBACK RESERVE (founderReserve)</dt><dd class="${funded ? 'hi' : 'warn-txt'}">${og(g.founderReserve, 0)} OG · ${funded ? 'FUNDED' : 'NOT FUNDED'}</dd></div>
      <div><dt>COVERS</dt><dd>${group(coverage)} BUYBACK${coverage === 1n ? '' : 'S'} OF ${og(g.founderBuyback, 0)} OG</dd></div>
      <div><dt>NEEDED FOR HELD FOUNDER PASSES</dt><dd>${og(needed, 0)} OG (${group(g.founderOutstanding)} × ${og(g.founderBuyback, 0)})</dd></div>
      <div><dt>CLAIM WINDOW</dt><dd>${open ? `CLOSES IN <span data-countdown="${g.claimDeadline}">${countdown(g.claimDeadline).text}</span>` : 'CLOSED'}</dd></div>
    </dl>`;

  // Claim card
  let claim;
  const cBusy = !!(s.tx.claim && !s.tx.claim.err && !s.tx.claim.done);
  if (s.rootOk === false) {
    claim = `<p class="err">The founder list in this site does not reproduce founderRoot() on chain, so claiming is disabled. Please report this.</p>`;
  } else if (!s.wallet.account) {
    claim = `<p class="muted">Connect a wallet to check whether your address is one of the 49 founders.</p>${primaryButton(s, {})}`;
  } else if (!u || s.rootOk === null) {
    claim = loading('100%');
  } else if (!u.onFounderList) {
    claim = `<p class="muted">${shortAddr(s.wallet.account)} is not on the founder list.</p>`;
  } else if (u.hasClaimedFounder) {
    claim = `<p>${shortAddr(s.wallet.account)} has claimed its founder pass. A founder address can claim once.</p>`;
  } else if (u.isMember) {
    claim = `<p class="warn-inline">You are on the founder list but this wallet holds a public pass. Sell it first: claiming reverts while you hold one.</p>`;
  } else if (!open) {
    claim = `<p class="muted">The 30-day founder claim window has closed.</p>`;
  } else if (g.founderClaimed >= g.founderCount) {
    claim = `<p class="muted">All founder passes have been claimed.</p>`;
  } else {
    claim = `
      <p>${shortAddr(s.wallet.account)} is on the founder list. Your Merkle proof is built in the browser from the public list and checked against founderRoot() on chain.</p>
      <p class="countdown-big">${px('CLOSES IN')}<br><span data-countdown="${g.claimDeadline}" class="cd">${countdown(g.claimDeadline).text}</span></p>
      ${primaryButton(s, { label: 'CLAIM FOUNDER PASS', act: 'claim', disabled: cBusy, reason: 'WORKING…' })}
      ${txBox(s.tx.claim)}`;
  }

  // Founder sell card (holders of a founder pass)
  let fsell = '';
  if (u?.isMember && u.isFounderPass && u.tokenId !== null) {
    const fBusy = !!(s.tx.sellFounder && !s.tx.sellFounder.err && !s.tx.sellFounder.done);
    const disabled = !funded || !s.ack.sellFounder || fBusy;
    const reason = !funded ? 'BUYBACK RESERVE NOT FUNDED YET' : !s.ack.sellFounder ? 'TICK THE WARNING TO CONTINUE' : 'WORKING…';
    fsell = `
      <div class="card pad card-danger">
        <div class="card-head"><h3>${px('FOUNDER BUYBACK')}</h3><span class="status">${pad4(u.tokenId)}</span></div>
        <p>sellFounder pays a fixed <b>${og(g.founderBuyback, 0)} OG</b> from the founder reserve.</p>
        <p class="danger"><b>WARNING:</b> you lose membership and can never claim again.</p>
        <p class="fine">Reserve right now: ${og(g.founderReserve, 0)} OG (${funded ? 'funded' : 'not funded'}), read from chain.</p>
        <label class="check"><input type="checkbox" data-ack="sellFounder" ${s.ack.sellFounder ? 'checked' : ''}><span>I understand I lose membership and can never claim again.</span></label>
        ${primaryButton(s, { label: `SELL ${pad4(u.tokenId)} FOR ${og(g.founderBuyback, 0)} OG`, act: 'sellFounder', disabled, reason })}
        ${txBox(s.tx.sellFounder)}
      </div>`;
  }

  return `<div class="wrap">
    ${head}
    <div class="two">
      <div class="card pad">
        <div class="card-head"><h3>${px('CLAIM')}</h3><span class="status">${open ? 'OPEN' : 'CLOSED'}</span></div>
        ${claim}
        <ul class="warns">
          <li>A founder who already holds a public pass must sell it before claiming. Claim reverts otherwise.</li>
          <li>After the claim deadline, any founder buyback reserve not needed for held founder passes can be burned by anyone.</li>
          <li>Never send OG directly to the contract. It is stuck there forever.</li>
        </ul>
      </div>
      <div class="card pad">
        <div class="card-head"><h3>${px('RESERVE')}</h3><span class="status ${funded ? '' : 'warn-txt'}">${funded ? 'FUNDED' : 'NOT FUNDED'}</span></div>
        ${reserveLine}
      </div>
    </div>
    ${fsell}
  </div>`;
}

// ---------------------------------------------------------------- members
// Nothing about the member area is settled yet, so it is the same notice for
// everyone, member or not.
export function members() {
  return `<div class="wrap">
    <div class="sec-head"><h2>${px('MEMBERS')}</h2><span class="label">UNDER CONSTRUCTION</span></div>
    <div class="card construction">
      <div class="hazard" aria-hidden="true"></div>
      <div class="pad">
        <p class="construction-title">${px('UNDER CONSTRUCTION', { cls: 'px-orange' })}</p>
        <p class="muted">Nothing is settled yet. This part of the club will open later.</p>
      </div>
    </div>
  </div>`;
}

// ---------------------------------------------------------------- ledger
export function ledger(s) {
  const head = `<div class="sec-head"><h2>${px('THE LEDGER')}</h2><span class="label">LAST 20 BUYS &amp; SELLS</span></div>`;
  if (!s.act) return `<div class="wrap">${head}<div class="card pad">${s.actErr ? `<p class="err">${esc(s.actErr)}</p>` : `<p class="muted">Scanning logs from block ${'26,171,777'}…</p>`}</div></div>`;
  const rows = s.act.recent;
  if (!rows.length) return `<div class="wrap">${head}<div class="card pad"><p class="muted">No buys or sells yet.</p></div></div>`;
  const when = (b) => ago(Number(s.act.latestBlock - b) * 12 + 1);
  const body = rows.map((r) => `
    <tr>
      <td><span class="tag ${r.type === 'Buy' ? 'tag-buy' : 'tag-sell'}">${r.type.toUpperCase()}</span></td>
      <td class="num">${pad4(r.tokenId)}</td>
      <td>${addrLink(r.who)}</td>
      <td class="num">${og(r.price, 0)}</td>
      <td class="num col-x">${r.type === 'Sell' ? `${og(r.payout, 0)} / <span class="burn">${og(r.burned, 0)}</span>` : '—'}</td>
      <td class="num col-when"><a class="mono-link" href="${EXPLORER}/tx/${r.txHash}" target="_blank" rel="noopener noreferrer" title="Block ${r.blockNumber}">~${when(r.blockNumber)}</a></td>
    </tr>`).join('');
  return `<div class="wrap">${head}
    <div class="card table-card">
      <table class="ledger">
        <thead><tr><th>EVENT</th><th class="num">PASS</th><th>WALLET</th><th class="num">PRICE OG</th><th class="num col-x">PAID / BURNED</th><th class="num col-when">WHEN</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
    <p class="fine">Read from OGPass logs since block 26,171,777. Times are estimated from block height.</p>
  </div>`;
}

// ---------------------------------------------------------------- footer
export function footer() {
  return `<div class="wrap">
    <hr class="rule-orange">
    <p class="disclaimer foot-disc">${esc(DISCLAIMER)}</p>
    <div class="foot-grid">
      <div><span class="label">OGPASS</span>${ext(`${EXPLORER}/address/${OGPASS_ADDRESS}`, shortAddr(OGPASS_ADDRESS))}</div>
      <div><span class="label">OG TOKEN</span>${ext(`${EXPLORER}/token/${OG_TOKEN}`, shortAddr(OG_TOKEN))}</div>
      <div><span class="label">SWARM</span>${ext(SWARM_MAP_URL, 'SWARM MAP')}</div>
    </div>
    <p class="fine">Static site. No analytics, no trackers, no cookies. Every number is read live from Ethereum through public RPCs.</p>
    <p class="foot-mark">${px('OG CLUB.', { accentLast: true })}</p>
  </div>`;
}
