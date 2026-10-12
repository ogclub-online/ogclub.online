# ogclub.online

Static site for **OGPass** (`0xca9dC9064ffc695d979Ea7DA9A35130376BB3217`), the OG Club membership pass on Ethereum mainnet. Vite + viem, no framework, no analytics, no trackers, no cookies, no font requests, no secrets in the bundle.

The look follows the Swarm Pepe site (navy grid, lime pixel type, orange accents, typewriter labels) with gold for club and founder touches. Headings and big numbers are drawn by a built-in 5×7 pixel font as SVG, so nothing is fetched from a font CDN.

## Run

```bash
npm install
npm run verify:root   # founder list -> founderRoot check (must print MATCH)
npm run dev           # local dev server
npm run build         # static output in dist/
npm run check:bundle  # fails if dist/ contains trackers or secret-shaped strings
```

`dist/` is fully static, with relative asset paths (`base: './'`), so it works on an IPFS gateway and on the custom domain. The build also writes the deployment handoff back to `dist/imd-deployment.json`.

## Deployment handoff

The address, deploy block and ABI are read at build time from the deployment handoff, in this order:

1. `$IMD_DEPLOYMENT` (a path)
2. `dist/imd-deployment.json` (the IMD pipeline location; read before Vite empties `dist/`)
3. `deployment/imd-deployment.json` (checked-in copy, built from the Etherscan-verified source)

The build **fails** if the handoff address is not `0xca9d…3217`, or if any function or event the site uses is missing from the ABI. Names are used exactly as in `src/OGPass.sol` (for example `curveReserve`, `reservedFounderSlots`, `claimFounder`, `sellFounder`). Every log scan starts at the deploy block, **26171777**.

## What the site does

| Area | Behaviour |
|---|---|
| Header | EIP-6963 wallet discovery (legacy `window.ethereum` only if nothing announces), mainnet guard with a switch button, short address, OG balance, and a FOUNDER/PUBLIC badge from `isMember(address)`, then the tokenId from ERC-721 `Transfer` logs (minted to the address, not later burned), confirmed with `ownerOf`, then `isFounder(tokenId)`. |
| Curve | `priceOf(n)` for n = 1 … `publicSupply + 100` read on chain through Multicall3 and cached (it is `pure`), with a marker at current supply and hover/tap readout. Shows live `currentBuyPrice` / `currentSellPrice` in OG with an ETH estimate from the Uniswap v4 OG/ETH pool (`PoolManager.extsload`; hidden if unavailable), plus `curveReserve`, `publicSupply`, `founderClaimed`, `founderOutstanding`, `reservedFounderSlots()`, `MAX_SUPPLY`, OG burned (Σ `Sell.burned` + Σ `ReserveBurned.amount`) and the last 20 `Buy`/`Sell` events. Shows **SOLD OUT** when `publicSupply + founderOutstanding + reservedFounderSlots >= MAX_SUPPLY` (buy would revert `SupplyCapReached`). |
| Buy | Quote `currentBuyPrice`, approve **exactly** that amount (never unlimited; a different existing allowance is reset to the quote), re-read the price, re-quote and re-approve if it moved, then `buy(maxPrice = quote, deadline = now + 10 min)`. Disabled when `buysPaused`, sold out, already a member, or OG balance too low. The disclaimer must be ticked first. |
| Sell | PUBLIC holders: curve price, payout 92.5%, burn 7.5%, then `sell(tokenId, minOut = payout, deadline)`. |
| Founder claim | Tree built with `StandardMerkleTree.of(addrs.map(a => [a]), ['address'])`. If `tree.root != founderRoot()`, Claim is hidden and an error is shown. Claim is hidden if `hasClaimedFounder(address)` or `isMember`; otherwise it is shown with a live countdown to `claimDeadline`. |
| Founder buyback | `sellFounder(tokenId)`: fixed 100,000 OG, disabled with "buyback reserve not funded yet" while `founderReserve < FOUNDER_BUYBACK`. Shows the warning "you lose membership and can never claim again" (must be ticked) and the live `founderReserve`. |
| Members | Under construction. The section shows a notice and no member content yet. |
| Warnings | Shown near Buy and Claim: early vs late buyers, the 7.5% loss, the founder must-sell-public-first rule, the burnable reserve after the deadline, and never sending OG directly to the contract. The reserve status is always read from chain, never hardcoded. |

RPCs: `mainnet.gateway.tenderly.co`, `rpc.mevblocker.io`, `eth.drpc.org` through viem `fallback`. Each retries with exponential backoff on 429/5xx (400 ms → 3.2 s), and concurrent reads are batched into Multicall3. Log scans are incremental, in 5,000-block windows that halve when an RPC rejects a range. The page polls every 20 s and pauses while the tab is hidden.

## Configuration

See `.env.example`. Every `VITE_*` value ends up in the public bundle, so never put secrets there. `VITE_OWNER_NAME` puts a name in the owner disclosure of the built site; keep it in an untracked `.env` so it stays out of the repo.

## Layout

```
deployment/imd-deployment.json   handoff copy (address, deploy block, verified ABI)
src/config.js                    addresses, RPCs, endpoints, disclaimer text
src/founders.js                  the 49 founder addresses
src/chain/                       everything that talks to Ethereum (viem)
  client.js  reads.js  logs.js  merkle.js  wallet.js  actions.js  index.js
src/ui/render.js                 state -> HTML (no chain access)
src/app.js                       state, polling, events
src/lib/pixel.js                 5x7 pixel font + pass emblem
src/lib/format.js                number/time formatting
scripts/                         verify-root, check-bundle
```

## Disclaimer

OG Club passes are non-transferable membership passes that give access to a community, content and tools only. They are not an investment, and there is no promise of profit or of any price. The buy-back price follows a fixed public formula and can go down; 7.5% of every sale is burned. The contract owner is also the largest OG holder. Smart contracts can have bugs; only use OG you can afford to lose. Not available where prohibited.
