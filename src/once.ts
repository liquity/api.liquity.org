import fs from "fs";
import path from "path";

import { connectToLiquity } from "./connection";
import { fetchLQTYCirculatingSupply } from "./fetchLQTYCirculatingSupply";
import { fetchLUSDTotalSupply } from "./fetchLUSDTotalSupply";

import {
  DEFAULT_NETWORK,
  DEFAULT_OUTPUT_DIR,
  LQTY_CIRCULATING_SUPPLY_FILE,
  LUSD_TOTAL_SUPPLY_FILE
} from "./constants";

const alchemyApiKey = process.env.ALCHEMY_API_KEY || undefined; // filter out empty string

const outputDir = DEFAULT_OUTPUT_DIR;
const lqtyCirculatingSupplyFile = path.join(outputDir, LQTY_CIRCULATING_SUPPLY_FILE);
const lusdTotalSupplyFile = path.join(outputDir, LUSD_TOTAL_SUPPLY_FILE);

connectToLiquity(DEFAULT_NETWORK, { alchemyApiKey })
  .then(async liquity => {
    const [lqtyCirculatingSupply, lusdTotalSupply] = await Promise.all([
      fetchLQTYCirculatingSupply(liquity),
      fetchLUSDTotalSupply(liquity)
    ]);

    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(lqtyCirculatingSupplyFile, `${lqtyCirculatingSupply}`);
    fs.writeFileSync(lusdTotalSupplyFile, `${lusdTotalSupply}`);

    console.log(`Latest LQTY circulating supply: ${lqtyCirculatingSupply}`);
    console.log(`Latest LUSD total supply: ${lusdTotalSupply}`);
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
