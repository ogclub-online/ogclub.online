import { defineConfig } from 'vite';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Deployment handoff
// The address, deploy block and ABI come from the deployment handoff
// (dist/imd-deployment.json in the IMD pipeline). Vite empties dist/ when it
// builds, so the handoff is read here, at config load, before that happens,
// and it is re-emitted into the build output so it is never lost.
// Lookup order: $IMD_DEPLOYMENT, dist/imd-deployment.json,
// deployment/imd-deployment.json (checked-in copy).
// ---------------------------------------------------------------------------
const EXPECTED_ADDRESS = '0xca9dc9064ffc695d979ea7da9a35130376bb3217';
const EXPECTED_DEPLOY_BLOCK = 26171777;

const REQUIRED = {
  function: [
    'buy', 'sell', 'claimFounder', 'sellFounder', 'priceOf', 'currentBuyPrice', 'currentSellPrice',
    'curveReserve', 'publicSupply', 'founderClaimed', 'founderOutstanding', 'reservedFounderSlots',
    'MAX_SUPPLY', 'isMember', 'isFounder', 'hasClaimedFounder', 'founderRoot', 'founderCount',
    'claimDeadline', 'founderReserve', 'FOUNDER_BUYBACK', 'buysPaused', 'SELL_BPS', 'BPS', 'OG',
  ],
  event: ['Buy', 'Sell', 'ReserveBurned', 'Transfer', 'Claim', 'FounderSell'],
};

function loadHandoff() {
  const candidates = [
    process.env.IMD_DEPLOYMENT,
    resolve(ROOT, 'dist/imd-deployment.json'),
    resolve(ROOT, 'deployment/imd-deployment.json'),
  ].filter(Boolean);
  const path = candidates.find((p) => existsSync(p));
  if (!path) throw new Error('No deployment handoff found (imd-deployment.json).');
  const raw = JSON.parse(readFileSync(path, 'utf8'));

  // Accept a few common handoff shapes.
  const node = raw.OGPass ?? raw.contracts?.OGPass ?? raw.deployments?.OGPass ?? raw;
  const address = node.address ?? raw.address;
  const abi = node.abi ?? raw.abi;
  const deployBlock = Number(
    node.deployBlock ?? node.blockNumber ?? node.block ?? node.deployedBlock ?? node.receipt?.blockNumber ?? raw.deployBlock ?? EXPECTED_DEPLOY_BLOCK,
  );

  if (!address || !Array.isArray(abi)) throw new Error(`Handoff ${path} has no address/abi.`);
  if (address.toLowerCase() !== EXPECTED_ADDRESS) {
    throw new Error(`Handoff address ${address} does not match OGPass ${EXPECTED_ADDRESS}.`);
  }
  for (const [type, names] of Object.entries(REQUIRED)) {
    for (const name of names) {
      if (!abi.some((i) => i.type === type && i.name === name)) {
        throw new Error(`ABI in ${path} is missing ${type} ${name} (names must match src/OGPass.sol).`);
      }
    }
  }
  return { path, raw, deployment: { address, deployBlock, abi } };
}

const handoff = loadHandoff();

export default defineConfig({
  // Relative asset paths so the same build works on IPFS gateways and a custom domain.
  base: './',
  define: {
    __DEPLOYMENT__: JSON.stringify(handoff.deployment),
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    assetsInlineLimit: 8192,
  },
  plugins: [
    {
      name: 'imd-deployment-handoff',
      configResolved() {
        console.log(`[ogclub] deployment handoff: ${handoff.path} (block ${handoff.deployment.deployBlock})`);
      },
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'imd-deployment.json', source: JSON.stringify(handoff.raw, null, 2) });
      },
    },
  ],
});
