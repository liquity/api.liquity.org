import { snapshotEpoch } from "./v2/governance/allocation";

const EPOCH_START = 1746662400;
const EPOCH_DURATION = 604800;

const panic = <T>(message: string): T => {
  throw new Error(message);
};

const subgraphUrl: string = process.env.SUBGRAPH_URL || panic("missing SUBGRAPH_URL");
const latestCompletedEpoch = Math.floor((Date.now() / 1000 - EPOCH_START) / EPOCH_DURATION);

const main = async () => {
  const argv = process.argv.slice(2);
  const epoch = argv.length > 0 ? parseInt(argv[0]) : latestCompletedEpoch;
  await snapshotEpoch(subgraphUrl, epoch);
  console.log(`Snapshotted epoch #${epoch}.`);
};

main().catch(error => {
  console.error(error);
  process.exit(1);
});
