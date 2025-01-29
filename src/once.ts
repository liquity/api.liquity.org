import fs from "fs";
import path from "path";
import util from "util";
import { EthersLiquity } from "@liquity/lib-ethers";

import { getProvider } from "./connection.js";
import { fetchLQTYCirculatingSupply } from "./fetchLQTYCirculatingSupply.js";
import { fetchLUSDTotalSupply } from "./fetchLUSDTotalSupply.js";
import { fetchLUSDCBBAMMStats } from "./fetchLUSDCBBAMMStats.js";
import { fetchV2Stats } from "./v2/fetchV2Stats.js";
import v2MainnetDeployment from "../bold/contracts/addresses/1.json";
import v2SepoliaDeployment from "../bold/contracts/addresses/11155111.json";

import {
  OUTPUT_DIR_V1,
  OUTPUT_DIR_V2,
  LQTY_CIRCULATING_SUPPLY_FILE,
  LUSD_CB_BAMM_STATS_FILE,
  LUSD_TOTAL_SUPPLY_FILE
} from "./constants.js";

const panic = <T>(message: string): T => {
  throw new Error(message);
};

const alchemyApiKey = process.env.ALCHEMY_API_KEY || undefined; // filter out empty string
const duneApiKey: string = process.env.DUNE_API_KEY || panic("missing DUNE_API_KEY");
const transposeApiKey: string = process.env.TRANSPOSE_API_KEY || panic("missing TRANSPOSE_API_KEY");

const lqtyCirculatingSupplyFile = path.join(OUTPUT_DIR_V1, LQTY_CIRCULATING_SUPPLY_FILE);
const lusdTotalSupplyFile = path.join(OUTPUT_DIR_V1, LUSD_TOTAL_SUPPLY_FILE);
const lusdCBBAMMStatsFile = path.join(OUTPUT_DIR_V1, LUSD_CB_BAMM_STATS_FILE);

const mainnetProvider = getProvider("mainnet", { alchemyApiKey });
const sepoliaProvider = getProvider("sepolia", { alchemyApiKey });

interface Tree extends Record<string, string | Tree> {}

const writeTree = (parentDir: string, tree: Tree) => {
  if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir);

  for (const [k, v] of Object.entries(tree)) {
    const prefix = path.join(parentDir, k);

    if (typeof v === "string") {
      fs.writeFileSync(`${prefix}.txt`, v);
    } else {
      writeTree(prefix, v);
    }
  }
};

EthersLiquity.connect(mainnetProvider)
  .then(async liquity => {
    const [lqtyCirculatingSupply, lusdTotalSupply, lusdCBBAMMStats, v2MainnetStats, v2SepoliaStats] = await Promise.all(
      [
        fetchLQTYCirculatingSupply(liquity),
        fetchLUSDTotalSupply(liquity),
        fetchLUSDCBBAMMStats(transposeApiKey),
        fetchV2Stats("mainnet", mainnetProvider, duneApiKey, v2MainnetDeployment),
        fetchV2Stats("sepolia", sepoliaProvider, duneApiKey, v2SepoliaDeployment)
      ]
    );

    const v2Stats = {
      ...v2MainnetStats,
      testnet: {
        sepolia: v2SepoliaStats
      }
    };

    fs.mkdirSync(OUTPUT_DIR_V1, { recursive: true });
    fs.writeFileSync(lqtyCirculatingSupplyFile, `${lqtyCirculatingSupply}`);
    fs.writeFileSync(lusdTotalSupplyFile, `${lusdTotalSupply}`);
    fs.writeFileSync(lusdCBBAMMStatsFile, JSON.stringify(lusdCBBAMMStats));

    writeTree(OUTPUT_DIR_V2, v2Stats);
    fs.writeFileSync(
      path.join(OUTPUT_DIR_V2, "mainnet.json"),
      JSON.stringify(v2MainnetStats, null, 2)
    );
    fs.writeFileSync(
      path.join(OUTPUT_DIR_V2, "testnet", "sepolia.json"),
      JSON.stringify(v2SepoliaStats, null, 2)
    );

    console.log(`LQTY circulating supply: ${lqtyCirculatingSupply}`);
    console.log(`LUSD total supply: ${lusdTotalSupply}`);
    console.log("LUSD CB BAMM stats:", lusdCBBAMMStats);
    console.log();
    console.log("v2 stats:", util.inspect(v2Stats, { colors: true, depth: null }));
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
