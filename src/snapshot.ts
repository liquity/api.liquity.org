import { snapshotEpoch } from "./v2/governance/allocation";
import { snapshotInitiatives } from "./v2/governance/initiatives";
import { getProvider } from "./connection";

const EPOCH_START = 1746662400;
const EPOCH_DURATION = 604800;

const panic = <T>(message: string): T => {
  throw new Error(message);
};

const subgraphUrl: string = process.env.SUBGRAPH_URL || panic("missing SUBGRAPH_URL");
const latestCompletedEpoch = Math.floor((Date.now() / 1000 - EPOCH_START) / EPOCH_DURATION);

const provider = process.env.PROVIDER || "alchemy";
if (provider !== "alchemy" && provider !== "infura") throw new Error("bad PROVIDER");

const alchemyApiKey = process.env.ALCHEMY_API_KEY || undefined;
const infuraApiKey = process.env.INFURA_API_KEY || undefined;

const main = async () => {
  const argv = process.argv.slice(2);
  const epoch = argv.length > 0 ? parseInt(argv[0]) : latestCompletedEpoch;
  
  await snapshotEpoch(subgraphUrl, epoch);
  
  const mainnetProvider = getProvider("mainnet", { provider, alchemyApiKey, infuraApiKey });
  await snapshotInitiatives(subgraphUrl, mainnetProvider);
};

main().catch(error => {
  console.error(error);
  process.exit(1);
});
