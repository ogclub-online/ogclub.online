import { createPublicClient, fallback, http } from 'viem';
import { mainnet } from 'viem/chains';
import { RPC_URLS } from '../config.js';

// Public read client. Each RPC retries with exponential backoff (viem retries
// HTTP 429/5xx), and `fallback` moves on to the next RPC when one keeps failing.
// Concurrent eth_calls are aggregated through Multicall3 to stay well under
// public rate limits.
export const publicClient = createPublicClient({
  chain: mainnet,
  batch: { multicall: { batchSize: 4096, wait: 16 } },
  transport: fallback(
    RPC_URLS.map((url) =>
      http(url, {
        retryCount: 4,
        retryDelay: 400, // 400ms, 800ms, 1.6s, 3.2s
        timeout: 20_000,
      }),
    ),
    { rank: false, retryCount: 2, retryDelay: 600 },
  ),
});
