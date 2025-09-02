import { EthersLiquity } from "@liquity/lib-ethers";
import fs from "fs";
import path from "path";
import util from "util";

import v2LegacyDeployment from "../addresses/legacy.json";
import v2RelaunchDeployment from "../addresses/relaunch.json";
import v2SepoliaDeployment from "../addresses/sepolia.json";
import { getProvider } from "./connection";
import { fetchLQTYCirculatingSupply } from "./fetchLQTYCirculatingSupply";
// import { fetchLUSDCBBAMMStats } from "./fetchLUSDCBBAMMStats";
import { fetchLUSDTotalSupply } from "./fetchLUSDTotalSupply";
import { fetchPrices } from "./fetchPrices";
import { fetchV2Stats } from "./v2/fetchV2Stats";

import {
  DUNE_BOLD_YIELD_OPPORTUNITIES_URL_MAINNET,
  DUNE_SPV2_AVERAGE_APY_URL_MAINNET,
  DUNE_SPV2_UPFRONT_FEE_URL_MAINNET,
  LQTY_CIRCULATING_SUPPLY_FILE,
  // LUSD_CB_BAMM_STATS_FILE,
  LUSD_TOTAL_SUPPLY_FILE,
  OUTPUT_DIR_V1,
  OUTPUT_DIR_V2,
  SAFE_PRICES
} from "./constants";

const panic = <T>(message: string): T => {
  throw new Error(message);
};

const provider = process.env.PROVIDER || "alchemy";
if (provider !== "alchemy" && provider !== "infura") throw new Error("bad PROVIDER");

const alchemyApiKey = process.env.ALCHEMY_API_KEY || undefined; // filter out empty string
const infuraApiKey = process.env.INFURA_API_KEY || undefined; // filter out empty string
const duneApiKey: string = process.env.DUNE_API_KEY || panic("missing DUNE_API_KEY");
// const transposeApiKey: string = process.env.TRANSPOSE_API_KEY || panic("missing TRANSPOSE_API_KEY");
const coinGeckoDemoApiKey: string =
  process.env.COINGECKO_DEMO_KEY || panic("missing COINGECKO_DEMO_KEY");

const lqtyCirculatingSupplyFile = path.join(OUTPUT_DIR_V1, LQTY_CIRCULATING_SUPPLY_FILE);
const lusdTotalSupplyFile = path.join(OUTPUT_DIR_V1, LUSD_TOTAL_SUPPLY_FILE);
// const lusdCBBAMMStatsFile = path.join(OUTPUT_DIR_V1, LUSD_CB_BAMM_STATS_FILE);

const mainnetProvider = getProvider("mainnet", { provider, alchemyApiKey, infuraApiKey });
const sepoliaProvider = getProvider("sepolia", { provider, alchemyApiKey, infuraApiKey });

type Leaf = string | number | boolean | null | undefined | bigint;

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

EthersLiquity.connect(mainnetProvider)
  .then(async liquity => {
    const [
      lqtyCirculatingSupply,
      lusdTotalSupply,
      // lusdCBBAMMStats,
      v2LegacyStats,
      v2RelaunchStats,
      v2SepoliaStats,
      allPrices
    ] = await Promise.all([
      fetchLQTYCirculatingSupply(liquity),
      fetchLUSDTotalSupply(liquity),
      // fetchLUSDCBBAMMStats(transposeApiKey),
      fetchV2Stats({
        deployment: v2LegacyDeployment,
        provider: mainnetProvider,
        duneSpApyUrl: null,
        duneSpUpfrontFeeUrl: null,
        duneYieldUrl: null,
        duneApiKey
      }),
      fetchV2Stats({
        deployment: v2RelaunchDeployment,
        provider: mainnetProvider,
        duneSpApyUrl: DUNE_SPV2_AVERAGE_APY_URL_MAINNET,
        duneSpUpfrontFeeUrl: DUNE_SPV2_UPFRONT_FEE_URL_MAINNET,
        duneYieldUrl: DUNE_BOLD_YIELD_OPPORTUNITIES_URL_MAINNET,
        duneApiKey
      }),
      fetchV2Stats({
        deployment: v2SepoliaDeployment,
        provider: sepoliaProvider,
        duneSpApyUrl: null,
        duneSpUpfrontFeeUrl: null,
        duneYieldUrl: null,
        duneApiKey
      }),
      fetchPrices({ coinGeckoDemoApiKey })
    ]);

    const allPriceEntries = Object.entries(allPrices);

    const prices = {
      prices: Object.fromEntries(allPriceEntries.filter(([k]) => SAFE_PRICES.has(k))),
      otherPrices: Object.fromEntries(allPriceEntries.filter(([k]) => !SAFE_PRICES.has(k)))
    };

    const v2Stats = {
      ...v2RelaunchStats,
      legacy: v2LegacyStats,
      prices: allPrices,
      testnet: {
        sepolia: v2SepoliaStats
      }
    };

    fs.mkdirSync(OUTPUT_DIR_V1, { recursive: true });
    fs.writeFileSync(lqtyCirculatingSupplyFile, `${lqtyCirculatingSupply}`);
    fs.writeFileSync(lusdTotalSupplyFile, `${lusdTotalSupply}`);
    // fs.writeFileSync(lusdCBBAMMStatsFile, JSON.stringify(lusdCBBAMMStats));

    writeTree(OUTPUT_DIR_V2, v2Stats);
    fs.writeFileSync(
      path.join(OUTPUT_DIR_V2, "mainnet.json"),
      JSON.stringify({ ...v2LegacyStats, ...prices }, null, 2)
    );
    fs.writeFileSync(
      path.join(OUTPUT_DIR_V2, "ethereum.json"),
      JSON.stringify({ ...v2RelaunchStats, ...prices }, null, 2)
    );
    fs.writeFileSync(
      path.join(OUTPUT_DIR_V2, "testnet", "sepolia.json"),
      JSON.stringify({ ...v2SepoliaStats, ...prices }, null, 2)
    );

    console.log(`LQTY circulating supply: ${lqtyCirculatingSupply}`);
    console.log(`LUSD total supply: ${lusdTotalSupply}`);
    // console.log("LUSD CB BAMM stats:", lusdCBBAMMStats);
    console.log();
    console.log("v2 stats:", util.inspect(v2Stats, { colors: true, depth: null }));
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
