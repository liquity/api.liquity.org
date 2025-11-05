import { EthersLiquity } from "@liquity/lib-ethers";
import fs from "fs";
import path from "path";
import util from "util";

import flareDeployment from "../addresses/flareDeployment.json";
import { fetchLQTYCirculatingSupply } from "./fetchLQTYCirculatingSupply";

import { fetchLUSDTotalSupply } from "./fetchLUSDTotalSupply";
import { fetchPrices } from "./fetchPrices";
import { fetchV2Stats } from "./v2/fetchV2Stats";
import { fetchBoldYieldOpportunitiesFromDune } from "./v2/dune/fetchBoldYieldOpportunitiesFromDune";

import {
  DUNE_BOLD_YIELD_OPPORTUNITIES_URL_MAINNET,
  DUNE_FORK_VENUES_URL_MAINNET,
  DUNE_LEADERBOARD_URL_MAINNET,
  DUNE_SPV2_AVERAGE_APY_URL_MAINNET,
  DUNE_SPV2_UPFRONT_FEE_URL_MAINNET,
  LQTY_CIRCULATING_SUPPLY_FILE,
  LUSD_TOTAL_SUPPLY_FILE,
  OUTPUT_DIR_V1,
  OUTPUT_DIR_V2
} from "./constants";
import { fetchForkVenuesFromDune } from "./v2/dune/fetchForkVenuesFromDune";
import { fetchLeaderboardFromDune } from "./v2/dune/fetchLeaderboardFromDune";
import { fetchDefiAvgBorrowRates } from "./v2/fetchDefiAvgBorrowRates";

const panic = <T>(message: string): T => {
  throw new Error(message);
};

const provider = process.env.PROVIDER || "alchemy";
if (provider !== "alchemy" && provider !== "infura") throw new Error("bad PROVIDER");

const duneApiKey: string = process.env.DUNE_API_KEY || panic("missing DUNE_API_KEY");

const lqtyCirculatingSupplyFile = path.join(OUTPUT_DIR_V1, LQTY_CIRCULATING_SUPPLY_FILE);
const lusdTotalSupplyFile = path.join(OUTPUT_DIR_V1, LUSD_TOTAL_SUPPLY_FILE);
// const lusdCBBAMMStatsFile = path.join(OUTPUT_DIR_V1, LUSD_CB_BAMM_STATS_FILE);

type Leaf = string | number | boolean | null | undefined | bigint;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface Tree extends Record<string, Leaf | Tree | Array<Leaf | Tree>> {}

/* files/folder sanitizer */
const safeKey = (key: string) => String(key).replace(/[^a-zA-Z0-9-_]/g, "_");

const isPrimitive = (v: unknown): v is Leaf =>
  typeof v === "string" ||
  typeof v === "number" ||
  typeof v === "boolean" ||
  typeof v === "bigint" ||
  v == null;

const isArrayNode = (v: unknown): v is Array<Leaf | Tree> => Array.isArray(v);

const isBranch = (v: unknown): v is Tree => typeof v === "object" && v !== null && !Array.isArray(v);

const ensureDir = (dir: string) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

/** write primitives in to <dir>/<name>.txt */
const writeLeaf = (dir: string, name: string, value: Leaf) => {
  ensureDir(dir);
  const file = path.join(dir, `${safeKey(name)}.txt`);
  fs.writeFileSync(file, String(value ?? ""));
};

const writeArray = (dir: string, arr: Array<Leaf | Tree>) => {
  ensureDir(dir);

  arr.forEach((item, idx) => {
    const base = path.join(dir, String(idx + 1));

    if (isPrimitive(item)) {
      fs.writeFileSync(`${base}.txt`, String(item ?? ""));
      return;
    }

    if (isArrayNode(item)) {
      writeArray(base, item);
      return;
    }

    if (isBranch(item)) {
      writeTree(base, item);
      return;
    }

    // fallback
    fs.writeFileSync(`${base}.txt`, String(item));
  });
};

export const writeTree = (parentDir: string, tree: Tree): void => {
  ensureDir(parentDir);

  for (const [rawKey, value] of Object.entries(tree)) {
    const key = safeKey(rawKey);
    const base = path.join(parentDir, key);

    if (isPrimitive(value)) {
      // <parent>/<key>.txt
      writeLeaf(parentDir, key, value);
      continue;
    }

    if (isArrayNode(value)) {
      // array: <parent>/<key>/<01>.txt or <01>/* (if object/subarray)
      writeArray(base, value);
      continue;
    }

    if (isBranch(value)) {
      // object: recursion in <parent>/<key>/
      writeTree(base, value);
      continue;
    }

    // fallback
    writeLeaf(parentDir, key, String(value) as unknown as Leaf);
  }
};

const getData = async () => {
  const [
    lqtyCirculatingSupply,
    lusdTotalSupply,

    flareStats,
    prices,
    boldVenues,
    forkVenues,
    leaderboard,
    defiAvgBorrowRates
  ] = await Promise.all([
    fetchLQTYCirculatingSupply(),
    fetchLUSDTotalSupply(),

    fetchV2Stats({
      deployment: flareDeployment,
      duneSpApyUrl: DUNE_SPV2_AVERAGE_APY_URL_MAINNET,
      duneSpUpfrontFeeUrl: DUNE_SPV2_UPFRONT_FEE_URL_MAINNET,
      duneYieldUrl: DUNE_BOLD_YIELD_OPPORTUNITIES_URL_MAINNET,
      duneApiKey
    }),

    fetchPrices(),
    fetchBoldYieldOpportunitiesFromDune({
      apiKey: duneApiKey,
      url: DUNE_BOLD_YIELD_OPPORTUNITIES_URL_MAINNET
    }),
    fetchForkVenuesFromDune({
      apiKey: duneApiKey,
      url: DUNE_FORK_VENUES_URL_MAINNET
    }),
    fetchLeaderboardFromDune({
      apiKey: duneApiKey,
      url: DUNE_LEADERBOARD_URL_MAINNET
    }),
    fetchDefiAvgBorrowRates()
  ]);

  const v2Stats = {
    ...flareStats,

    prices
  };

  const borrowRates = defiAvgBorrowRates.map(({ collateral, defi_avg_borrow_rate }) => ({
    collateral,
    defi_avg_borrow_rate,
    liquity_avg_borrow_rate: Number(flareStats.branch[collateral].interest_rate_avg)
  }));

  fs.mkdirSync(OUTPUT_DIR_V1, { recursive: true });
  fs.writeFileSync(lqtyCirculatingSupplyFile, `${lqtyCirculatingSupply}`);
  fs.writeFileSync(lusdTotalSupplyFile, `${lusdTotalSupply}`);
  // fs.writeFileSync(lusdCBBAMMStatsFile, JSON.stringify(lusdCBBAMMStats));

  writeTree(OUTPUT_DIR_V2, v2Stats);

  fs.writeFileSync(
    path.join(OUTPUT_DIR_V2, "flare.json"),
    JSON.stringify({ ...flareStats, prices }, null, 2)
  );

  fs.mkdirSync(path.join(OUTPUT_DIR_V2, "website"), { recursive: true });
  fs.writeFileSync(
    path.join(OUTPUT_DIR_V2, "website", "bold-venues.json"),
    JSON.stringify(boldVenues, null, 2)
  );
  fs.writeFileSync(
    path.join(OUTPUT_DIR_V2, "website", "fork-venues.json"),
    JSON.stringify(forkVenues, null, 2)
  );
  fs.writeFileSync(
    path.join(OUTPUT_DIR_V2, "website", "leaderboard.json"),
    JSON.stringify(leaderboard, null, 2)
  );
  fs.writeFileSync(
    path.join(OUTPUT_DIR_V2, "website", "borrow-rates.json"),
    JSON.stringify(borrowRates, null, 2)
  );

  console.log(`LQTY circulating supply: ${lqtyCirculatingSupply}`);
  console.log(`LUSD total supply: ${lusdTotalSupply}`);

  console.log();
  console.log("v2 stats:", util.inspect(v2Stats, { colors: true, depth: null }));
};

const main = async () => {
  try {
    await getData();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};
main();
