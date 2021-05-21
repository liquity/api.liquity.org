import fs from "fs";
import path from "path";

import { DEFAULT_NETWORK, DEFAULT_OUTPUT_FILE, EXCLUDED_LQTY_HOLDERS } from "./constants";
import { connectToLiquity } from "./connection";
import { fetchLQTYCirculatingSupply } from "./fetchLQTYCirculatingSupply";

const alchemyApiKey = process.env.ALCHEMY_API_KEY || undefined; // filter out empty string
const outputFile = DEFAULT_OUTPUT_FILE;
const outputDir = path.dirname(outputFile);

connectToLiquity(DEFAULT_NETWORK, { alchemyApiKey })
  .then(async liquity => {
    const latestCirculatingSupply = await fetchLQTYCirculatingSupply(liquity, EXCLUDED_LQTY_HOLDERS);

    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(outputFile, `${latestCirculatingSupply}`);

    console.log(`Latest LQTY circulating supply: ${latestCirculatingSupply}`);
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
