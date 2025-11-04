import { snapshotEpoch } from "./v2/governance/allocation";
import { snapshotInitiatives } from "./v2/governance/initiatives";
import { getProvider } from "./connection";

const EPOCH_START = 1746662400;
const EPOCH_DURATION = 604800;

const panic = <T>(message: string): T => {
  throw new Error(message);
};

const subgraphUrl: string = process.env.SUBGRAPH_URL || panic("missing SUBGRAPH_URL");
const subgraphOrigin = process.env.SUBGRAPH_ORIGIN || undefined;
const latestCompletedEpoch = Math.floor((Date.now() / 1000 - EPOCH_START) / EPOCH_DURATION);

const main = async () => {
  const argv = process.argv.slice(2);
  const epoch = argv.length > 0 ? parseInt(argv[0]) : latestCompletedEpoch;

  await snapshotEpoch({ subgraphUrl, subgraphOrigin, epoch });
  console.log(`Snapshotted epoch #${epoch}.`);

  const mainnetProvider = getProvider();
  await snapshotInitiatives({ subgraphUrl, subgraphOrigin, provider: mainnetProvider });
  console.log("Snapshotted initiatives.");
};

main().catch(error => {
  console.error(error);
  process.exit(1);
});
