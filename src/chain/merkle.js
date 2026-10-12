import { FOUNDERS } from '../founders.js';

// The tree library is loaded lazily: if it ever fails to load, only the claim
// feature is disabled (rootMatches -> false) instead of the whole site.
let treePromise = null;

export function founderTree() {
  treePromise ??= import('@openzeppelin/merkle-tree').then(({ StandardMerkleTree }) =>
    StandardMerkleTree.of(FOUNDERS.map((a) => [a]), ['address']),
  );
  return treePromise;
}

/** True only when the locally built tree reproduces founderRoot() on chain. */
export async function rootMatches(onchainRoot) {
  try {
    const tree = await founderTree();
    return tree.root.toLowerCase() === String(onchainRoot).toLowerCase();
  } catch (err) {
    console.error('Founder tree unavailable', err);
    return false;
  }
}

export function isFounderAddress(address) {
  const a = address.toLowerCase();
  return FOUNDERS.some((f) => f.toLowerCase() === a);
}

export async function proofFor(address) {
  const tree = await founderTree();
  const a = address.toLowerCase();
  for (const [i, v] of tree.entries()) {
    if (String(v[0]).toLowerCase() === a) return tree.getProof(i);
  }
  return null;
}
