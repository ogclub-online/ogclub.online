import { parseEventLogs, zeroAddress, isAddressEqual } from 'viem';
import { publicClient } from './client.js';
import { OGPASS_ADDRESS as PASS, OGPASS_ABI as ABI, DEPLOY_BLOCK } from '../config.js';

// One incremental scan of every OGPass log since the deploy block. All
// features (recent activity, OG burned, a holder's tokenId) are derived from it,
// so each refresh only asks the RPC for blocks it has not seen yet.
const state = { logs: [], scannedTo: DEPLOY_BLOCK - 1n, scanning: null };
let span = 5000n; // adapts down when an RPC rejects a wide range

async function getLogsRange(fromBlock, toBlock) {
  try {
    return await publicClient.getLogs({ address: PASS, fromBlock, toBlock });
  } catch (err) {
    if (toBlock - fromBlock < 50n) throw err;
    const mid = fromBlock + (toBlock - fromBlock) / 2n;
    span = (toBlock - fromBlock) / 2n || 50n;
    return [...(await getLogsRange(fromBlock, mid)), ...(await getLogsRange(mid + 1n, toBlock))];
  }
}

export function scanLogs(latest) {
  if (state.scanning) return state.scanning;
  state.scanning = (async () => {
    try {
      while (state.scannedTo < latest) {
        const from = state.scannedTo + 1n;
        const to = from + span - 1n > latest ? latest : from + span - 1n;
        const raw = await getLogsRange(from, to);
        const parsed = parseEventLogs({ abi: ABI, logs: raw, strict: false });
        state.logs.push(...parsed);
        state.scannedTo = to;
      }
      return state.logs;
    } finally {
      state.scanning = null;
    }
  })();
  return state.scanning;
}

const order = (a, b) => (a.blockNumber === b.blockNumber ? a.logIndex - b.logIndex : a.blockNumber < b.blockNumber ? -1 : 1);

/** Last N Buy/Sell events, newest first, plus OG burned by the club. */
export function summarize(logs, n = 20) {
  const trades = logs.filter((l) => l.eventName === 'Buy' || l.eventName === 'Sell').sort(order).reverse().slice(0, n);
  let burned = 0n;
  for (const l of logs) {
    if (l.eventName === 'Sell') burned += l.args.burned ?? 0n;
    if (l.eventName === 'ReserveBurned') burned += l.args.amount ?? 0n;
  }
  return {
    burned,
    recent: trades.map((l) => ({
      type: l.eventName,
      who: l.eventName === 'Buy' ? l.args.buyer : l.args.seller,
      tokenId: l.args.tokenId,
      price: l.args.price,
      payout: l.args.payout,
      burned: l.args.burned,
      blockNumber: l.blockNumber,
      txHash: l.transactionHash,
    })),
  };
}

/**
 * The contract is not enumerable: find the holder's pass from ERC-721 Transfer
 * logs. A pass counts if it was minted to the address (from = 0x0) and not
 * later burned (to = 0x0). Passes are soulbound, so there are no other moves.
 */
export function findHeldTokenIds(logs, address) {
  const held = new Set();
  for (const l of [...logs].sort(order)) {
    if (l.eventName !== 'Transfer') continue;
    const { from, to, tokenId } = l.args;
    if (isAddressEqual(from, zeroAddress) && isAddressEqual(to, address)) held.add(tokenId);
    if (isAddressEqual(to, zeroAddress) && isAddressEqual(from, address)) held.delete(tokenId);
  }
  return [...held];
}
