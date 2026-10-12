import { erc20Abi, encodeAbiParameters, hexToBigInt, keccak256 } from 'viem';
import { publicClient } from './client.js';
import {
  OGPASS_ADDRESS as PASS, OGPASS_ABI as ABI, OG_TOKEN,
  UNISWAP_V4_POOL_MANAGER, OG_ETH_POOL_ID,
} from '../config.js';

const read = (functionName, args) => publicClient.readContract({ address: PASS, abi: ABI, functionName, args });

let constants = null;

/** Immutable values: read once. */
async function loadConstants() {
  if (constants) return constants;
  const [maxSupply, founderBuyback, sellBps, bps, founderCount, founderRoot, claimDeadline, decimals, symbol] = await Promise.all([
    read('MAX_SUPPLY'), read('FOUNDER_BUYBACK'), read('SELL_BPS'), read('BPS'),
    read('founderCount'), read('founderRoot'), read('claimDeadline'),
    publicClient.readContract({ address: OG_TOKEN, abi: erc20Abi, functionName: 'decimals' }),
    publicClient.readContract({ address: OG_TOKEN, abi: erc20Abi, functionName: 'symbol' }),
  ]);
  constants = { maxSupply, founderBuyback, sellBps, bps, founderCount, founderRoot, claimDeadline, ogDecimals: decimals, ogSymbol: symbol };
  return constants;
}

/** Everything the public pages show, read at one block. */
export async function loadGlobal() {
  const c = await loadConstants();
  const blockNumber = await publicClient.getBlockNumber({ cacheTime: 0 });
  const at = { blockNumber };
  const r = (fn) => publicClient.readContract({ address: PASS, abi: ABI, functionName: fn, ...at });
  const [publicSupply, founderClaimed, founderOutstanding, reservedFounderSlots, curveReserve, founderReserve, buyPrice, sellPrice, buysPaused, ogHeld] =
    await Promise.all([
      r('publicSupply'), r('founderClaimed'), r('founderOutstanding'), r('reservedFounderSlots'),
      r('curveReserve'), r('founderReserve'), r('currentBuyPrice'), r('currentSellPrice'), r('buysPaused'),
      publicClient.readContract({ address: OG_TOKEN, abi: erc20Abi, functionName: 'balanceOf', args: [PASS], ...at }),
    ]);
  // Price of the most recently issued public pass (what a seller is paid against).
  const lastPrice = publicSupply > 0n ? await publicClient.readContract({ address: PASS, abi: ABI, functionName: 'priceOf', args: [publicSupply], ...at }) : 0n;
  const soldOut = publicSupply + founderOutstanding + reservedFounderSlots >= c.maxSupply;
  return {
    ...c, blockNumber, publicSupply, founderClaimed, founderOutstanding, reservedFounderSlots,
    curveReserve, founderReserve, buyPrice, sellPrice, lastPrice, buysPaused, ogHeld, soldOut,
  };
}

// priceOf is pure, so values never change: cache them by n.
const priceCache = new Map();

/** priceOf(n) for n = 1..maxN, read on chain (batched through Multicall3). */
export async function loadCurve(maxN) {
  const missing = [];
  for (let n = 1; n <= maxN; n++) if (!priceCache.has(n)) missing.push(n);
  for (let i = 0; i < missing.length; i += 250) {
    const chunk = missing.slice(i, i + 250);
    const res = await publicClient.multicall({
      allowFailure: false,
      contracts: chunk.map((n) => ({ address: PASS, abi: ABI, functionName: 'priceOf', args: [BigInt(n)] })),
    });
    chunk.forEach((n, j) => priceCache.set(n, res[j]));
  }
  return Array.from({ length: maxN }, (_, i) => priceCache.get(i + 1));
}

/** Per-wallet reads. */
export async function loadUserReads(address) {
  const [ogBalance, allowance, isMember, hasClaimedFounder] = await Promise.all([
    publicClient.readContract({ address: OG_TOKEN, abi: erc20Abi, functionName: 'balanceOf', args: [address] }),
    publicClient.readContract({ address: OG_TOKEN, abi: erc20Abi, functionName: 'allowance', args: [address, PASS] }),
    read('isMember', [address]),
    read('hasClaimedFounder', [address]),
  ]);
  return { ogBalance, allowance, isMember, hasClaimedFounder };
}

export async function readIsFounder(tokenId) {
  return read('isFounder', [tokenId]);
}

export async function readOwnerOf(tokenId) {
  try { return await read('ownerOf', [tokenId]); } catch { return null; }
}

/**
 * OG/ETH spot from the Uniswap v4 pool via PoolManager.extsload.
 * Pool state lives at keccak256(abi.encode(poolId, POOLS_SLOT = 6)); its first
 * word packs slot0 with sqrtPriceX96 in the low 160 bits. currency0 is native
 * ETH (address 0) and currency1 is OG, so price(OG per ETH) = (sqrtP / 2^96)^2.
 * Returns ETH per 1 OG as a float, or null when unavailable.
 */
export async function loadEthPerOg() {
  try {
    const slot = keccak256(encodeAbiParameters([{ type: 'bytes32' }, { type: 'uint256' }], [OG_ETH_POOL_ID, 6n]));
    const word = await publicClient.readContract({
      address: UNISWAP_V4_POOL_MANAGER,
      abi: [{ type: 'function', name: 'extsload', stateMutability: 'view', inputs: [{ name: 'slot', type: 'bytes32' }], outputs: [{ type: 'bytes32' }] }],
      functionName: 'extsload',
      args: [slot],
    });
    const sqrtP = hexToBigInt(word) & ((1n << 160n) - 1n);
    if (sqrtP === 0n) return null; // pool not initialized
    // ETH per OG = 2^192 / sqrtP^2 ; compute with 1e18 fixed point to keep precision.
    const ethPerOgWad = ((1n << 192n) * 10n ** 18n) / (sqrtP * sqrtP);
    const v = Number(ethPerOgWad) / 1e18;
    return Number.isFinite(v) && v > 0 && v < 1 ? v : null;
  } catch {
    return null;
  }
}
