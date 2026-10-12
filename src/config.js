/* global __DEPLOYMENT__ */
// Everything the site needs to know about the chain. No secrets live here:
// the whole bundle is public.

// Injected at build time from the deployment handoff (see vite.config.js).
export const DEPLOYMENT = __DEPLOYMENT__;

export const CHAIN_ID = 1;
export const OGPASS_ADDRESS = DEPLOYMENT.address;
export const OGPASS_ABI = DEPLOYMENT.abi;
// Every log scan starts at the deploy block.
export const DEPLOY_BLOCK = BigInt(DEPLOYMENT.deployBlock);

export const OG_TOKEN = '0xCe7EB1Ad9e2E1c784ea05F7eA4A0Fe625923D10A';

const env = import.meta.env ?? {};
const csv = (v) => (v ? String(v).split(',').map((s) => s.trim()).filter(Boolean) : null);

// Public RPCs, tried in order with fallback and exponential backoff on 429.
export const RPC_URLS = csv(env.VITE_RPC_URLS) ?? [
  'https://mainnet.gateway.tenderly.co',
  'https://rpc.mevblocker.io',
  'https://eth.drpc.org',
];

// Uniswap v4 OG/ETH spot price (read with PoolManager.extsload).
// If the read fails or looks wrong, ETH estimates are hidden.
export const UNISWAP_V4_POOL_MANAGER = '0x000000000004444c5dc75cB358380D2e3dE08A90';
export const OG_ETH_POOL_ID = env.VITE_OG_ETH_POOL_ID ?? '0x5f95e64cf8e8f4e4376c1d97b5959dc479abf7b191ba0b286faeb2ec4180a2f9';

export const SWARM_MAP_URL = 'https://og-swarm-map.sites.imd.fun/';

export const BUY_DEADLINE_SECONDS = 10 * 60;
export const POLL_MS = 20_000;
export const EXPLORER = 'https://etherscan.io';

// The owner disclosure is always shown. A name, if wanted on the live site,
// comes from VITE_OWNER_NAME at build time (untracked .env), never from git.
const OWNER_NAME = (env.VITE_OWNER_NAME ?? '').trim();
const OWNER_LINE = OWNER_NAME
  ? `${OWNER_NAME} is the largest OG holder and the contract owner.`
  : 'The contract owner is also the largest OG holder.';

export const DISCLAIMER =
  'OG Club passes are non-transferable membership passes that give access to a community, content and tools only. They are not an investment, and there is no promise of profit or of any price. The buy-back price follows a fixed public formula and can go down; 7.5% of every sale is burned. ' +
  OWNER_LINE +
  ' Smart contracts can have bugs; only use OG you can afford to lose. Not available where prohibited.';
