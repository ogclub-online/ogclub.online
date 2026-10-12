// Checks that the 49 founder addresses rebuild the founderRoot the contract
// was deployed with. Run: npm run verify:root
import { StandardMerkleTree } from '@openzeppelin/merkle-tree';
import { readFileSync } from 'node:fs';
import { FOUNDERS } from '../src/founders.js';

const handoff = JSON.parse(readFileSync(new URL('../deployment/imd-deployment.json', import.meta.url), 'utf8'));
const expected = handoff.constructorArgs?.founderRoot_;
const tree = StandardMerkleTree.of(FOUNDERS.map((a) => [a]), ['address']);

console.log('founders:', FOUNDERS.length);
console.log('computed root:', tree.root);
console.log('deployed root:', expected);
if (tree.root.toLowerCase() !== String(expected).toLowerCase()) {
  console.error('MISMATCH: the claim UI will hide itself.');
  process.exit(1);
}
console.log('MATCH');
