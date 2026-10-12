import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError, erc20Abi } from 'viem';
import { publicClient } from './client.js';
import { requireWallet } from './wallet.js';
import { proofFor } from './merkle.js';
import {
  OGPASS_ADDRESS as PASS, OGPASS_ABI as ABI, OG_TOKEN, CHAIN_ID,
  BUY_DEADLINE_SECONDS,
} from '../config.js';

const readPass = (functionName, args) => publicClient.readContract({ address: PASS, abi: ABI, functionName, args });
const deadline = () => BigInt(Math.floor(Date.now() / 1000) + BUY_DEADLINE_SECONDS);

async function send(account, walletClient, call) {
  const { request } = await publicClient.simulateContract({ account, ...call });
  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error('Transaction reverted.');
  return hash;
}

async function approveExact(account, walletClient, amount) {
  return send(account, walletClient, { address: OG_TOKEN, abi: erc20Abi, functionName: 'approve', args: [PASS, amount] });
}

/**
 * Buy: quote currentBuyPrice, approve exactly that amount (never unlimited),
 * then buy(maxPrice = quote, deadline = now + 10 min). If the price moved
 * between approve and buy, re-quote and re-approve.
 */
export async function buy(step) {
  const { walletClient, account } = requireWallet();
  for (let attempt = 0; attempt < 3; attempt++) {
    step({ stage: 'quote', attempt });
    const quote = await readPass('currentBuyPrice');
    const balance = await publicClient.readContract({ address: OG_TOKEN, abi: erc20Abi, functionName: 'balanceOf', args: [account] });
    if (balance < quote) throw new Error('Not enough OG in this wallet for the current price.');

    const allowance = await publicClient.readContract({ address: OG_TOKEN, abi: erc20Abi, functionName: 'allowance', args: [account, PASS] });
    if (allowance !== quote) {
      step({ stage: 'approve', quote });
      await approveExact(account, walletClient, quote);
    }

    const now = await readPass('currentBuyPrice');
    if (now !== quote) { step({ stage: 'moved', from: quote, to: now }); continue; }

    step({ stage: 'buy', quote });
    const hash = await send(account, walletClient, { address: PASS, abi: ABI, functionName: 'buy', args: [quote, deadline()] });
    return { hash, quote };
  }
  throw new Error('The price kept moving. Try again in a moment.');
}

/** Sell a PUBLIC pass: minOut = the quoted payout (92.5%). */
export async function sell(tokenId, step) {
  const { walletClient, account } = requireWallet();
  step({ stage: 'quote' });
  const payout = await readPass('currentSellPrice');
  step({ stage: 'sell', payout });
  const hash = await send(account, walletClient, { address: PASS, abi: ABI, functionName: 'sell', args: [tokenId, payout, deadline()] });
  return { hash, payout };
}

export async function claimFounder(step) {
  const { walletClient, account } = requireWallet();
  const proof = await proofFor(account);
  if (!proof) throw new Error('This address is not on the founder list.');
  step({ stage: 'claim' });
  const hash = await send(account, walletClient, { address: PASS, abi: ABI, functionName: 'claimFounder', args: [proof] });
  return { hash };
}

export async function sellFounder(tokenId, step) {
  const { walletClient, account } = requireWallet();
  step({ stage: 'sellFounder' });
  const hash = await send(account, walletClient, { address: PASS, abi: ABI, functionName: 'sellFounder', args: [tokenId] });
  return { hash };
}

// Friendly text for the contract's custom errors.
const REASONS = {
  AlreadyMember: 'This wallet already holds a pass.',
  AlreadyClaimed: 'This address has already claimed its founder pass.',
  BuysPaused: 'Buying is paused right now.',
  ClaimClosed: 'The founder claim window has closed.',
  Expired: 'The transaction deadline passed. Try again.',
  FounderCapReached: 'All founder passes have been claimed.',
  InsufficientFounderReserve: 'The founder buyback reserve is not funded yet.',
  InvalidProof: 'Founder proof rejected. This address is not on the founder list.',
  NotFounderPass: 'That pass is not a founder pass.',
  NotPublicPass: 'Founder passes use the founder buyback, not the curve.',
  NotTokenOwner: 'This wallet does not own that pass.',
  PayoutBelowMin: 'The payout moved below your quote. Refresh and try again.',
  PriceAboveMax: 'The price moved above your quote. Refresh and try again.',
  SupplyCapReached: 'Sold out: the 1,000 pass cap is reached.',
  Soulbound: 'Passes are non-transferable.',
  SafeERC20FailedOperation: 'The OG transfer failed. Check balance and approval.',
};

export function describeError(err) {
  if (err instanceof BaseError) {
    if (err.walk((e) => e instanceof UserRejectedRequestError)) return 'You rejected the request in your wallet.';
    const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
    const name = revert?.data?.errorName;
    if (name) return REASONS[name] ?? `Reverted: ${name}`;
    if (/insufficient funds/i.test(err.message)) return 'Not enough ETH for gas.';
    return err.shortMessage ?? err.message;
  }
  if (err?.code === 4001) return 'You rejected the request in your wallet.';
  return err?.message ?? String(err);
}
