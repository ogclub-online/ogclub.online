// The live chain API used by main.js. The UI only talks to this object, which
// keeps viem out of the rendering code.
import { publicClient } from './client.js';
import { loadGlobal, loadCurve, loadUserReads, readIsFounder, readOwnerOf, loadEthPerOg } from './reads.js';
import { scanLogs, summarize, findHeldTokenIds } from './logs.js';
import { rootMatches, isFounderAddress } from './merkle.js';
import * as wallet from './wallet.js';
import * as actions from './actions.js';

export const api = {
  loadGlobal,
  loadCurve,
  loadEthPerOg,
  rootMatches,

  async loadActivity(latestBlock) {
    const logs = await scanLogs(latestBlock);
    const latest = await publicClient.getBlock({ blockNumber: latestBlock });
    return { ...summarize(logs, 20), latestBlock, latestTimestamp: Number(latest.timestamp), logs };
  },

  async loadUser(address, logs) {
    const reads = await loadUserReads(address);
    let tokenId = null;
    let isFounderPass = false;
    if (reads.isMember) {
      const candidates = findHeldTokenIds(logs ?? [], address);
      // Confirm against ownerOf in case the log scan is still catching up.
      for (const id of candidates.reverse()) {
        const owner = await readOwnerOf(id);
        if (owner && owner.toLowerCase() === address.toLowerCase()) { tokenId = id; break; }
      }
      if (tokenId !== null) isFounderPass = await readIsFounder(tokenId);
    }
    return {
      ...reads,
      tokenId,
      isFounderPass,
      onFounderList: isFounderAddress(address),
    };
  },

  wallet: {
    discover: wallet.discover,
    onChange: wallet.onChange,
    connect: wallet.connect,
    disconnect: wallet.disconnect,
    switchToMainnet: wallet.switchToMainnet,
  },

  buy: actions.buy,
  sell: actions.sell,
  claimFounder: actions.claimFounder,
  sellFounder: actions.sellFounder,
  describeError: actions.describeError,
};
