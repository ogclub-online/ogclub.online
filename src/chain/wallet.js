import { createWalletClient, custom, getAddress } from 'viem';
import { mainnet } from 'viem/chains';
import { CHAIN_ID } from '../config.js';

// EIP-6963 multi-injected-provider discovery. Wallets announce themselves;
// the user picks one. A legacy window.ethereum is offered only when nothing
// announces itself.
const providers = new Map(); // rdns -> { info, provider }
const listeners = new Set();
const LAST = 'ogclub.wallet';

let active = null; // { info, provider }
let walletClient = null;
let account = null;
let chainId = null;

function emit() {
  const snapshot = { account, chainId, providers: list(), walletName: active?.info?.name ?? null };
  listeners.forEach((fn) => fn(snapshot));
}

export function list() {
  const out = [...providers.values()].map(({ info }) => info);
  if (!out.length && typeof window !== 'undefined' && window.ethereum) {
    out.push({ uuid: 'legacy', rdns: 'legacy.injected', name: 'Browser wallet', icon: '' });
  }
  return out;
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function discover() {
  window.addEventListener('eip6963:announceProvider', (event) => {
    const { info, provider } = event.detail ?? {};
    if (!info?.rdns || !provider) return;
    providers.set(info.rdns, { info, provider });
    emit();
  });
  window.dispatchEvent(new Event('eip6963:requestProvider'));
  // Silent reconnect: only if the user connected this wallet before, and only
  // via eth_accounts (never prompts).
  setTimeout(async () => {
    let last = null;
    try { last = localStorage.getItem(LAST); } catch { /* storage blocked */ }
    if (!last) return emit();
    const entry = resolve(last);
    if (!entry) return emit();
    try {
      const accts = await entry.provider.request({ method: 'eth_accounts' });
      if (accts?.length) await attach(entry, accts);
      else emit();
    } catch { emit(); }
  }, 400);
}

function resolve(rdns) {
  if (rdns === 'legacy.injected') return window.ethereum ? { info: list()[0], provider: window.ethereum } : null;
  return providers.get(rdns) ?? null;
}

async function attach(entry, accts) {
  if (active?.provider && active.provider !== entry.provider) detachListeners(active.provider);
  active = entry;
  account = getAddress(accts[0]);
  chainId = Number(await entry.provider.request({ method: 'eth_chainId' }));
  walletClient = createWalletClient({ chain: mainnet, transport: custom(entry.provider) });
  entry.provider.on?.('accountsChanged', onAccounts);
  entry.provider.on?.('chainChanged', onChain);
  entry.provider.on?.('disconnect', onDisconnect);
  try { localStorage.setItem(LAST, entry.info.rdns); } catch { /* ignore */ }
  emit();
}

function detachListeners(p) {
  p.removeListener?.('accountsChanged', onAccounts);
  p.removeListener?.('chainChanged', onChain);
  p.removeListener?.('disconnect', onDisconnect);
}

function onAccounts(accts) {
  if (!accts?.length) return disconnect();
  account = getAddress(accts[0]);
  emit();
}
function onChain(id) { chainId = Number(id); emit(); }
function onDisconnect() { disconnect(); }

export async function connect(rdns) {
  const entry = resolve(rdns);
  if (!entry) throw new Error('Wallet not found.');
  const accts = await entry.provider.request({ method: 'eth_requestAccounts' });
  await attach(entry, accts);
}

export function disconnect() {
  if (active?.provider) detachListeners(active.provider);
  active = null; walletClient = null; account = null; chainId = null;
  try { localStorage.removeItem(LAST); } catch { /* ignore */ }
  emit();
}

export async function switchToMainnet() {
  if (!active) return;
  await active.provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x1' }] });
}

/** Wallet client, guaranteed connected and on mainnet. */
export function requireWallet() {
  if (!walletClient || !account) throw new Error('Connect a wallet first.');
  if (chainId !== CHAIN_ID) throw new Error('Switch your wallet to Ethereum mainnet.');
  return { walletClient, account };
}

export const getAccount = () => account;
export const getChainId = () => chainId;
