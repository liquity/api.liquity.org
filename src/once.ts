import { EthersLiquity } from "@liquity/lib-ethers";
import fs from "fs";
import path from "path";
import util from "util";

import v2LegacyDeployment from "../addresses/legacy.json";
import v2RelaunchDeployment from "../addresses/relaunch.json";
import v2SepoliaDeployment from "../addresses/sepolia.json";
import { getProvider } from "./connection";
import { fetchLQTYCirculatingSupply } from "./fetchLQTYCirculatingSupply";
import { fetchLUSDCBBAMMStats } from "./fetchLUSDCBBAMMStats";
import { fetchLUSDTotalSupply } from "./fetchLUSDTotalSupply";
import { fetchPrices } from "./fetchPrices";
import { fetchV2Stats } from "./v2/fetchV2Stats";

import {
  DUNE_BOLD_YIELD_OPPORTUNITIES_URL_MAINNET,
  DUNE_SPV2_AVERAGE_APY_URL_MAINNET,
  DUNE_SPV2_UPFRONT_FEE_URL_MAINNET,
  LQTY_CIRCULATING_SUPPLY_FILE,
  LUSD_CB_BAMM_STATS_FILE,
  LUSD_TOTAL_SUPPLY_FILE,
  OUTPUT_DIR_V1,
  OUTPUT_DIR_V2,
  SAFE_PRICES
} from "./constants";

const panic = <T>(message: string): T => {
  throw new Error(message);
};

const alchemyApiKey = process.env.ALCHEMY_API_KEY || undefined; // filter out empty string
const duneApiKey: string = process.env.DUNE_API_KEY || panic("missing DUNE_API_KEY");
const transposeApiKey: string = process.env.TRANSPOSE_API_KEY || panic("missing TRANSPOSE_API_KEY");
const coinGeckoDemoApiKey: string =
  process.env.COINGECKO_DEMO_KEY || panic("missing COINGECKO_DEMO_KEY");

const lqtyCirculatingSupplyFile = path.join(OUTPUT_DIR_V1, LQTY_CIRCULATING_SUPPLY_FILE);
const lusdTotalSupplyFile = path.join(OUTPUT_DIR_V1, LUSD_TOTAL_SUPPLY_FILE);
const lusdCBBAMMStatsFile = path.join(OUTPUT_DIR_V1, LUSD_CB_BAMM_STATS_FILE);

const mainnetProvider = getProvider("mainnet", { alchemyApiKey });
const sepoliaProvider = getProvider("sepolia", { alchemyApiKey });

const safeKey = (s: string) =>
  String(s)
    .normalize("NFKD")
    .replace(/[\/\\:*?"<>|]+/g, "-")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

/* Trying to retrieve a “human-readable” label for an array item */
const guessLabel = (v: unknown): string | null => {
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const c =
      o["asset"] ?? o["source"] ?? o["symbol"] ?? o["name"] ?? o["id"];
    if (typeof c === "string" && c.trim()) return c;
  }
  return null;
};

/**
 * Writes a tree of any structure:
 * - object → subdirectories by keys
 * - array → subfolders item_01[-label], item_02[-label], …
 * - string/number/boolean/null/undefined → <key>.txt with the stringified value
 *
 * If the input is a primitive (rare, but possible), it writes a value.txt file.
 */
const ensureDir = (dir: string) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const isPrimitive = (x: unknown): x is string | number | boolean | null | undefined =>
  typeof x === "string" || typeof x === "number" || typeof x === "boolean" || x == null;

const writeLeaf = (dir: string, name: string, value: unknown) => {
  ensureDir(dir);
  const file = path.join(dir, `${safeKey(name)}.txt`);
  fs.writeFileSync(file, String(value ?? ""));
};

const writeArrayNode = (dir: string, arr: unknown[]) => {
  ensureDir(dir);
  arr.forEach((item, idx) => {
    const label = guessLabel(item);
    const folder =
      `${String(idx + 1).padStart(2, "0")}` + (label ? `-${safeKey(label)}` : "");
    writeNode(path.join(dir, folder), item);
  });
};

const writeObjectNode = (dir: string, obj: Record<string, unknown>) => {
  ensureDir(dir);
  for (const [k, v] of Object.entries(obj)) {
    const entryPath = path.join(dir, safeKey(k));
    writeNode(entryPath, v, k);
  }
};

const writeNode = (dir: string, node: unknown, leafName = "value") => {
  if (isPrimitive(node)) {
    writeLeaf(path.dirname(path.join(dir, "_")), leafName, node);
    return;
  }

  if (Array.isArray(node)) {
    writeArrayNode(dir, node);
    return;
  }

  if (typeof node === "object" && node !== null) {
    writeObjectNode(dir, node as Record<string, unknown>);
    return;
  }

  // fallback for exotic types (symbol, function, bigint)
  writeLeaf(path.dirname(path.join(dir, "_")), leafName, String(node));
};

export const writeTree = (parentDir: string, node: unknown): void => {
  // top level: if primitive — value.txt in parentDir
  if (isPrimitive(node)) {
    writeLeaf(parentDir, "value", node);
    return;
  }

  if (Array.isArray(node)) {
    writeArrayNode(parentDir, node);
    return;
  }

  writeObjectNode(parentDir, node as Record<string, unknown>);
};

EthersLiquity.connect(mainnetProvider)
  .then(async liquity => {
    const [
      lqtyCirculatingSupply,
      lusdTotalSupply,
      lusdCBBAMMStats,
      v2LegacyStats,
      v2RelaunchStats,
      v2SepoliaStats,
      allPrices
    ] = await Promise.all([
      fetchLQTYCirculatingSupply(liquity),
      fetchLUSDTotalSupply(liquity),
      fetchLUSDCBBAMMStats(transposeApiKey),
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
    fs.writeFileSync(lusdCBBAMMStatsFile, JSON.stringify(lusdCBBAMMStats));

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
    console.log("LUSD CB BAMM stats:", lusdCBBAMMStats);
    console.log();
    console.log("v2 stats:", util.inspect(v2Stats, { colors: true, depth: null }));
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
