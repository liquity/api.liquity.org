import fs from "fs";
import path from "path";

import { connectToLiquity } from "./connection.js";
import { fetchLQTYCirculatingSupply } from "./fetchLQTYCirculatingSupply.js";
import { fetchLUSDTotalSupply } from "./fetchLUSDTotalSupply.js";
import { fetchLUSDCBBAMMStats } from "./fetchLUSDCBBAMMStats.js";

import {
  DEFAULT_NETWORK,
  DEFAULT_OUTPUT_DIR,
  LQTY_CIRCULATING_SUPPLY_FILE,
  LUSD_CB_BAMM_STATS_FILE,
  LUSD_TOTAL_SUPPLY_FILE
} from "./constants.js";

const panic = <T>(message: string): T => {
  throw new Error(message);
};

const alchemyApiKey = process.env.ALCHEMY_API_KEY || undefined; // filter out empty string
const transposeApiKey: string = process.env.TRANSPOSE_API_KEY || panic("missing TRANSPOSE_API_KEY");

const outputDir = DEFAULT_OUTPUT_DIR;
const lqtyCirculatingSupplyFile = path.join(outputDir, LQTY_CIRCULATING_SUPPLY_FILE);
const lusdTotalSupplyFile = path.join(outputDir, LUSD_TOTAL_SUPPLY_FILE);
const lusdCBBAMMStatsFile = path.join(outputDir, LUSD_CB_BAMM_STATS_FILE);

connectToLiquity(DEFAULT_NETWORK, { alchemyApiKey })
  .then(async liquity => {
    const [lqtyCirculatingSupply, lusdTotalSupply, lusdCBBAMMStats] = await Promise.all([
      fetchLQTYCirculatingSupply(liquity),
      fetchLUSDTotalSupply(liquity),
      fetchLUSDCBBAMMStats(transposeApiKey)
    ]);

    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(lqtyCirculatingSupplyFile, `${lqtyCirculatingSupply}`);
    fs.writeFileSync(lusdTotalSupplyFile, `${lusdTotalSupply}`);
    fs.writeFileSync(lusdCBBAMMStatsFile, JSON.stringify(lusdCBBAMMStats));

    console.log(`LQTY circulating supply: ${lqtyCirculatingSupply}`);
    console.log(`LUSD total supply: ${lusdTotalSupply}`);
    console.log("LUSD CB BAMM stats:", lusdCBBAMMStats);
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
