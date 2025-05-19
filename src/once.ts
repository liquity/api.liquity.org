import { EthersLiquity } from "@liquity/lib-ethers";
import fs from "fs";
import path from "path";
import util from "util";

import v2LegacyDeployment from "../addresses/legacy.json";
import v2RelaunchDeployment from "../addresses/legacy.json"; // TODO: legacy => relaunch
import v2SepoliaDeployment from "../addresses/sepolia.json";
import { getProvider } from "./connection";
import { fetchLQTYCirculatingSupply } from "./fetchLQTYCirculatingSupply";
import { fetchLUSDCBBAMMStats } from "./fetchLUSDCBBAMMStats";
import { fetchLUSDTotalSupply } from "./fetchLUSDTotalSupply";
import { fetchV2Stats } from "./v2/fetchV2Stats";

import {
  DUNE_SPV2_AVERAGE_APY_URL_MAINNET,
  DUNE_SPV2_AVERAGE_APY_URL_SEPOLIA,
  LQTY_CIRCULATING_SUPPLY_FILE,
  LUSD_CB_BAMM_STATS_FILE,
  LUSD_TOTAL_SUPPLY_FILE,
  OUTPUT_DIR_V1,
  OUTPUT_DIR_V2
} from "./constants";

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
    const [lqtyCirculatingSupply, lusdTotalSupply, lusdCBBAMMStats, v2LegacyStats, v2RelaunchStats, v2SepoliaStats] = await Promise.all(
      [
        fetchLQTYCirculatingSupply(liquity),
        fetchLUSDTotalSupply(liquity),
        fetchLUSDCBBAMMStats(transposeApiKey),
        fetchV2Stats({
          deployment: v2LegacyDeployment,
          provider: mainnetProvider,
          duneUrl: DUNE_SPV2_AVERAGE_APY_URL_MAINNET,
          duneApiKey,
        }),
        fetchV2Stats({
          deployment: v2RelaunchDeployment,
          provider: mainnetProvider,
          duneUrl: null, // TODO
          duneApiKey,
        }),
        fetchV2Stats({
          deployment: v2SepoliaDeployment,
          provider: sepoliaProvider,
          duneUrl: DUNE_SPV2_AVERAGE_APY_URL_SEPOLIA,
          duneApiKey
        })
      ]
    );

    const v2Stats = {
      ...v2RelaunchStats,
      legacy: v2LegacyStats,
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
      JSON.stringify(v2LegacyStats, null, 2)
    );
    fs.writeFileSync(
      path.join(OUTPUT_DIR_V2, "ethereum.json"),
      JSON.stringify(v2RelaunchStats, null, 2)
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
